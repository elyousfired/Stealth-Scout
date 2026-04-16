import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import axios from 'axios';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

const app = express();
app.use(cors());
app.use(express.static(path.join(process.cwd(), 'dist')));

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const BINANCE_API = 'https://fapi.binance.com';
const BINANCE_WS = 'wss://fstream.binance.com/ws/!ticker@arr';
const STICKY_FILE = path.join(process.cwd(), 'sticky_tokens.json');

// --- TELEGRAM CONFIG ---
const TG_BOT_TOKEN = ''; 
const TG_CHAT_ID = ''; 

interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TokenInfo {
  symbol: string;
  price: number;
  vwapDaily: number;
  ema50: number;
  vwapWeeklyMax: number;
  vwapWeeklyMin: number;
  weeklyRange: number;
  change24h: number;
  status: 'under' | 'over' | 'golden' | 'sniper';
  isInsideStructure: boolean;
  entryPrice?: number;
  pnlFromCross?: number;
  lastUpdated?: string;
  crossTime?: string;
  volumeRatio?: number;
  isFreshBreakout?: boolean;
  history?: { vwap: number; ema: number; price: number }[];
}

// Global States
let stickyTokens: TokenInfo[] = [];
let pendingHunts = new Map<string, TokenInfo>(); // Tokens tracked for breakout
let livePrices = new Map<string, { price: number; change24h: number }>();
let resultsMap = new Map<string, TokenInfo>(); 
let tickerScanQueue: any[] = [];
let performanceStats = {
  daily: { vip: 0, pump: 0 },
  weekly: { vip: 0, pump: 0 }
};

// Load Sticky
if (fs.existsSync(STICKY_FILE)) {
  try {
    stickyTokens = JSON.parse(fs.readFileSync(STICKY_FILE, 'utf-8'));
  } catch (e) {}
}

function saveStickyTokens() {
  try {
    fs.writeFileSync(STICKY_FILE, JSON.stringify(stickyTokens, null, 2));
    updatePerformanceStats(); // Recalculate whenever sticky tokens change
  } catch (e) {}
}

const AUDIT_FILE = path.join(process.cwd(), 'audit_signals.json');

function updatePerformanceStats() {
  const now = new Date();
  const todayStartTs = new Date(now).setUTCHours(0,0,0,0);
  
  let weekStart = new Date(now);
  weekStart.setUTCHours(0,0,0,0);
  const currentDay = now.getUTCDay();
  if (currentDay === 1 || currentDay === 2) {
    weekStart.setUTCDate(weekStart.getUTCDate() - (currentDay === 1 ? 1 : 2));
  } else {
    weekStart.setUTCDate(weekStart.getUTCDate() - (currentDay === 0 ? 6 : currentDay - 1));
  }
  const weekStartTs = weekStart.getTime();

  let dailyVip = 0, dailyPump = 0;
  let weeklyVip = 0, weeklyPump = 0;

  // 1. History from Audit
  if (fs.existsSync(AUDIT_FILE)) {
    try {
      const auditData = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf-8'));
      auditData.forEach((s: any) => {
        // Crude date parsing for audit_signals "MM-DDTHH:mm" format
        const [month, rest] = s.time ? s.time.split('-') : ['0', ''];
        const day = rest.split('T')[0];
        const signalDate = new Date(2026, parseInt(month)-1, parseInt(day));
        const sigTs = signalDate.getTime();
        
        if (sigTs >= weekStartTs) {
          const gain = s.gain || 0;
          if (s.type === 'PUMP' || s.isFreshBreakout) weeklyPump += gain;
          else weeklyVip += gain;
          
          if (sigTs >= todayStartTs) {
            if (s.type === 'PUMP' || s.isFreshBreakout) dailyPump += gain;
            else dailyVip += gain;
          }
        }
      });
    } catch (e) {}
  }

  // 2. Current Sticky Tokens
  stickyTokens.forEach(s => {
    if (s.crossTime && s.pnlFromCross !== undefined) {
      const sigTs = new Date(s.crossTime).getTime();
      const pnl = s.pnlFromCross;

      if (sigTs >= weekStartTs) {
        if (s.isFreshBreakout) weeklyPump += pnl;
        else weeklyVip += pnl;

        if (sigTs >= todayStartTs) {
          if (s.isFreshBreakout) dailyPump += pnl;
          else dailyVip += pnl;
        }
      }
    }
  });

  performanceStats = {
    daily: { vip: dailyVip, pump: dailyPump },
    weekly: { weeklyVip, weeklyPump } // Fixed naming convention for emitting
  };
  io.emit('performance_stats', performanceStats);
}

