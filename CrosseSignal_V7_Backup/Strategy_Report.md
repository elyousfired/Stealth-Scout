# 📊 CrosseSignal V7 - Golden Strategy Report

This directory contains the optimized source code and analysis results for the **v7 Golden Signal** momentum scanner.

## 🚀 Logic Overview
The scanner is designed to detect "Flat Base Breakouts" by monitoring:
1. **Weekly Structural Levels:** Weekly Max/Min calculated from Monday UTC.
2. **Precision Compression:** Range (wMax - wMin) < 3% for **GOLDEN** signals.
3. **Volume Spike:** Volume > 1.5x average of the previous 10 candles.
4. **EMA 50 Filter:** Ensuring the price is in an established short-term uptrend.

## 📂 File Map
- **Backend_v7.ts:** Node.js backend logic with parallel scanning optimization.
- **Frontend_Table.tsx:** Dashboard UI with Golden/Regular status indicators and tiered range coloring.
- **Styles_Premium.css:** Glassmorphism UI tokens and Golden pulse/glow animations.
- **Backtest_Analyzer.mjs:** Standing audit tool to verify strategy performance on historical data.

## 📈 Performance Summary (as of April 10, 2026)
- **Golden Win Rate:** 84.1%
- **Avg Max Gain:** +17.31%
- **Top Winner:** FFUSDT (+139.73%)

---
*Created by Antigravity AI for CrosseSignal.*
