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
  status: string;
  volumeRatio?: number;
  history?: { vwap: number; ema: number; price: number }[];
}

interface Props {
  token: TokenInfo;
}

const PendingCard: React.FC<Props> = ({ token }) => {
  const distToMax = token.vwapWeeklyMax > 0 
    ? ((token.vwapWeeklyMax - token.price) / token.vwapWeeklyMax) * 100 
    : 0;

  return (
    <div className="glass-card animate-slide-in" style={{ 
      padding: '1rem', 
      minWidth: '220px', 
      border: '1px border rgba(255, 255, 255, 0.05)',
      background: 'rgba(15, 23, 42, 0.4)',
      borderColor: 'rgba(99, 102, 241, 0.1)',
      position: 'relative'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 className="symbol-font" style={{ fontSize: '1rem', color: '#fff' }}>{token.symbol}</h3>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {token.volumeRatio !== undefined && (
             <div style={{ fontSize: '0.6rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
               {token.volumeRatio.toFixed(1)}x VOL
             </div>
          )}
          <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 'bold', background: 'rgba(99, 102, 241, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
            MONITORING
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <StructureVisualizer 
          history={token.history || []} 
          vwapMax={token.vwapWeeklyMax} 
          vwapMin={token.vwapWeeklyMin} 
          width={180} 
          height={40} 
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fff', fontFamily: 'monospace' }}>
            ${token.price < 1 ? token.price.toFixed(6) : token.price.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Current Price</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '800', color: distToMax < 1 ? 'var(--success)' : 'var(--text-dim)' }}>
            {distToMax.toFixed(2)}%
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>To Max</div>
        </div>
      </div>

      {distToMax < 0.5 && (
        <div className="pulse-dot" style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: 'var(--success)' }}></div>
      )}
    </div>
  );
};

export default PendingCard;
