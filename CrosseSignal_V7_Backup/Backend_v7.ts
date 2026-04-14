import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import axios from 'axios';
import cron from 'node-cron';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const BINANCE_API = 'https://fapi.binance.com';
const TOP_N = 200; // number of symbols to scan
const STICKY_FILE = path.join(process.cwd(), 'sticky_tokens.json');

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
  ema60: number;
  vwapWeeklyMax: number;
  vwapWeeklyMin: number;
  weeklyRange: number;
  volRatio: number;
  change24h: number;
  status: 'under' | 'over' | 'cross' | 'golden';
  lastUpdated?: string;
  crossTime?: string;
}

let stickyTokens: TokenInfo[] = [];

// Load sticky tokens on startup
if (fs.existsSync(STICKY_FILE)) {
  try {
    stickyTokens = JSON.parse(fs.readFileSync(STICKY_FILE, 'utf-8'));
    console.log(`Loaded ${stickyTokens.length} sticky tokens.`);
  } catch (e) {
    console.error('Error loading sticky tokens:', e);
  }
}

function saveStickyTokens() {
  try {
    fs.writeFileSync(STICKY_FILE, JSON.stringify(stickyTokens, null, 2));
  } catch (e) {
    console.error('Error saving sticky tokens:', e);
  }
}

// Helper to fetch 24h ticker data (price, symbol)
async function fetchTickers(): Promise<any[]> {
  const url = `${BINANCE_API}/fapi/v1/ticker/24hr`;
  const { data } = await axios.get(url);
  // Filter USDT pairs and sort by volume descending, take top N
  const usdtPairs = data.filter((t: any) => t.symbol.endsWith('USDT'));
  usdtPairs.sort((a: any, b: any) => Number(b.quoteVolume) - Number(a.quoteVolume));
  return usdtPairs.slice(0, TOP_N);
}

// Fetch 15‑min klines for a symbol (enough for EMA 50)
async function fetchCandles(symbol: string): Promise<Candle[]> {
  const url = `${BINANCE_API}/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=100`;
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

// Fetch 1‑day klines for weekly levels
async function fetchDailyCandles(symbol: string): Promise<Candle[]> {
  const url = `${BINANCE_API}/fapi/v1/klines?symbol=${symbol}&interval=1d&limit=30`;
  const { data } = await axios.get(url);
  return data.map((c: any) => ({
    openTime: c[0],
    open: Number(c[1]),
    high: Number(c[2]),
    low: Number(c[3]),
    close: Number(c[4]),
    volume: Number(c[5]),
    quoteVolume: Number(c[7]),
  }));
}

function getMondayTimestamp(ts: number) {
  const d = new Date(ts);
  const day = d.getUTCDay();
  const diff = (day === 0 ? 6 : day - 1);
  const mon = new Date(ts);
  mon.setUTCHours(0, 0, 0, 0);
  mon.setUTCDate(mon.getUTCDate() - diff);
  return mon.getTime();
}

function calculateVWAP(candles: Candle[]): number {
  const now = new Date();
  const startOfDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  );
  
  let pv = 0;
  let vol = 0;
  for (const c of candles) {
    if (c.openTime < startOfDay) continue; // Only daily candles for VWAP
    const typical = (c.high + c.low + c.close) / 3;
    pv += typical * c.volume;
    vol += c.volume;
  }
  return vol === 0 ? 0 : pv / vol;
}

function calculateEMA(candles: Candle[], period: number = 50): number {
  if (candles.length === 0) return 0;
  const initialPeriod = Math.min(period, candles.length);
  // start EMA with SMA of first available candles
  let ema = candles.slice(0, initialPeriod).reduce((sum, c) => sum + c.close, 0) / initialPeriod;
  const k = 2 / (period + 1);
  for (let i = initialPeriod; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
  }
  return ema;
}

