// ============================================================
// BullRun — Main App Module
// ============================================================
// Controls navigation, page rendering, data loading,
// market view, portfolio, leaderboards, and more.
// ============================================================

// ---- GLOBAL STATE ----
let currentUser = null;
let allStocks = [];
let currentPage = 'home';

// ============================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================
function showToast(message, type = 'info', tip = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>${tip ? `<span class="toast-tip">${tip}</span>` : ''}`;
  container.appendChild(toast);
  // Remove after animation ends
  setTimeout(() => toast.remove(), 4000);
}

// ============================================================
// FORMAT HELPERS
// ============================================================
function formatMoney(amount) {
  if (amount === null || amount === undefined) return '$0.00';
  const num = parseFloat(amount);
  if (isNaN(num)) return '$0.00';
  const negative = num < 0;
  const abs = Math.abs(num);
  let formatted;
  if (abs >= 1000000) formatted = '$' + (abs / 1000000).toFixed(2) + 'M';
  else if (abs >= 100000) formatted = '$' + (abs / 1000).toFixed(1) + 'K';
  else formatted = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return negative ? '-' + formatted : formatted;
}

function formatPercent(value) {
  if (value === null || value === undefined) return '0.00%';
  const num = parseFloat(value);
  return (num >= 0 ? '+' : '') + num.toFixed(2) + '%';
}

function changeClass(current, previous) {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'flat';
}

function formatPnlColor(val) {
  const num = parseFloat(val);
  if (num > 0) return 'text-gain';
  if (num < 0) return 'text-loss';
  return 'text-muted';
}

// ============================================================
// APP — Core Navigation & Initialization
// ============================================================
const App = (() => {

  // Called after successful login
  function onLogin(user) {
    currentUser = user;
    // Hide auth, show app
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('app-screen').style.display = 'block';
    document.getElementById('app-screen').classList.add('active');
    // Update nav bar
    updateNav();
    // Load home page
    navigate('home');
    // Load announcements
    loadAnnouncements();
  }

  // Update the navigation bar with user info
  function updateNav() {
    if (!currentUser) return;
    document.getElementById('nav-money-value').textContent = formatMoney(currentUser.money);
    document.getElementById('nav-level-value').textContent = currentUser.level || 1;
    document.getElementById('nav-username').textContent = currentUser.username;
    document.getElementById('home-username').textContent = currentUser.username;
  }

  // Navigate to a page
  function navigate(page) {
    currentPage = page;
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // Show target page
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');
    // Update nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.page === page);
    });
    // Load page data
    switch (page) {
      case 'home': loadHome(); break;
      case 'market': Market.load(); break;
      case 'portfolio': Portfolio.load(); break;
      case 'leaderboard': Leaderboard.show('weekly'); break;
      case 'profile': Profile.loadOwn(); break;
    }
  }

  // Load home page data
  async function loadHome() {
    // Refresh user data
    const meRes = await API.getMe();
    if (meRes.ok) {
      currentUser = meRes.data.user;
      updateNav();
    }
    // Update home stats
    document.getElementById('home-cash').textContent = formatMoney(currentUser.money);
    document.getElementById('home-level').textContent = currentUser.level || 1;
    document.getElementById('home-xp').textContent = (currentUser.xp || 0).toLocaleString();

    // Load portfolio for net worth
    const pfRes = await API.getPortfolio();
    if (pfRes.ok) {
      document.getElementById('home-networth').textContent = formatMoney(pfRes.data.netWorth);
      // Render holdings summary
      const holdingsEl = document.getElementById('home-holdings');
      if (pfRes.data.holdings.length === 0) {
        holdingsEl.innerHTML = '<p class="empty-state">No stocks owned yet. Visit the Market to start trading!</p>';
      } else {
        holdingsEl.innerHTML = pfRes.data.holdings.slice(0, 5).map(h => `
          <div class="holding-row">
            <div>
              <span class="mono" style="font-weight:600;">${h.symbol}</span>
              <span class="text-muted" style="font-size:0.78rem; margin-left:0.5rem;">${h.shares} shares</span>
            </div>
            <div style="text-align:right;">
              <span class="mono">${formatMoney(h.currentValue)}</span>
              <span class="mono ${formatPnlColor(h.profitLoss)}" style="font-size:0.78rem; margin-left:0.5rem;">
                ${formatPercent(h.profitLossPercent)}
              </span>
            </div>
          </div>
        `).join('');
      }
    }

    // Load market movers
    const stockRes = await API.getStocks();
    if (stockRes.ok) {
      allStocks = stockRes.data.stocks;
      renderMovers(allStocks);
    }
  }

  // Render top market movers on the home page
  function renderMovers(stocks) {
    const el = document.getElementById('home-movers');
    if (!stocks.length) { el.innerHTML = '<p class="placeholder-text">No stock data available</p>'; return; }

    // Sort by % change, pick top 3 gainers and 3 losers
    const withChange = stocks.map(s => ({
      ...s,
      pctChange: s.previous_price > 0 ? ((s.current_price - s.previous_price) / s.previous_price * 100) : 0
    }));
    const sorted = [...withChange].sort((a, b) => b.pctChange - a.pctChange);
    const movers = [...sorted.slice(0, 3), ...sorted.slice(-3)];

    el.innerHTML = movers.map(s => {
      const dir = changeClass(s.current_price, s.previous_price);
      return `
        <div class="mover-item" onclick="Market.openDetail(${s.id})">
          <div class="mover-left">
            <span class="mover-symbol">${s.symbol}</span>
            <span class="mover-name">${s.name}</span>
          </div>
          <div class="mover-right">
            <div class="mover-price">${formatMoney(s.current_price)}</div>
            <div class="mover-change ${dir}">${formatPercent(s.pctChange)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Load announcements
  async function loadAnnouncements() {
    const res = await API.getAnnouncements();
    if (res.ok && res.data.announcements.length > 0) {
      const latest = res.data.announcements[0];
      document.getElementById('announcement-text').textContent = latest.message;
      document.getElementById('announcement-banner').style.display = 'block';
    }
  }

  function dismissAnnouncement() {
    document.getElementById('announcement-banner').style.display = 'none';
  }

  return { onLogin, navigate, updateNav, dismissAnnouncement };
})();