// --- WEBSOCKET CLIENT ---
function initBinanceWS() {
  console.log('\x1b[36m[WS] Connecting to Binance Futures stream...\x1b[0m');
  const ws = new WebSocket(BINANCE_WS);

  ws.on('open', () => console.log('\x1b[32m[WS] Connected. Receiving live prices.\x1b[0m'));
  
  ws.on('message', (data: any) => {
    try {
      const tickers = JSON.parse(data.toString());
      tickers.forEach((t: any) => {
        if (t.s.endsWith('USDT')) {
          livePrices.set(t.s, {
            price: Number(t.c),
            change24h: Number(t.P)
          });
        }
      });
    } catch (e) {}
  });

  ws.on('close', () => {
    console.warn('\x1b[33m[WS] Connection closed. Reconnecting in 5s...\x1b[0m');
    setTimeout(initBinanceWS, 5000);
  });

  ws.on('error', (err) => {
    console.error('\x1b[31m[WS] Error:\x1b[0m', err.message);
  });
}

// --- SCANNER UTILS ---
async function fetchTopTickers() {
  try {
    const { data } = await axios.get(`${BINANCE_API}/fapi/v1/ticker/24hr`);
    const usdtPairs = data.filter((t: any) => t.symbol.endsWith('USDT'));
    return usdtPairs
      .sort((a: any, b: any) => Number(b.quoteVolume) - Number(a.quoteVolume))
      .slice(0, 400);
  } catch (e) {
    return [];
  }
}

async function fetchIntraday(symbol: string): Promise<Candle[]> {
  const url = `${BINANCE_API}/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=1000`;
  const { data } = await axios.get(url);
  return data.map((c: any) => ({
    openTime: c[0],
    open: Number(c[1]),
    high: Number(c[2]),
    low: Number(c[3]),
    close: Number(c[4]),
    volume: Number(c[5]),
  }));
}

function calculateDailyVWAPs(candles: Candle[]) {
  const days: Record<string, { pv: number; vol: number; openTime: number }> = {};
  candles.forEach(c => {
    const dateKey = new Date(c.openTime).toISOString().slice(0, 10);
    if (!days[dateKey]) days[dateKey] = { pv: 0, vol: 0, openTime: c.openTime };
    const typical = (c.high + c.low + c.close) / 3;
    days[dateKey].pv += typical * c.volume;
    days[dateKey].vol += c.volume;
  });
  return Object.values(days).sort((a,b) => a.openTime - b.openTime).map(d => ({ openTime: d.openTime, vwap: d.pv / d.vol }));
}

function isStartOfWeek(timestamp: number) {
  const date = new Date(timestamp);
  return date.getUTCDay() === 1; // Monday
}

function calculateEMA(candles: Candle[], period: number = 50): number {
  if (candles.length < period) {
    return candles.reduce((sum, c) => sum + c.close, 0) / (candles.length || 1);
  }
  
  // Institutional/TV Standard: EMA starts with SMA of the first N periods
  let sma = 0;
  for (let i = 0; i < period; i++) {
    sma += candles[i].close;
  }
  let ema = sma / period;
  
  // Recursive EMA calculation from index 'period' onwards
  const k = 2 / (period + 1);
  for (let i = period; i < candles.length; i++) {
    ema = (candles[i].close * k) + (ema * (1 - k));
  }
  return ema;
}

async function sendTelegramAlert(token: TokenInfo) {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
  const message = `🦅 *HYPER-SNIPER V8:* ${token.symbol} 🦅\n💎 STATUS: *${token.status.toUpperCase()}*\n💰 Price: ${token.price}\n📉 Range: ${(token.weeklyRange * 100).toFixed(2)}%\n🔗 [View Chart](https://www.tradingview.com/chart/?symbol=BINANCE:${token.symbol})`;
  try {
    await axios.post(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, { chat_id: TG_CHAT_ID, text: message, parse_mode: 'Markdown' });
  } catch (err) {}
}

let scanSessionCount = 0;
let lastCycleTime = 0;
let currentScanningSymbol = '';

