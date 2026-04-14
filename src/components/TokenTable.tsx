// src/components/TokenTable.tsx
import React from 'react';
import StructureVisualizer from './StructureVisualizer';

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
  crossTime?: string;
  history?: { vwap: number; ema: number; price: number }[];
}

interface Props {
  tokens: TokenInfo[];
}

const formatNum = (val: any, dec: number = 2) => {
  if (val === null || val === undefined) return '-';
  if (isNaN(val)) return 'NaN';
  return Number(val).toFixed(dec);
};

const TokenTable: React.FC<Props> = ({ tokens }) => {
  return (
    <div className="pro-table-container">
      <table className="pro-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Live Price</th>
            <th>Performance</th>
            <th>VWAP Context</th>
            <th>Range Activity</th>
            <th>Status</th>
            <th>Signal Time</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((t) => {
            const rangeWidth = t.vwapWeeklyMax - t.vwapWeeklyMin;
            const pricePos = rangeWidth > 0 
              ? ((t.price - t.vwapWeeklyMin) / rangeWidth) * 100 
              : 100;

            const displayPnl = t.pnlFromCross !== undefined ? t.pnlFromCross : t.change24h;
            const isSignalPnl = t.pnlFromCross !== undefined;

            return (
              <tr key={t.symbol} className="animate-slide-in">
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ 
                      width: '32px', height: '32px', 
                      background: 'rgba(255,255,255,0.05)', 
                      borderRadius: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)'
                    }}>
                      {t.symbol.charAt(0)}
                    </div>
                    <span className="symbol-font" style={{ fontWeight: '700', fontSize: '1rem' }}>{t.symbol}</span>
                  </div>
                </td>
                <td style={{ fontFamily: 'monospace', fontWeight: '600' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>${t.price < 1 ? formatNum(t.price, 6) : formatNum(t.price, 2)}</span>
                    {t.entryPrice && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Entry: ${t.entryPrice < 1 ? formatNum(t.entryPrice, 6) : formatNum(t.entryPrice, 2)}</span>
                    )}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ 
                      color: displayPnl >= 0 ? 'var(--success)' : 'var(--danger)',
                      fontWeight: '700',
                      fontSize: '0.875rem'
                    }}>
                      {displayPnl >= 0 ? '+' : ''}{formatNum(displayPnl)}%
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                      {isSignalPnl ? 'From Signal' : '24h Chg'}
                    </span>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '220px' }}>
                    <StructureVisualizer 
                      history={t.history || []} 
                      vwapMax={t.vwapWeeklyMax} 
                      vwapMin={t.vwapWeeklyMin} 
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                      <span>EMA: {formatNum(t.ema50, 4)}</span>
                      <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>VWAP: {formatNum(t.vwapDaily, 4)}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '120px' }}>
                    <div className="range-container">
                      <div className="range-fill" style={{ width: '100%', background: 'rgba(255,255,255,0.1)' }}></div>
                      <div className="range-marker" style={{ left: `${Math.min(100, Math.max(0, pricePos))}%` }}></div>
                    </div>
                    <div style={{ fontSize: '0.65rem', color: t.weeklyRange < 0.03 ? 'var(--golden)' : 'var(--text-dim)', fontWeight: '700' }}>
                      SQUEEZE: {formatNum(t.weeklyRange * 100, 2)}%
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span className={`badge ${t.status === 'sniper' ? 'badge-sniper' : t.status === 'golden' ? 'badge-golden' : 'badge-over'}`}>
                      {t.status.toUpperCase()}
                    </span>
                    {t.isInsideStructure && (
                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.2rem 0.4rem', fontSize: '0.65rem' }}>
                        EQ
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: '600' }}>
                  {t.crossTime ? t.crossTime.split('T')[1].slice(0, 5) : '--:--'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TokenTable;