async function scanAndEmit() {
  try {
    const tickers = await fetchTickers();
    const results: TokenInfo[] = [];
    let updatedSticky = false;

    // Process in chunks to avoid rate limits but stay fast
    const chunkSize = 15;
    for (let i = 0; i < tickers.length; i += chunkSize) {
      const chunk = tickers.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (t) => {
        const symbol = t.symbol;
        const price = Number(t.lastPrice);
        const [candles, dCandles] = await Promise.all([
          fetchCandles(symbol),
          fetchDailyCandles(symbol)
        ]);

        const vwapDaily = calculateVWAP(candles);
        const ema50 = calculateEMA(candles, 50);
        const ema60 = calculateEMA(candles, 60);
        
        // --- WEEKLY MAX/MIN CALCULATION (v7) ---
        const now = Date.now();
        const mondayTs = getMondayTimestamp(now);
        let vwapWeeklyMax = -Infinity;
        let vwapWeeklyMin = Infinity;

        const dailyVwaps = dCandles.map(k => (k.volume > 0 ? k.quoteVolume! / k.volume : k.close));
        dCandles.forEach((k, idx) => {
          if (idx < dCandles.length - 1 && getMondayTimestamp(k.openTime) === mondayTs) {
            if (dailyVwaps[idx] > vwapWeeklyMax) vwapWeeklyMax = dailyVwaps[idx];
            if (dailyVwaps[idx] < vwapWeeklyMin) vwapWeeklyMin = dailyVwaps[idx];
          }
        });

        if (vwapWeeklyMax === -Infinity) {
          vwapWeeklyMax = vwapDaily;
          vwapWeeklyMin = vwapDaily;
        }

        const weeklyRange = (vwapWeeklyMax - vwapWeeklyMin) / price;
        
        let status: TokenInfo['status'] = 'under';
        if (vwapDaily > ema50) status = 'over';
        
        let isBreakout = false;
        let volRatio = 1.0;
        
        if (candles.length >= 11) {
          const currentCandle = candles[candles.length - 1];
          const prevClose = candles[candles.length - 2].close;
          const currentClose = currentCandle.close;
          if (prevClose <= vwapWeeklyMax && currentClose > vwapWeeklyMax) {
            isBreakout = true;
          }
          const last10 = candles.slice(-11, -1);
          const avgVol = last10.reduce((sum, c) => sum + c.volume, 0) / 10;
          volRatio = avgVol > 0 ? currentCandle.volume / avgVol : 1.0;
        }

        if (vwapDaily > ema50 && isBreakout && volRatio >= 1.5 && weeklyRange < 0.07) {
          status = 'cross';
          if (weeklyRange < 0.03) status = 'golden';
        }
        
        const change24h = Number(t.priceChangePercent);
        const tokenInfo: TokenInfo = { 
          symbol, price, vwapDaily, ema50, ema60, vwapWeeklyMax, vwapWeeklyMin, weeklyRange, volRatio, 
          change24h, status, lastUpdated: new Date().toISOString() 
        };
        
        const stickyIndex = stickyTokens.findIndex(s => s.symbol === symbol);
        if (stickyIndex !== -1) {
          tokenInfo.crossTime = stickyTokens[stickyIndex].crossTime || stickyTokens[stickyIndex].lastUpdated;
          stickyTokens[stickyIndex] = tokenInfo;
          updatedSticky = true;
        }

        if (status === 'cross' || status === 'golden') {
          if (stickyIndex === -1) {
            tokenInfo.crossTime = new Date().toISOString();
            stickyTokens.push(tokenInfo);
            updatedSticky = true;
          }
        }

        results.push(tokenInfo);
      }));
    }

    if (updatedSticky) {
      saveStickyTokens();
      io.emit('sticky_updates', stickyTokens);
    }

    io.emit('tokens', results);
    console.log(`Emitted ${results.length} tokens at ${new Date().toISOString()}`);
  } catch (err) {
    console.error('Scan error:', err);
  }
}

app.post('/api/clear-sticky', (req, res) => {
  stickyTokens = [];
  saveStickyTokens();
  io.emit('sticky_updates', []);
  res.json({ success: true });
});

io.on('connection', (socket) => {
  console.log('Client connected', socket.id);
  socket.emit('sticky_updates', stickyTokens);
});

// Run initial scan then schedule every 5 minutes
scanAndEmit();
cron.schedule('*/5 * * * *', scanAndEmit);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Crosse Signal backend listening on http://localhost:${PORT}`);
});
