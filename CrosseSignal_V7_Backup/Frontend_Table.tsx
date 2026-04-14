// src/components/TokenTable.tsx
import React from 'react';

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
  crossTime?: string;
}

interface Props {
  tokens: TokenInfo[];
}

const TokenTable: React.FC<Props> = ({ tokens }) => {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Price</th>
          <th>Daily Change</th>
          <th>VWAP (Daily)</th>
          <th>EMA‑50</th>
          <th>wMax (Wk)</th>
          <th>wMin (Wk)</th>
          <th>Range %</th>
          <th>Vol Ratio</th>
          <th>Status</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        {tokens.map((t) => (
          <tr
            key={t.symbol}
            className={
              t.status === 'under'
                ? 'status-under'
                : t.status === 'over'
                ? 'status-over'
                : t.status === 'golden'
                ? 'status-golden'
                : t.status === 'cross'
                ? 'status-cross'
                : ''
            }
          >
            <td>{t.symbol}</td>
            <td>{t.price.toFixed(4)}</td>
            <td style={{ color: t.change24h >= 0 ? '#00ff00' : '#ff3333', fontWeight: 'bold' }}>
              {t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(2)}%
            </td>
            <td>{t.vwapDaily.toFixed(4)}</td>
            <td>{t.ema50.toFixed(4)}</td>
            <td>{t.vwapWeeklyMax.toFixed(4)}</td>
            <td>{t.vwapWeeklyMin.toFixed(4)}</td>
            <td style={{ 
              color: (t.weeklyRange || 0) < 0.03 ? '#fcd34d' : (t.weeklyRange || 0) < 0.07 ? '#67e8f9' : '#94a3b8',
              fontWeight: (t.weeklyRange || 0) < 0.07 ? 'bold' : 'normal'
            }}>
              {((t.weeklyRange || 0) * 100).toFixed(1)}%
            </td>
            <td style={{ color: (t.volRatio || 0) >= 1.5 ? '#f472b6' : '#94a3b8' }}>
              {(t.volRatio || 0).toFixed(1)}x
            </td>
            <td>
              {t.status === 'golden' ? (
                <span className="badge-golden">GOLDEN</span>
              ) : t.status === 'cross' ? (
                <span className="badge-cross">SIGNAL</span>
              ) : (
                t.status || 'under'
              )}
            </td>
            <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {t.crossTime ? new Date(t.crossTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default TokenTable;
