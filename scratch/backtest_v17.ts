import axios from 'axios';

const BINANCE_API = 'https://fapi.binance.com';
const MONDAY_START = new Date("2026-04-06T00:00:00Z").getTime();
const SUNDAY_END = new Date("2026-04-12T23:59:59Z").getTime();

interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function calculateEMA(candles: Candle[], period: number = 50): number {
  if (candles.length < period) return candles[candles.length - 1]?.close || 0;
  let ema = candles.slice(0, period).reduce((sum, c) => sum + c.close, 0) / period;
  const multiplier = 2 / (period + 1);
  for (let i = period; i < candles.length; i++) {
    ema = (candles[i].close - ema) * multiplier + ema;
  }
  return ema;
}

async function runBacktest() {
  console.log(`\x1b[35m[BACKTEST] Starting simulation for week: April 6 - April 12, 2026...\x1b[0m`);
  
  try {
    const { data: tickers } = await axios.get(`${BINANCE_API}/fapi/v1/ticker/24hr`);
    const usdtPairs = tickers
      .filter((t: any) => t.symbol.endsWith('USDT'))
      .sort((a: any, b: any) => Number(b.quoteVolume) - Number(a.quoteVolume))
      .slice(0, 150); // Test top 150 for deeper insight

    const totalStats = {
      totalSignals: 0,
      wins: 0,
      losses: 0,
      avgPump: 0,
      trades: [] as any[]
    };

    for (const ticker of usdtPairs) {
      const symbol = ticker.symbol;
      const { data: rawKlines } = await axios.get(`${BINANCE_API}/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=1000`);
      const candles: Candle[] = rawKlines.map((c: any) => ({
        openTime: c[0], open: Number(c[1]), high: Number(c[2]), low: Number(c[3]), close: Number(c[4]), volume: Number(c[5])
      }));

      let weeklyMax = -Infinity;
      let weeklyMin = Infinity;
      let monitoringForBreakout = false;
      let lastCrossIndex = -1;

      for (let i = 50; i < candles.length; i++) {
        const c = candles[i];
        if (c.openTime < MONDAY_START) continue;
        if (c.openTime > SUNDAY_END) break;

        const currentWeeklyMax = weeklyMax; // Max BEFORE this candle
        
        // Update Weekly Structure for NEXT candles
        weeklyMax = Math.max(weeklyMax, c.high);
        weeklyMin = Math.min(weeklyMin, c.low);

        if (weeklyMax === -Infinity) continue;

        // Daily VWAP at this step
        const todayStart = new Date(c.openTime).setUTCHours(0,0,0,0);
        const todayCandles = candles.slice(0, i + 1).filter(can => can.openTime >= todayStart);
        let sumPV = 0, sumVol = 0;
        todayCandles.forEach(can => { sumPV += ((can.high + can.low + can.close)/3) * can.volume; sumVol += can.volume; });
        const vwap = sumVol > 0 ? sumPV / sumVol : c.close;

        // EMA 50
        const ema = calculateEMA(candles.slice(0, i + 1), 50);

        // Pre-Cross Logic
        const prevTodayCandles = candles.slice(0, i).filter(can => can.openTime >= todayStart);
        let pSumPV = 0, pSumVol = 0;
        prevTodayCandles.forEach(can => { pSumPV += ((can.high+can.low+can.close)/3)*can.volume; pSumVol += can.volume; });
        const prevVwap = pSumVol > 0 ? pSumPV / pSumVol : candles[i-1].close;
        const prevEma = calculateEMA(candles.slice(0, i), 50);

        const isBullish = vwap > ema;
        const wasBullish = prevVwap > prevEma;
        const isFirstCross = !wasBullish && isBullish;

        if (isFirstCross && vwap <= currentWeeklyMax) {
          monitoringForBreakout = true;
        }

        // Breakout Validation (VIP Elite) - COMPARING AGAINST PREVIOUS MAX
        if (monitoringForBreakout && c.close > currentWeeklyMax && vwap > ema && currentWeeklyMax !== -Infinity) {
          const entryPrice = c.close;
          const entryTime = new Date(c.openTime).toISOString();
          
          totalStats.totalSignals++;
          monitoringForBreakout = false; // Reset monitoring till next cross

          // Performance outcome (Look 24h ahead)
          let maxPriceAfter = entryPrice;
          let success = false;
          for (let j = i + 1; j < Math.min(i + 96, candles.length); j++) {
            maxPriceAfter = Math.max(maxPriceAfter, candles[j].high);
            const currentEma = calculateEMA(candles.slice(0, j + 1), 50);
            
            if (candles[j].close > entryPrice * 1.03) {
              success = true;
              break;
            }
            if (candles[j].close < currentEma) break; // Trailing Stop
          }

          const pump = ((maxPriceAfter - entryPrice) / entryPrice) * 100;
          if (success) totalStats.wins++; else totalStats.losses++;
          totalStats.avgPump += pump;

          totalStats.trades.push({ symbol, entryTime, pump: pump.toFixed(2) + '%', outcome: success ? 'WIN' : 'FAIL' });
        }
      }
    }

    const winRate = (totalStats.wins / (totalStats.totalSignals || 1)) * 100;
    console.log(`\n\x1b[32m[REPORT] Simulations Complete!\x1b[0m`);
    console.log(`\x1b[1mTotal Signals: ${totalStats.totalSignals}\x1b[0m`);
    console.log(`\x1b[32mWins: ${totalStats.wins}\x1b[0m | \x1b[31mLosses: ${totalStats.losses}\x1b[0m`);
    console.log(`\x1b[33mWin Rate: ${winRate.toFixed(2)}%\x1b[0m`);
    console.log(`\x1b[36mAverage Max Pump: ${(totalStats.avgPump / (totalStats.totalSignals || 1)).toFixed(2)}%\x1b[0m\n`);

    console.table(totalStats.trades.slice(-20));

  } catch (err: any) {
    console.error("Backtest failed:", err.message);
  }
}

runBacktest();
