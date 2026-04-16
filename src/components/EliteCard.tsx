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
  volumeRatio?: number;
  history?: { vwap: number; ema: number; price: number }[];
}

interface Props {
  token: TokenInfo;
}

const EliteCard: React.FC<Props> = ({ token }) => {
  const isSniper = token.status === 'sniper';
  const borderColor = isSniper ? 'var(--sniper)' : 'var(--golden)';
  const glowColor = isSniper ? 'var(--sniper-glow)' : 'var(--golden-glow)';
  
  // Calculate price position in range for visualization
  const rangeWidth = token.vwapWeeklyMax - token.vwapWeeklyMin;
  const pricePos = rangeWidth > 0 
    ? ((token.price - token.vwapWeeklyMin) / rangeWidth) * 100 
    : 100;

  return (
    <div className="glass-card animate-slide-in" style={{ 
      border: `1px solid ${borderColor}`,
      boxShadow: `0 10px 40px ${glowColor}`,
      padding: '1.5rem',
      minWidth: '300px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h2 className="symbol-font" style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fff' }}>
            {token.symbol}
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <div className={`badge ${isSniper ? 'badge-sniper' : 'badge-golden'}`}>
              {isSniper ? '🎯 SNIPER' : '✨ GOLDEN'}
            </div>
            {token.isInsideStructure && (
              <div className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', border: '1px solid var(--success)' }}>
                ⚖️ EQ
              </div>
            )}
            {token.volumeRatio !== undefined && (
              <div className="badge" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid #38bdf8' }}>
                📊 VOL {token.volumeRatio.toFixed(1)}x
              </div>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff', fontFamily: 'monospace' }}>
            ${token.price < 1 ? token.price.toFixed(6) : token.price.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.875rem', color: (token.pnlFromCross || 0) >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
            {(token.pnlFromCross || 0) >= 0 ? '+' : ''}{(token.pnlFromCross || 0).toFixed(2)}% (Signal)
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
            Entry: ${token.entryPrice ? (token.entryPrice < 1 ? token.entryPrice.toFixed(6) : token.entryPrice.toFixed(2)) : '--'}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <StructureVisualizer 
            history={token.history || []} 
            vwapMax={token.vwapWeeklyMax} 
            vwapMin={token.vwapWeeklyMin} 
            width={260} 
            height={60} 
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>Floor</span>
          <span>Momentum Breakout</span>
          <span>Ceiling</span>
        </div>
        <div className="range-container" style={{ width: '100%', height: '8px' }}>
          <div className="range-fill" style={{ 
            width: '100%', 
            background: `linear-gradient(90deg, rgba(255,255,255,0.1), ${borderColor})` 
          }}></div>
          <div className="range-marker" style={{ left: `${Math.min(100, Math.max(0, pricePos))}%` }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.4rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>
          <span>${token.vwapWeeklyMin.toFixed(token.vwapWeeklyMin < 1 ? 4 : 2)}</span>
          <span style={{ color: borderColor }}>SQUEEZE: {(token.weeklyRange * 100).toFixed(2)}%</span>
          <span>${token.vwapWeeklyMax.toFixed(token.vwapWeeklyMax < 1 ? 4 : 2)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
           DETECTED: <span style={{ color: '#fff' }}>{token.crossTime ? new Date(token.crossTime).toLocaleDateString([], { month: '2-digit', day: '2-digit' }) + ' ' + new Date(token.crossTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--/-- --:--'}</span>
        </div>
        <a 
          href={`https://www.tradingview.com/chart/?symbol=BINANCE:${token.symbol}`} 
          target="_blank" 
          rel="noreferrer"
          style={{ 
            fontSize: '0.75rem', 
            color: 'var(--primary)', 
            textDecoration: 'none', 
            fontWeight: '700', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.25rem' 
          }}
        >
          VIEW CHART ↗
        </a>
      </div>
    </div>
  );
};

export default EliteCard;
