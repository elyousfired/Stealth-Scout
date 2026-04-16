// src/App.tsx
import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import TokenTable from '@/components/TokenTable';
import EliteCard from '@/components/EliteCard';
import PendingCard from '@/components/PendingCard';
import PumpCard from '@/components/PumpCard';
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
  volumeRatio?: number;
  isFreshBreakout?: boolean;
  history?: { vwap: number; ema: number; price: number }[];
}

interface ScannerStatus {
  symbol: string;
  count: number;
  total: number;
}

const socket: Socket = io(import.meta.env.PROD ? '/' : 'http://localhost:4000');

const App: React.FC = () => {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [stickyTokens, setStickyTokens] = useState<TokenInfo[]>([]);
  const [pendingTokens, setPendingTokens] = useState<TokenInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'signals' | 'watchlist'>('signals');
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

  const eliteSignals = stickyTokens
    .filter(t => (t.status === 'golden' || t.status === 'sniper') && !t.isFreshBreakout)
    .sort((a, b) => new Date(b.crossTime || 0).getTime() - new Date(a.crossTime || 0).getTime());

  const pumpSignals = stickyTokens
    .filter(t => t.isFreshBreakout)
    .sort((a, b) => new Date(b.crossTime || 0).getTime() - new Date(a.crossTime || 0).getTime());

  const liveWatchlist = tokens.filter(t => t.status === 'over');

  const navItemStyle = (tab: 'signals' | 'watchlist') => ({
    padding: '0.85rem 1.25rem',
    borderRadius: '0.75rem',
    background: activeTab === tab ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
    color: activeTab === tab ? 'var(--primary)' : 'var(--text-dim)',
    fontWeight: activeTab === tab ? '700' : '500',
    fontSize: '0.9rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    transition: 'all 0.2s ease',
    border: activeTab === tab ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent'
  });

  return (
    <div className="app-container">
      {/* SIDEBAR - Interactive Navigation (V17.9) */}
      <aside style={{ 
        background: 'rgba(15, 23, 42, 0.95)', 
        borderRight: '1px solid var(--pc-border)',
        padding: '2rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '2.5rem',
        width: '280px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '45px', height: '45px', background: 'var(--primary)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)' }}>🦅</div>
          <h1 className="symbol-font" style={{ fontSize: '1.4rem', fontWeight: '900', letterSpacing: '-0.02em', color: '#fff', lineHeight: '1.1' }}>STEALTH<br/>SCOUT</h1>
        </div>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div 
            onClick={() => setActiveTab('signals')}
            style={navItemStyle('signals')}
            className="nav-btn"
          >
            <span style={{ fontSize: '1.2rem' }}>🔥</span> LIVE SIGNALS FEED
          </div>
          <div 
            onClick={() => setActiveTab('watchlist')}
            style={navItemStyle('watchlist')}
            className="nav-btn"
          >
            <span style={{ fontSize: '1.2rem' }}>🛰️</span> GLOBAL WATCHLIST
          </div>
          
          <div style={{ margin: '1.5rem 0', height: '1px', background: 'rgba(255,255,255,0.05)' }}></div>
          
          <div style={{ padding: '0.75rem 1.25rem', borderRadius: '0.75rem', color: 'var(--text-dim)', fontWeight: '500', fontSize: '0.85rem', opacity: 0.5 }}>📈 PERFORMANCE</div>
          <div style={{ padding: '0.75rem 1.25rem', borderRadius: '0.75rem', color: 'var(--text-dim)', fontWeight: '500', fontSize: '0.85rem', opacity: 0.5 }}>⚙️ PREFERENCES</div>
        </nav>

        <div style={{ marginTop: 'auto', padding: '1.25rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '1.25rem', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.75rem', fontWeight: '800', letterSpacing: '0.05em' }}>ENGINE STATUS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--success)' }}>
            <span className="pulse-dot" style={{ backgroundColor: 'var(--success)', margin: 0, width: '8px', height: '8px' }}></span> 
            V17.9 ALPHA CLOUD
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-content" style={{ flexGrow: 1, overflowY: 'auto' }}>
        {/* KPI HEADER (Always visible) */}
        <div className="kpi-grid">
          <div className="kpi-item">
            <div className="kpi-label">Active Signals</div>
            <div className="kpi-value" style={{ color: 'var(--sniper)' }}>{stickyTokens.length}</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">Pump Alerts</div>
            <div className="kpi-value" style={{ color: '#22c55e' }}>{pumpSignals.length}</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">Compression</div>
            <div className="kpi-value" style={{ color: 'var(--golden)' }}>
              {tokens.filter(t => t.isInsideStructure).length}
            </div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">Node Status</div>
            <div className="kpi-value" style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>LOCAL_SYNC</div>
          </div>
        </div>

        {/* CONDITIONALLY RENDER CONTENT BASED ON TAB */}
        {activeTab === 'signals' ? (
          <>
            {/* LIVE SCANNER BAR */}
            {scannerStatus && (
              <div className="glass-card" style={{ 
                marginBottom: '2rem', 
                padding: '0.85rem 1.75rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08))',
                borderColor: 'rgba(99, 102, 241, 0.15)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="pulse-dot" style={{ backgroundColor: 'var(--primary)', width: '10px', height: '10px' }}></div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                    <span style={{ color: 'var(--text-dim)', marginRight: '0.5rem' }}>SCOUTING:</span>
                    <span className="symbol-font" style={{ color: '#fff', fontSize: '1.1rem' }}>{scannerStatus.symbol}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>CYCLE PROGRESS</div>
                    <div style={{ fontSize: '1rem', fontWeight: '900' }}>{scannerStatus.count} <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>/ {scannerStatus.total}</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION: PUMP CHANCE (V17.5 NEW) */}
            {pumpSignals.length > 0 && (
              <section style={{ marginBottom: '3.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ color: '#22c55e', animation: 'pulse 1s infinite' }}>🚀</span> PUMP CHANCE ALPHA
                  </h2>
                  <div style={{ fontSize: '0.85rem', color: '#22c55e', fontWeight: '900', border: '2px solid #22c55e', padding: '0.4rem 0.8rem', borderRadius: '6px', letterSpacing: '0.05em' }}>
                    INSTANT BREAKOUTS
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  {pumpSignals.map(token => (
                    <div key={token.symbol} style={{ minWidth: '340px' }}>
                      <PumpCard token={token} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ELITE SIGNALS FEED */}
            <section style={{ marginBottom: '3.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ color: 'var(--sniper)' }}>🏆</span> VIP ELITE SIGNALS
                </h2>
                <button onClick={clearSticky} className="danger-btn" style={{ 
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.85rem',
                  fontWeight: '800'
                }}>RESET DATA</button>
              </div>
              
              {eliteSignals.length > 0 ? (
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  {eliteSignals.map(token => (
                    <div key={token.symbol} style={{ minWidth: '340px' }}>
                      <EliteCard token={token} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-card" style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-dim)', borderStyle: 'dashed' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🛰️</div>
                  SCOUTING THE TOP 200 FOR LIQUIDITY BREAKOUTS...
                </div>
              )}
            </section>

            {/* BREAKOUT WATCH (PENDING) SECTION */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-dim)' }}>
                  <span style={{ color: 'var(--primary)' }}>🎯</span> BREAKOUT WATCHLIST
                </h2>
              </div>
              
              {pendingTokens.length > 0 ? (
                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                  {pendingTokens.sort((a,b) => {
                    const dA = ((a.vwapWeeklyMax - a.price)/a.vwapWeeklyMax);
                    const dB = ((b.vwapWeeklyMax - b.price)/b.vwapWeeklyMax);
                    return dA - dB;
                  }).map(token => (
                    <div key={token.symbol} style={{ minWidth: '300px' }}>
                      <PendingCard token={token} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '1.25rem', textAlign: 'center', fontSize: '0.9rem', color: 'rgba(255,255,255,0.2)' }}>
                  NO PENDING BREAKOUTS CURRENTLY DETECTED
                </div>
              )}
            </section>
          </>
        ) : (
          /* WATCHLIST TAB CONTENT */
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ color: 'var(--primary)' }}>📡</span> GLOBAL WATCHLIST ENGINE
              </h2>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: '600', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                MONITORING 400 TOTAL BINANCE FUTURES PAIRS
              </div>
            </div>
            
            <div className="glass-card" style={{ padding: '0.5rem', background: 'rgba(15, 23, 42, 0.4)' }}>
              {loading ? <LoadingSpinner /> : <TokenTable tokens={tokens} />}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default App;
