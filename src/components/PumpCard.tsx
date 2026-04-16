import React from 'react';
import StructureVisualizer from './StructureVisualizer';

interface TokenInfo {
  symbol: string;
  price: number;
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
  token: TokenInfo;
}

const PumpCard: React.FC<Props> = ({ token }) => {
  // Calculate price position in range for visualization
  const rangeWidth = token.vwapWeeklyMax - token.vwapWeeklyMin;
  const pricePos = rangeWidth > 0 
    ? ((token.price - token.vwapWeeklyMin) / rangeWidth) * 100 
    : 100;

  return (
    <div className="glass-card animate-pulse" style={{ 
      border: `2px solid #22c55e`,
      boxShadow: `0 0 30px rgba(34, 197, 94, 0.3)`,
      padding: '1.25rem',
      minWidth: '280px',
      background: 'rgba(20, 83, 45, 0.1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <span style={{ fontSize: '1.2rem' }}>🚀</span>
             <h2 className="symbol-font" style={{ fontSize: '1.4rem', fontWeight: '900', color: '#fff' }}>
               {token.symbol}
             </h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
            <div className="badge" style={{ background: '#22c55e', color: '#000', fontWeight: '900', border: 'none' }}>
              PUMP CHANCE
            </div>
            <div className="badge" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.65rem' }}>
              ENTRY: {token.crossTime ? new Date(token.crossTime).toLocaleDateString([], { month: '2-digit', day: '2-digit' }) + ' ' + new Date(token.crossTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'NOW'}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: '900', color: (token.pnlFromCross || 0) >= 0 ? '#22c55e' : '#f43f5e', textShadow: '0 0 10px rgba(0,0,0,0.5)' }}>
            {(token.pnlFromCross || 0) >= 0 ? '+' : ''}{(token.pnlFromCross || 0).toFixed(2)}%
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold' }}>
             PRICE: ${token.price < 1 ? token.price.toFixed(6) : token.price.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>
             ENTRY @ ${token.entryPrice ? (token.entryPrice < 1 ? token.entryPrice.toFixed(6) : token.entryPrice.toFixed(2)) : 'INIT'}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
          <StructureVisualizer 
            history={token.history || []} 
            vwapMax={token.vwapWeeklyMax} 
            vwapMin={token.vwapWeeklyMin} 
            width={240} 
            height={50} 
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
          <span>Breakout</span>
          <span style={{ color: '#22c55e' }}>Explosion Zone</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
        <div style={{ color: 'rgba(255,255,255,0.5)' }}>
           RANGE SQUEEZE: <span style={{ color: '#fff' }}>{(token.weeklyRange * 100).toFixed(2)}%</span>
        </div>
        <a 
          href={`https://www.tradingview.com/chart/?symbol=BINANCE:${token.symbol}`} 
          target="_blank" 
          rel="noreferrer"
          style={{ color: '#22c55e', textDecoration: 'none', fontWeight: 'bold' }}
        >
          OPEN CHART ↗
        </a>
      </div>
    </div>
  );
};

export default PumpCard;
