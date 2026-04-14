// src/App.tsx
import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import TokenTable from '@/components/TokenTable';
import EliteCard from '@/components/EliteCard';
import PendingCard from '@/components/PendingCard';
import LoadingSpinner from '@/components/LoadingSpinner';

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
  history?: { vwap: number; ema: number; price: number }[];
}

interface ScannerStatus {
  symbol: string;
  count: number;
  total: number;
}

const socket: Socket = io();

const App: React.FC = () => {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [stickyTokens, setStickyTokens] = useState<TokenInfo[]>([]);
  const [pendingTokens, setPendingTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus | null>(null);

  useEffect(() => {
    socket.on('tokens', (data: TokenInfo[]) => {
      setTokens(data);
      setLoading(false);
    });
    socket.on('sticky_updates', (data: TokenInfo[]) => setStickyTokens(data));
    socket.on('pending_updates', (data: TokenInfo[]) => setPendingTokens(data));
    socket.on('scanner_status', (data: ScannerStatus) => setScannerStatus(data));
    return () => {
      socket.off('tokens');
      socket.off('sticky_updates');
      socket.off('pending_updates');
      socket.off('scanner_status');
    };
  }, []);

  const clearSticky = async () => {
    await fetch('/api/clear-sticky', { method: 'POST' });
  };

  const eliteSignals = stickyTokens.filter(t => t.status === 'golden' || t.status === 'sniper');
  const liveWatchlist = tokens.filter(t => t.status === 'over').slice(0, 20);

  return (
    <div className="app-container">
      {/* SIDEBAR - Visual Branding */}
      <aside style={{ 
        background: 'rgba(15, 23, 42, 0.9)', 
        borderRight: '1px solid var(--pc-border)',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🦅</div>
          <h1 className="symbol-font" style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em', color: '#fff' }}>HYPER<br/>SNIPER</h1>
        </div>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '2rem' }}>
          <div style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', fontWeight: '700', fontSize: '0.9rem' }}>📊 DASHBOARD</div>
          <div style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', color: 'var(--text-dim)', fontWeight: '500', fontSize: '0.9rem' }}>🎯 TARGETS</div>
          <div style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', color: 'var(--text-dim)', fontWeight: '500', fontSize: '0.9rem' }}>📈 BOT ANALYTICS</div>
          <div style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', color: 'var(--text-dim)', fontWeight: '500', fontSize: '0.9rem' }}>⚙️ SETTINGS</div>
        </nav>

        <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>CONNECTION STATUS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--success)' }}>
            <span className="pulse-dot" style={{ backgroundColor: 'var(--success)', margin: 0 }}></span> LIVE WS ACTIVE
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-content">
        {/* KPI HEADER */}
        <div className="kpi-grid">
          <div className="kpi-item">
            <div className="kpi-label">Tokens Scanned</div>
            <div className="kpi-value">{tokens.length}</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">Elite Signals</div>
            <div className="kpi-value" style={{ color: 'var(--sniper)' }}>{eliteSignals.length}</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">Compression Zone</div>
            <div className="kpi-value" style={{ color: 'var(--golden)' }}>
              {tokens.filter(t => t.isInsideStructure).length}
            </div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">Scanner Speed</div>
            <div className="kpi-value">50ms</div>
          </div>
        </div>

        {/* LIVE SCANNER BAR */}
        {scannerStatus && (
          <div className="glass-card" style={{ 
            marginBottom: '1.5rem', 
            padding: '0.75rem 1.5rem', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
            borderColor: 'rgba(99, 102, 241, 0.2)',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 1 }}>
              <div style={{ 
                width: '10px', 
                height: '10px', 
                background: 'var(--primary)', 
                borderRadius: '50%', 
                boxShadow: '0 0 15px var(--primary)',
                animation: 'pulse 1s infinite'
              }}></div>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                <span style={{ color: 'var(--text-dim)', marginRight: '0.5rem' }}>ACTIVE SCAN:</span>
                <span className="symbol-font" style={{ color: '#fff', fontSize: '1rem' }}>{scannerStatus.symbol}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', zIndex: 1 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>PROGRESS</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '800' }}>{scannerStatus.count} <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>/ {scannerStatus.total}</span></div>
              </div>
              <div style={{ width: '120px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${(scannerStatus.count / scannerStatus.total) * 100}%`, 
                  height: '100%', 
                  background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
                  transition: 'width 0.1s ease-out'
                }}></div>
              </div>
            </div>

            {/* Subtle background glow effect */}
            <div style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)', 
              width: '100%', 
              height: '100%', 
              background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.05) 0%, transparent 70%)',
              pointerEvents: 'none'
            }}></div>
          </div>
        )}

        {/* ELITE SIGNALS FEED */}
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: 'var(--sniper)' }}>🏆</span> VIP ELITE SIGNALS
            </h2>
            <button onClick={clearSticky} style={{ 
              background: 'rgba(244, 63, 94, 0.1)', 
              color: 'var(--danger)', 
              border: '1px solid rgba(244, 63, 94, 0.2)',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}>CLEAR SIGNALS</button>
          </div>
          
          {eliteSignals.length > 0 ? (
            <div style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', paddingBottom: '1rem' }}>
              {eliteSignals.map(token => (
                <EliteCard key={token.symbol} token={token} />
              ))}
            </div>
          ) : (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
               WAITTING FOR HIGH-PROBABILITY SNIPER SQUEEZE...
            </div>
          )}
        </section>

        {/* BREAKOUT WATCH (PENDING) SECTION */}
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-dim)' }}>
              <span style={{ color: 'var(--primary)', animation: 'pulse 2s infinite' }}>🎯</span> BREAKOUT WATCH (PENDING CLOSE)
            </h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: '600' }}>
              WAITING FOR 15M CANDLE CLOSE CONFIRMATION...
            </div>
          </div>
          
          {pendingTokens.length > 0 ? (
            <div style={{ display: 'flex', gap: '1.25rem', overflowX: 'auto', paddingBottom: '1rem' }}>
              {pendingTokens.sort((a,b) => {
                const dA = ((a.vwapWeeklyMax - a.price)/a.vwapWeeklyMax);
                const dB = ((b.vwapWeeklyMax - b.price)/b.vwapWeeklyMax);
                return dA - dB;
              }).map(token => (
                <PendingCard key={token.symbol} token={token} />
              ))}
            </div>
          ) : (
            <div style={{ padding: '1.5rem', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'rgba(255,255,255,0.2)' }}>
              NO ACTIVE BREAKOUTS CURRENTLY MONITORED
            </div>
          )}
        </section>

        {/* LIVE WATCHLIST SECTION */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: 'var(--primary)' }}>⚡</span> STEALTH SCOUT WATCHLIST
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: '500' }}>
              Monitoring 400 symbol breakouts...
            </div>
          </div>
          
          <div className="glass-card" style={{ padding: '1rem' }}>
            {loading ? <LoadingSpinner /> : <TokenTable tokens={liveWatchlist} />}
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
