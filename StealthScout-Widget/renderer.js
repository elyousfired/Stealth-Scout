const { ipcRenderer } = require('electron');
const { io } = require('socket.io-client');

document.getElementById('close-btn').addEventListener('click', () => {
  ipcRenderer.send('close-widget');
});

const dot = document.getElementById('connection-dot');
const container = document.getElementById('signals-container');

// Connect to the local Stealth Scout server
const socket = io('http://localhost:4000');

socket.on('connect', () => {
  dot.classList.add('connected');
});

socket.on('disconnect', () => {
  dot.classList.remove('connected');
});

function renderSignals(tokens) {
  // Filter for VIP (golden/sniper) and Pump signals
  const signals = tokens.filter(t => t.status === 'golden' || t.status === 'sniper' || t.isFreshBreakout);
  
  // Sort by time (newest first)
  signals.sort((a, b) => new Date(b.crossTime || 0).getTime() - new Date(a.crossTime || 0).getTime());

  if (signals.length === 0) {
    container.innerHTML = '<div class="empty-state">Aucun signal VIP/Pump détecté.</div>';
    return;
  }

  container.innerHTML = '';
  
  signals.forEach(t => {
    const isPump = t.isFreshBreakout;
    let cardClass = isPump ? 'pump' : t.status;
    let typeLabel = isPump ? '🚀 PUMP' : (t.status === 'sniper' ? '🎯 SNIPER' : '🏆 GOLDEN');
    
    let pnlHtml = '';
    if (t.pnlFromCross !== undefined) {
      const pnlClass = t.pnlFromCross >= 0 ? 'positive' : 'negative';
      const sign = t.pnlFromCross >= 0 ? '+' : '';
      pnlHtml = `<div class="pnl ${pnlClass}">${sign}${t.pnlFromCross.toFixed(2)}%</div>`;
    }

    const card = document.createElement('div');
    card.className = `signal-card ${cardClass}`;
    card.innerHTML = `
      <div>
        <div class="symbol">${t.symbol}</div>
        <div class="price">$${t.price}</div>
      </div>
      <div style="text-align: right;">
        <div class="type-badge">${typeLabel}</div>
        ${pnlHtml}
      </div>
    `;
    container.appendChild(card);
  });
}

socket.on('sticky_updates', (data) => {
  renderSignals(data);
});