async function startStealthScanner() {
  console.log('\x1b[35m[STEALTH] Scanner Engine initialized.\x1b[0m');
  const sessionStart = Date.now();
  
  while (true) {
    if (tickerScanQueue.length === 0) {
      if (scanSessionCount > 0) lastCycleTime = (Date.now() - sessionStart) / 1000;
      scanSessionCount = 0;
      console.log('\x1b[36m[CYCLE] Getting symbol list from Live WS stream...\x1b[0m');
      // Use live prices map keys as source symbols (avoids REST API 429/418 bans)
      const symbolsFromWS = Array.from(livePrices.keys());
      if (symbolsFromWS.length > 0) {
        // PRIORITY: Prioritize stickyTokens symbols so their metadata (Volume/PnL) updates immediately on startup
        const stickySymbols = new Set(stickyTokens.map(s => s.symbol));
        const fullList = symbolsFromWS.map(s => ({ symbol: s, lastPrice: livePrices.get(s)?.price || 0 }));
        
        const priorityList = fullList.filter(t => stickySymbols.has(t.symbol));
        const normalList = fullList.filter(t => !stickySymbols.has(t.symbol));
        
        tickerScanQueue = [...priorityList, ...normalList].slice(0, 400); 
      } else {
        // Fallback to REST only if WS hasn't received anything yet
        tickerScanQueue = await fetchTopTickers();
        if (tickerScanQueue.length === 0) {
          await new Promise(r => setTimeout(r, 10000));
          continue;
        }
      }
    }

    const t = tickerScanQueue.shift();
    const symbol = t.symbol;
    currentScanningSymbol = symbol;
    scanSessionCount++;
    
    // LIVE STATUS EMIT: Send active pulse to frontend
    io.emit('scanner_status', { 
      symbol, 
      count: scanSessionCount, 
      total: 400,
      isHighPriority: true 
    });

    try {
      const liveData = livePrices.get(symbol);
      const currentPrice = liveData ? liveData.price : Number(t.lastPrice);
      const candles = await fetchIntraday(symbol);
      
      if (candles.length >= 50) {
        const dailyVWAPs = calculateDailyVWAPs(candles);
        const ema50 = calculateEMA(candles, 50);

        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setUTCHours(0,0,0,0);
        const todayStartTs = todayStart.getTime();

        let startPeriodDate = new Date(now);
        startPeriodDate.setUTCHours(0,0,0,0);
        const currentDay = now.getUTCDay();
        if (currentDay === 1 || currentDay === 2) {
          startPeriodDate.setUTCDate(startPeriodDate.getUTCDate() - (currentDay === 1 ? 1 : 2));
        } else {
          startPeriodDate.setUTCDate(startPeriodDate.getUTCDate() - (currentDay === 0 ? 6 : currentDay - 1));
        }
        const startTimestamp = startPeriodDate.getTime();

        const todayCandles = candles.filter(c => c.openTime >= todayStartTs);
        let todayPV = 0, todayVol = 0;
        todayCandles.forEach(c => { todayPV += ((c.high + c.low + c.close) / 3) * c.volume; todayVol += c.volume; });
        const vwapDaily = todayVol > 0 ? todayPV / todayVol : currentPrice;

        // --- CALC PREVIOUS STATE (for Crossover detection) ---
        const prevTodayCandles = todayCandles.slice(0, -1);
        let pTodayPV = 0, pTodayVol = 0;
        prevTodayCandles.forEach(c => { pTodayPV += ((c.high + c.low + c.close) / 3) * c.volume; pTodayVol += c.volume; });
        const prevVwapDaily = pTodayVol > 0 ? pTodayPV / pTodayVol : currentPrice;
        const prevEma50 = calculateEMA(candles.slice(0, -1), 50);

        let wMax: number | null = null, wMin: number | null = null;
        const thisWeekVWAPs = dailyVWAPs.filter(d => d.openTime >= startTimestamp);
        const vwapSource = thisWeekVWAPs.length > 0 ? thisWeekVWAPs : dailyVWAPs;

        vwapSource.forEach(d => {
          const isNewWeek = isStartOfWeek(d.openTime);
          if (isNewWeek || wMax === null) { wMax = d.vwap; wMin = d.vwap; }
          else { wMax = Math.max(wMax, d.vwap); wMin = Math.min(wMin, d.vwap); }
        });

        const finalWMax = (wMax !== null && !isNaN(wMax)) ? wMax : vwapDaily;
        const finalWMin = (wMin !== null && !isNaN(wMin)) ? wMin : vwapDaily;
        const weeklyRange = (finalWMax - finalWMin) / currentPrice;

        const currentCandle = candles[candles.length - 1];
        const prevCandle = candles[candles.length - 2];
        
        const isBullish = vwapDaily > ema50;
        const wasBullish = prevVwapDaily > prevEma50;
        const isFirstCross = !wasBullish && isBullish;
        
        const isCleanBreak = currentPrice > finalWMax;
        const isVolumeOk = t.volume > 0;
        const prevWeeklyRange = weeklyRange;
        const wasFlat = prevWeeklyRange < 0.03;
        const prevPrice = prevCandle ? prevCandle.close : currentPrice;
        const isFirstBreak = prevPrice <= finalWMax;
        
        // NEW: Structural Equilibrium Condition
        const isInsideStructure = (ema50 >= finalWMin && ema50 <= finalWMax) && (vwapDaily >= finalWMin && vwapDaily <= finalWMax);
        const isBelowCeiling = vwapDaily <= (finalWMax + (finalWMax * 0.001));

        // CHECK PREVIOUS CLOSED CANDLE (15m)
        const lastClosedCandle = candles.length >= 2 ? candles[candles.length - 2] : null;
        const prevClosedCandle = candles.length >= 3 ? candles[candles.length - 3] : null;
        const prevClosedCandle2 = candles.length >= 4 ? candles[candles.length - 4] : null;
        
        const didCloseAboveMax = lastClosedCandle ? lastClosedCandle.close > finalWMax : false;

        // PUMP CHANCE LOGIC: 1st or 2nd candle close above max
        let isFreshBreakout = false;
        if (didCloseAboveMax) {
          const firstCandleAbove = lastClosedCandle && (!prevClosedCandle || prevClosedCandle.close <= finalWMax);
          const secondCandleAbove = lastClosedCandle && prevClosedCandle && (prevClosedCandle.close > finalWMax) && (!prevClosedCandle2 || prevClosedCandle2.close <= finalWMax);
          isFreshBreakout = firstCandleAbove || secondCandleAbove;
        }

        // VISUAL ONLY: VOLUME RATIO (V17.2)
        let volumeRatio = 0;
        if (candles.length >= 22) {
          const prevCandlesForAvg = candles.slice(-22, -2);
          const avgVolume = prevCandlesForAvg.reduce((sum, c) => sum + c.volume, 0) / 20;
          const breakoutVolume = lastClosedCandle ? lastClosedCandle.volume : 0;
          volumeRatio = avgVolume > 0 ? breakoutVolume / avgVolume : 0;
        }

        let status: 'under' | 'over' | 'golden' | 'sniper' = 'under';
        
        // --- LOGIC: TRANSITION FROM PENDING TO VIP ---
        const isPending = pendingHunts.has(symbol);

        if (isBullish && isPending && didCloseAboveMax) {
          // PROMOTION: From Watchlist to VIP Elite
          status = (weeklyRange < 0.03) ? 'sniper' : 'golden';
          console.log(`\x1b[32m[VIP BREAKOUT] ${symbol} closed above (Pure Price Action). Promoting. [Visual Vol: ${volumeRatio.toFixed(2)}x]\x1b[0m`);
          pendingHunts.delete(symbol);
        } else if (isFirstCross && isBelowCeiling) {
          // INITIAL SCOUT: Add to Watchlist and track for breakout
          status = 'over';
          if (!isPending) {
            console.log(`\x1b[36m[SCOUT] ${symbol} registered for breakout monitoring.\x1b[0m`);
          }
        } else {
          // Check if it's already in Watchlist (resultsMap might have it)
          const prevStatus = resultsMap.get(symbol)?.status;
          if (prevStatus === 'over' && isBullish && !didCloseAboveMax) {
            status = 'over'; // Maintain scouting status
          }
        }

        // AUTO-PRUNE PENDING: If token is no longer bullish, forget it
        if (!isBullish && isPending) {
          pendingHunts.delete(symbol);
        }

        // --- CALC HISTORY FOR VISUALIZER (Last 50 points) ---
        const historyData: { vwap: number; ema: number }[] = [];
        const historyDepth = Math.min(candles.length, 50);
        for (let i = candles.length - historyDepth; i < candles.length; i++) {
          const slice = candles.slice(0, i + 1);
          // Calc vwap for "today" relative to this slice
          const sliceTodayCandles = slice.filter(c => c.openTime >= todayStartTs);
          let sPV = 0, sVol = 0;
          sliceTodayCandles.forEach(c => { sPV += ((c.high + c.low + c.close) / 3) * c.volume; sVol += c.volume; });
          const sliceVwap = sVol > 0 ? sPV / sVol : slice[slice.length-1].close;
          const sliceEma = calculateEMA(slice, 50);
          const slicePrice = slice[slice.length - 1].close;
          historyData.push({ vwap: sliceVwap, ema: sliceEma, price: slicePrice });
        }

        const tokenInfo: TokenInfo = {
          symbol,
          price: currentPrice,
          vwapDaily,
          ema50,
          vwapWeeklyMax: finalWMax,
          vwapWeeklyMin: finalWMin,
          weeklyRange: weeklyRange,
          change24h: liveData ? liveData.change24h : Number(t.priceChangePercent),
          status,
          isInsideStructure,
          isFreshBreakout, // Added for V17.5 UI
          volumeRatio: volumeRatio, // Visual meta only
          lastUpdated: new Date().toISOString(),
          history: historyData
        };

        if (status === 'over') {
          pendingHunts.set(symbol, tokenInfo);
        }

        const sIndex = stickyTokens.findIndex(s => s.symbol === symbol);
        const prevResult = resultsMap.get(symbol);
        
        // PERSISTENT CROSS TIME: If it's a cross, record it. If already crossing, keep the old time.
        if (isFirstCross) {
          tokenInfo.crossTime = new Date().toISOString();
        } else if (prevResult && (prevResult.status !== 'under')) {
          tokenInfo.crossTime = prevResult.crossTime;
        } else if (sIndex !== -1) {
          tokenInfo.crossTime = stickyTokens[sIndex].crossTime;
        }

        // UPDATE ELITE: If it is already in elite, update its live data (Price, PnL)
        if (sIndex !== -1) {
          const sticky = stickyTokens[sIndex];
          const originalStatus = sticky.status; 
          
          // Update the sticky object but KEEP the original Elite status and Fresh flag if it already has it
          stickyTokens[sIndex] = { 
            ...tokenInfo, 
            status: originalStatus, 
            isFreshBreakout: sticky.isFreshBreakout || tokenInfo.isFreshBreakout,
            crossTime: sticky.crossTime,
            entryPrice: sticky.entryPrice
          };
          
          if (tokenInfo.entryPrice) {
            tokenInfo.pnlFromCross = ((currentPrice - tokenInfo.entryPrice) / tokenInfo.entryPrice) * 100;
            // Also update the pnl on the sticky object itself
            stickyTokens[sIndex].pnlFromCross = tokenInfo.pnlFromCross;
          }
          await saveStickyTokens();
        } else if ((status === 'golden' || status === 'sniper') && sIndex === -1) {
          tokenInfo.crossTime = new Date().toISOString();
          tokenInfo.entryPrice = currentPrice;
          tokenInfo.pnlFromCross = 0;
          stickyTokens.push(tokenInfo);
          await saveStickyTokens();
          console.log(`\x1b[35m[ELITE/PUMP] ${status.toUpperCase()} signal for ${symbol} @ ${currentPrice}\x1b[0m`);
          sendTelegramAlert(tokenInfo);
        }

        // PRUNING: Only keep the "Now Crossing" active signals in the map
        if (status === 'under') {
          resultsMap.delete(symbol);
        } else {
          resultsMap.set(symbol, tokenInfo);
        }
        
        const allResults = Array.from(resultsMap.values());
        io.emit('tokens', allResults);
        io.emit('pending_updates', Array.from(pendingHunts.values()));
        io.emit('sticky_updates', stickyTokens);
        updatePerformanceStats(); // Emit stats updates
        renderTerminalDashboard(allResults, stickyTokens);
      }
    } catch (e: any) {
      if (e.response?.status === 429) {
        console.warn(`\x1b[31m[BAN PROTECTION] API limit close. Waiting 10s...\x1b[0m`);
        await new Promise(r => setTimeout(r, 10000));
      }
    }

    await new Promise(r => setTimeout(r, 50));
  }
}