// ============================================================
// MARKET — Stock List, Search, Detail Modal
// ============================================================
const Market = (() => {
  let filteredStocks = [];

  async function load() {
    const res = await API.getStocks();
    if (res.ok) {
      allStocks = res.data.stocks;
      filteredStocks = allStocks;
      render(allStocks);
    }
  }

  function filterStocks(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
      filteredStocks = allStocks;
    } else {
      filteredStocks = allStocks.filter(s =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.sector.toLowerCase().includes(q)
      );
    }
    render(filteredStocks);
  }

  function render(stocks) {
    const el = document.getElementById('stock-list');
    if (!stocks.length) {
      el.innerHTML = '<p class="placeholder-text">No stocks found</p>';
      return;
    }
    el.innerHTML = stocks.map(s => {
      const pct = s.previous_price > 0 ? ((s.current_price - s.previous_price) / s.previous_price * 100) : 0;
      const dir = changeClass(s.current_price, s.previous_price);
      return `
        <div class="stock-row" onclick="Market.openDetail(${s.id})">
          <span class="stock-symbol">${s.symbol}</span>
          <span class="stock-name">${s.name}</span>
          <span class="stock-sector">${s.sector}</span>
          <span class="stock-price">${formatMoney(s.current_price)}</span>
          <span class="stock-change ${dir}">${formatPercent(pct)}</span>
        </div>
      `;
    }).join('');
  }

  async function openDetail(stockId) {
    const modal = document.getElementById('stock-modal');
    const content = document.getElementById('stock-detail-content');
    modal.style.display = 'flex';
    content.innerHTML = '<p class="placeholder-text">Loading stock data...</p>';

    const res = await API.getStockDetail(stockId);
    if (!res.ok) {
      content.innerHTML = `<p class="error-message">${res.data.error || 'Failed to load stock'}</p>`;
      return;
    }

    const { stock, history, holding } = res.data;
    const pct = stock.previous_price > 0 ? ((stock.current_price - stock.previous_price) / stock.previous_price * 100) : 0;
    const dir = changeClass(stock.current_price, stock.previous_price);
    const basePct = stock.base_price > 0 ? ((stock.current_price - stock.base_price) / stock.base_price * 100) : 0;

    content.innerHTML = `
      <div class="stock-detail-header">
        <div class="sd-left">
          <h2>${stock.name}</h2>
          <span class="sd-symbol">${stock.symbol} · ${stock.sector}</span>
        </div>
        <div style="text-align:right;">
          <div class="sd-price">${formatMoney(stock.current_price)}</div>
          <div class="sd-price-change ${dir === 'up' ? 'text-gain' : dir === 'down' ? 'text-loss' : 'text-muted'}">
            ${formatPercent(pct)} today · ${formatPercent(basePct)} this week
          </div>
        </div>
      </div>

      <div class="chart-container" id="stock-chart">
        ${history.length > 0
          ? '<canvas id="stock-chart-canvas" style="width:100%;height:100%;"></canvas>'
          : 'No price history yet — prices update every tick'
        }
      </div>

      ${holding.shares > 0 ? `
        <div class="trade-holding-info">
          You own <strong>${holding.shares}</strong> shares at avg price <strong>${formatMoney(holding.avg_buy_price)}</strong>
          · Current value: <strong>${formatMoney(holding.shares * stock.current_price)}</strong>
          · P/L: <span class="${formatPnlColor((stock.current_price - holding.avg_buy_price) * holding.shares)}">
            ${formatMoney((stock.current_price - holding.avg_buy_price) * holding.shares)}
          </span>
        </div>
      ` : ''}

      <div class="trade-form">
        <div class="trade-section buy-section">
          <h4>Buy ${stock.symbol}</h4>
          <div class="trade-input-row">
            <input type="number" id="buy-shares-input" min="1" value="1" placeholder="Shares"
                   oninput="Market.updateTradeTotal('buy', ${stock.current_price})">
          </div>
          <div class="trade-total" id="buy-total">Total: ${formatMoney(stock.current_price)}</div>
          <div class="trade-holding-info">Cash available: ${formatMoney(currentUser.money)}</div>
          <button class="btn btn-primary btn-full btn-sm" onclick="Market.executeTrade('buy', ${stock.id})">
            Buy Shares
          </button>
        </div>
        <div class="trade-section sell-section">
          <h4>Sell ${stock.symbol}</h4>
          <div class="trade-input-row">
            <input type="number" id="sell-shares-input" min="1" max="${holding.shares}" value="1" placeholder="Shares"
                   oninput="Market.updateTradeTotal('sell', ${stock.current_price})"
                   ${holding.shares <= 0 ? 'disabled' : ''}>
          </div>
          <div class="trade-total" id="sell-total">Total: ${formatMoney(stock.current_price)}</div>
          <div class="trade-holding-info">You own: ${holding.shares} shares</div>
          <button class="btn btn-danger btn-full btn-sm" onclick="Market.executeTrade('sell', ${stock.id})"
                  ${holding.shares <= 0 ? 'disabled' : ''}>
            Sell Shares
          </button>
        </div>
      </div>
    `;

    // Draw a simple line chart if we have history
    if (history.length > 1) {
      drawLineChart('stock-chart-canvas', history.map(h => h.close_price || h.price));
    }
  }

  function updateTradeTotal(type, pricePerShare) {
    const input = document.getElementById(`${type}-shares-input`);
    const totalEl = document.getElementById(`${type}-total`);
    const shares = parseInt(input.value) || 0;
    totalEl.textContent = `Total: ${formatMoney(shares * pricePerShare)}`;
  }

  async function executeTrade(type, stockId) {
    const input = document.getElementById(`${type}-shares-input`);
    const shares = parseInt(input.value);
    if (!shares || shares < 1) {
      showToast('Enter a valid number of shares', 'error');
      return;
    }

    let res;
    if (type === 'buy') {
      res = await API.buyStock(stockId, shares);
    } else {
      res = await API.sellStock(stockId, shares);
    }

    if (res.ok) {
      showToast(res.data.message, 'success', res.data.tip || '');
      // Update user money
      if (res.data.newBalance !== undefined) {
        currentUser.money = res.data.newBalance;
        App.updateNav();
      }
      // Refresh the modal
      openDetail(stockId);
      // Refresh stock list
      load();
    } else {
      showToast(res.data.error || 'Trade failed', 'error');
    }
  }

  function closeModal() {
    document.getElementById('stock-modal').style.display = 'none';
  }

  // Simple line chart drawn on a canvas
  function drawLineChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const padding = { top: 20, right: 20, bottom: 20, left: 50 };
    const w = canvas.width - padding.left - padding.right;
    const h = canvas.height - padding.top - padding.bottom;

    if (data.length < 2) return;

    const min = Math.min(...data) * 0.998;
    const max = Math.max(...data) * 1.002;
    const range = max - min || 1;

    // Map data to points
    const points = data.map((val, i) => ({
      x: padding.left + (i / (data.length - 1)) * w,
      y: padding.top + h - ((val - min) / range) * h,
    }));

    // Determine color based on trend
    const isUp = data[data.length - 1] >= data[0];
    const lineColor = isUp ? '#22c55e' : '#ef4444';
    const fillColor = isUp ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)';

    // Draw fill
    ctx.beginPath();
    ctx.moveTo(points[0].x, canvas.height - padding.bottom);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, canvas.height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw current price dot
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();

    // Draw Y-axis labels
    ctx.fillStyle = '#64748b';
    ctx.font = '10px JetBrains Mono';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const val = min + (range * i / 4);
      const y = padding.top + h - (h * i / 4);
      ctx.fillText('$' + val.toFixed(2), padding.left - 8, y + 3);
      // Grid line
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvas.width - padding.right, y);
      ctx.stroke();
    }
  }

  return { load, filterStocks, openDetail, closeModal, updateTradeTotal, executeTrade };
})();

