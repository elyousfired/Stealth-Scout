
async function fetchBinanceKlines(symbol, interval, limit) {
    try {
        const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return data.map(d => ({
            time: d[0],
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5]),
            quoteVolume: parseFloat(d[7])
        }));
    } catch (e) { return null; }
}

function getMondayTimestamp(ts) {
    const d = new Date(ts);
    const day = d.getUTCDay();
    const diff = (day === 0 ? 6 : day - 1);
    const mon = new Date(ts);
    mon.setUTCHours(0, 0, 0, 0);
    mon.setUTCDate(mon.getUTCDate() - diff);
    return mon.getTime();
}

function calculateEMA(prices, period) {
    if (prices.length < period) return 0;
    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
}

async function runStrategyAudit() {
    console.log("🚀 STARTING v7 GOLDEN SIGNAL DATA ANALYSIS...");
    console.log("📅 Period: Current Week (from Monday UTC)");
    console.log("--------------------------------------------------\n");

    const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
    const tickers = await res.json();
    const symbols = tickers
        .filter(t => t.symbol.endsWith('USDT'))
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 80) // Analysis on Top 80 for speed
        .map(t => t.symbol);

    const now = Date.now();
    const monTs = getMondayTimestamp(now);
    const signals = [];

    for (const symbol of symbols) {
        process.stdout.write(`Analyzing ${symbol}... `);
        const [k1d, k15m] = await Promise.all([
            fetchBinanceKlines(symbol, '1d', 30),
            fetchBinanceKlines(symbol, '15m', 1000)
        ]);

        if (!k1d || k1d.length < 10 || !k15m) {
            console.log("Failed to fetch data.");
            continue;
        }

        const dailyVwaps = k1d.map(k => (k.volume > 0 ? k.quoteVolume / k.volume : k.close));
        
        for (let i = 50; i < k15m.length; i++) {
            const k = k15m[i];
            const prevK = k15m[i-1];
            
            // Only analyze signals within current week
            if (k.time < monTs) continue;

            const dayTs = new Date(k.time).setUTCHours(0,0,0,0);
            
            // Calculate Weekly Levels up to this candle's day (excluding current day)
            let wMax = -Infinity, wMin = Infinity;
            k1d.forEach((dk, idx) => {
                if (getMondayTimestamp(dk.time) === monTs && dk.time < dayTs) {
                    if (dailyVwaps[idx] > wMax) wMax = dailyVwaps[idx];
                    if (dailyVwaps[idx] < wMin) wMin = dailyVwaps[idx];
                }
            });

            if (wMax === -Infinity) continue;

            // EMA 50 (approx from 15m)
            const recentPrices = k15m.slice(i - 50, i + 1).map(x => x.close);
            const ema50 = calculateEMA(recentPrices, 50);

            // Vol Spike (1.5x of previous 10)
            const recentVols = k15m.slice(i - 11, i).map(x => x.volume);
            const avgVol = recentVols.reduce((a, b) => a + b, 0) / 10;
            const volRatio = avgVol > 0 ? k.volume / avgVol : 1;

            // Range
            const weeklyRange = (wMax - wMin) / k.close;

            // SIGNAL CONDITIONS
            const isBreakout = prevK.close <= wMax && k.close > wMax;
            const isTight = weeklyRange < 0.07;
            const isVolSpike = volRatio >= 1.5;
            const isAboveEMA = k.close > ema50;

            if (isBreakout && isTight && isVolSpike && isAboveEMA) {
                // Tracking future performance (Max Peak in next 150 candles ~ 37 hours)
                let peak = k.close;
                for (let j = i + 1; j < Math.min(i + 150, k15m.length); j++) {
                    if (k15m[j].high > peak) peak = k15m[j].high;
                }
                const gain = ((peak - k.close) / k.close) * 100;

                signals.push({
                    symbol,
                    time: new Date(k.time).toISOString().slice(5, 16),
                    entry: k.close,
                    peak,
                    gain,
                    range: weeklyRange * 100,
                    type: weeklyRange < 0.03 ? 'GOLDEN' : 'SIGNAL'
                });
                
                // Jump forward to avoid redundant signals on same pump
                i += 20; 
            }
        }
        console.log("Done.");
    }

    // Save full results to JSON
    const fs = await import('fs');
    fs.writeFileSync('audit_signals.json', JSON.stringify(signals, null, 2));

    // --- AGGREGATION ---
    const golden = signals.filter(s => s.type === 'GOLDEN');
    const regular = signals.filter(s => s.type === 'SIGNAL');

    const stats = (arr) => ({
        count: arr.length,
        avgGain: arr.length > 0 ? arr.reduce((s, x) => s + x.gain, 0) / arr.length : 0,
        winRate: (arr.filter(x => x.gain > 2).length / (arr.length || 1)) * 100,
        tripleWin: (arr.filter(x => x.gain > 5).length / (arr.length || 1)) * 100
    });

    const gStats = stats(golden);
    const rStats = stats(regular);

    console.log("\n\n" + "=".repeat(50));
    console.log("📊 ANALYSIS RESULTS (Current Week Audit)");
    console.log("=".repeat(50));
    console.log(`TOTAL SIGNALS DETECTED: ${signals.length}`);
    console.log("\n--- GOLDEN SIGNALS (<3% Range) ---");
    console.log(`Count: ${gStats.count}`);
    console.log(`Avg Max Gain: +${gStats.avgGain.toFixed(2)}%`);
    console.log(`Win Rate (>2%): ${gStats.winRate.toFixed(1)}%`);
    console.log(`Home Run (>5%): ${gStats.tripleWin.toFixed(1)}%`);

    console.log("\n--- REGULAR SIGNALS (3-7% Range) ---");
    console.log(`Count: ${rStats.count}`);
    console.log(`Avg Max Gain: +${rStats.avgGain.toFixed(2)}%`);
    console.log(`Win Rate (>2%): ${rStats.winRate.toFixed(1)}%`);

    console.log("\n--- TOP 5 PERFORMANCE ---");
    signals.sort((a,b) => b.gain - a.gain).slice(0, 5).forEach((s, idx) => {
        console.log(`${idx+1}. ${s.symbol} (${s.type}) Entry: $${s.entry} | Peak: +${s.gain.toFixed(2)}% | Date: ${s.time}`);
    });
    console.log("=".repeat(50));
}

runStrategyAudit();