function renderTerminalDashboard(allTokens: TokenInfo[], goldenTokens: TokenInfo[]) {
  const now = new Date().toLocaleTimeString();
  console.clear();
  console.log(`\x1b[35m┌──────────────────────────────────────────────────────────────────────────────┐\x1b[0m`);
  console.log(`\x1b[35m│\x1b[0m \x1b[1m\x1b[37m 🎯 CROSSE STEALTH SCOUT V8 PRO \x1b[0m  \x1b[32m[WS ACTIVE]\x1b[0m   \x1b[36mTime: ${now}\x1b[0m \x1b[35m│\x1b[0m`);
  console.log(`\x1b[35m└──────────────────────────────────────────────────────────────────────────────┘\x1b[0m`);

  if (goldenTokens.length > 0) {
    console.log(`\n\x1b[1m\x1b[33m  🏆 VIP ELITE SIGNALS (LAST 24H)\x1b[0m`);
    console.log(`  \x1b[90mSYMBOL      PRICE         TYPE       DIST %      TIME\x1b[0m`);
    console.log(`  \x1b[90m───────────────────────────────────────────────────────────\x1b[0m`);
    goldenTokens.slice(-6).forEach(t => {
      const typeStr = t.status === 'sniper' ? '\x1b[35mSNIPER\x1b[0m' : '\x1b[33mGOLDEN\x1b[0m';
      const dist = t.vwapWeeklyMax > 0 ? ((t.price - t.vwapWeeklyMax) / t.vwapWeeklyMax * 100).toFixed(2) : '0';
      const timeStr = t.crossTime ? t.crossTime.split('T')[1].slice(0,5) : '--:--';
      console.log(`  \x1b[1m\x1b[32m${t.symbol.padEnd(11)}\x1b[0m $${t.price.toString().padEnd(12)} ${typeStr.padEnd(14)} ${dist}%        ${timeStr}`);
    });
    console.log(`  \x1b[90m───────────────────────────────────────────────────────────\x1b[0m`);
  }

  const watchlist = allTokens
    .filter(t => t.status === 'over')
    .sort((a,b) => a.weeklyRange - b.weeklyRange)
    .slice(0, 10);

  console.log(`\n\x1b[1m\x1b[34m  ⚡ STEALTH WATCHLIST (LIVE WS)\x1b[0m`);
  console.log(`  \x1b[90mSYMBOL      PRICE         RANGE %     TREND       STATUS\x1b[0m`);
  console.log(`  \x1b[90m───────────────────────────────────────────────────────────\x1b[0m`);
  watchlist.forEach(t => {
    const rangeColor = t.weeklyRange < 0.01 ? '\x1b[32m' : (t.weeklyRange < 0.02 ? '\x1b[33m' : '\x1b[37m');
    console.log(`  ${t.symbol.padEnd(11)} $${t.price.toString().padEnd(12)} ${rangeColor}${(t.weeklyRange*100).toFixed(2)}%\x1b[0m       BULLISH     WAITING`);
  });
  console.log(`\n \x1b[90m 📡 ACTIVE: \x1b[37m${currentScanningSymbol} \x1b[90m| SESSION: \x1b[33m${scanSessionCount}/400 \x1b[90m| SPEED: 50ms\x1b[0m`);
  console.log(` \x1b[90m [STEALTH] Queue: ${tickerScanQueue.length} | Scout: ACTIVE | Status: RUNNING\x1b[0m`);
  console.log(` \x1b[90m [ENGINE] Monitoring: \x1b[33m${pendingHunts.size} Pending Breakouts\x1b[0m\n`);
}

app.post('/api/clear-sticky', (req, res) => {
  stickyTokens = [];
  resultsMap.clear();
  saveStickyTokens();
  io.emit('sticky_updates', []);
  res.json({ success: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
});

io.on('connection', (socket) => {
  socket.emit('sticky_updates', stickyTokens);
  socket.emit('pending_updates', Array.from(pendingHunts.values()));
  socket.emit('tokens', Array.from(resultsMap.values()));
  socket.emit('performance_stats', performanceStats);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\x1b[31m[ANTI-CRASH] Unhandled Rejection at:\x1b[0m', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('\x1b[31m[ANTI-CRASH] Uncaught Exception thrown:\x1b[0m', err);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\x1b[32m🦅 Crosse Stealth Scout V8 Pro listening on port ${PORT}\x1b[0m`);
  initBinanceWS();
  setTimeout(startStealthScanner, 5000);
});