// ============================================================
// PORTFOLIO — Holdings & Performance
// ============================================================
const Portfolio = (() => {
  async function load() {
    const res = await API.getPortfolio();
    if (!res.ok) return;

    const { holdings, totalValue, totalCost, totalProfitLoss, cash, netWorth } = res.data;

    document.getElementById('portfolio-cash').textContent = formatMoney(cash);
    document.getElementById('portfolio-holdings-value').textContent = formatMoney(totalValue);
    document.getElementById('portfolio-networth').textContent = formatMoney(netWorth);

    const pnlEl = document.getElementById('portfolio-pnl');
    pnlEl.textContent = formatMoney(totalProfitLoss);
    pnlEl.className = `summary-value ${formatPnlColor(totalProfitLoss)}`;

    const holdingsEl = document.getElementById('portfolio-holdings');
    if (holdings.length === 0) {
      holdingsEl.innerHTML = `
        <div class="empty-state" style="padding:2rem;">
          <p>You don't own any stocks yet.</p>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('market')" style="margin-top:1rem;">
            Browse the Market
          </button>
        </div>
      `;
      return;
    }

    holdingsEl.innerHTML = holdings.map(h => `
      <div class="portfolio-holding">
        <span class="stock-symbol">${h.symbol}</span>
        <span class="stock-name">${h.name}</span>
        <div class="pf-col">
          <div class="pf-col-label">Shares</div>
          <div class="pf-col-value">${h.shares}</div>
        </div>
        <div class="pf-col">
          <div class="pf-col-label">Avg Price</div>
          <div class="pf-col-value">${formatMoney(h.avg_buy_price)}</div>
        </div>
        <div class="pf-col">
          <div class="pf-col-label">Current</div>
          <div class="pf-col-value">${formatMoney(h.current_price)}</div>
        </div>
        <div class="pf-col">
          <div class="pf-col-label">P/L</div>
          <div class="pf-col-value ${formatPnlColor(h.profitLoss)}">
            ${formatMoney(h.profitLoss)}<br>
            <span style="font-size:0.7rem;">${formatPercent(h.profitLossPercent)}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  return { load };
})();

// ============================================================
// LEADERBOARD — Rankings
// ============================================================
const Leaderboard = (() => {
  let currentType = 'weekly';

  async function show(type) {
    currentType = type;
    // Update tab styles
    document.querySelectorAll('.lb-tab').forEach(tab => {
      tab.classList.toggle('active', tab.textContent.toLowerCase().includes(
        type === 'weekly' ? 'weekly' : type === 'alltime' ? 'all' : 'level'
      ));
    });

    const listEl = document.getElementById('leaderboard-list');
    listEl.innerHTML = '<p class="placeholder-text">Loading rankings...</p>';

    const res = await API.getLeaderboard(type);
    if (!res.ok) {
      listEl.innerHTML = '<p class="placeholder-text">Failed to load rankings</p>';
      return;
    }

    const leaders = res.data.leaderboard;
    if (leaders.length === 0) {
      listEl.innerHTML = '<p class="placeholder-text">No players yet — be the first!</p>';
      return;
    }

    listEl.innerHTML = leaders.map((p, i) => {
      const rank = i + 1;
      const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
      const isMe = currentUser && p.id === currentUser.id;

      let valueDisplay;
      if (type === 'weekly') valueDisplay = formatMoney(p.money);
      else if (type === 'alltime') valueDisplay = formatMoney(p.highest_money);
      else valueDisplay = `Lv ${p.level}`;

      return `
        <div class="lb-row ${isMe ? 'lb-me' : ''}" onclick="Profile.loadById(${p.id})" style="${isMe ? 'border-color:var(--blue);background:var(--blue-bg);' : ''}">
          <span class="lb-rank ${rankClass}">#${rank}</span>
          <div>
            <div class="lb-name">${p.username}${isMe ? ' (you)' : ''}</div>
            <div class="lb-detail">
              ${p.equipped_title ? `<span style="color:var(--amber);">${p.equipped_title}</span> · ` : ''}
              Level ${p.level || 1}
            </div>
          </div>
          <span class="lb-value">${valueDisplay}</span>
        </div>
      `;
    }).join('');
  }

  return { show };
})();

// ============================================================
// PROFILE — Player Profiles
// ============================================================
const Profile = (() => {
  async function loadOwn() {
    if (!currentUser) return;
    loadById(currentUser.id);
  }

  async function loadById(userId) {
    // Navigate to profile page if not already there
    if (currentPage !== 'profile') {
      currentPage = 'profile';
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-profile').classList.add('active');
      document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    }

    const container = document.getElementById('profile-container');
    container.innerHTML = '<p class="placeholder-text">Loading profile...</p>';

    const res = await API.getProfile(userId);
    if (!res.ok) {
      container.innerHTML = `<p class="error-message">${res.data.error || 'Failed to load profile'}</p>`;
      return;
    }

    const { profile, holdings, totalStocks, totalShares } = res.data;
    const initial = profile.username.charAt(0).toUpperCase();
    const isMe = currentUser && profile.id === currentUser.id;

    container.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar">${initial}</div>
        <div class="profile-info">
          <h2>${profile.username} ${isMe ? '<span style="color:var(--text-dim);font-size:0.8rem;">(you)</span>' : ''}</h2>
          ${profile.equipped_title ? `<div class="profile-title">${profile.equipped_title}</div>` : ''}
          <div style="color:var(--text-muted);font-size:0.82rem;margin-top:0.25rem;">
            Joined ${new Date(profile.created_at).toLocaleDateString('en-AU', { year: 'numeric', month: 'long' })}
          </div>
        </div>
      </div>

      <div class="profile-stats-grid">
        <div class="profile-stat">
          <span class="ps-val">${profile.level}</span>
          <span class="ps-label">Level</span>
        </div>
        <div class="profile-stat">
          <span class="ps-val">${formatMoney(profile.money)}</span>
          <span class="ps-label">Current Money</span>
        </div>
        <div class="profile-stat">
          <span class="ps-val">${formatMoney(profile.highest_money)}</span>
          <span class="ps-label">All-Time Best</span>
        </div>
        <div class="profile-stat">
          <span class="ps-val">${profile.xp.toLocaleString()}</span>
          <span class="ps-label">Total XP</span>
        </div>
      </div>

      <div class="card" style="margin-top:1rem;">
        <h3>Holdings (${totalStocks} stocks, ${totalShares} shares)</h3>
        ${holdings.length === 0
          ? '<p class="empty-state">No stocks currently held</p>'
          : holdings.map(h => `
            <div class="holding-row">
              <div>
                <span class="mono" style="font-weight:600;">${h.symbol}</span>
                <span class="text-muted" style="font-size:0.78rem;margin-left:0.5rem;">${h.name}</span>
              </div>
              <div style="text-align:right;">
                <span class="mono">${h.shares} shares</span>
                <span class="text-muted" style="font-size:0.78rem;margin-left:0.5rem;">@ ${formatMoney(h.current_price)}</span>
              </div>
            </div>
          `).join('')
        }
      </div>
    `;
  }

  return { loadOwn, loadById };
})();

// ============================================================
// INITIALIZATION — Run on page load
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  Auth.setupKeyHandlers();

  // Check for existing session
  const user = await Auth.checkSession();

  // Hide loading screen
  setTimeout(() => {
    document.getElementById('loading-screen').style.display = 'none';

    if (user) {
      // Already logged in
      App.onLogin(user);
    } else {
      // Show auth screen
      document.getElementById('auth-screen').style.display = 'block';
      document.getElementById('auth-screen').classList.add('active');
    }
  }, 1500); // Show loading animation for at least 1.5s
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    Market.closeModal();
  }
});
