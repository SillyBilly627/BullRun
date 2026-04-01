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
let pollInterval = null;      // Auto-refresh timer for stock prices
let watchlistIds = new Set();  // IDs of stocks the user has pinned

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
    // Initialize global chat
    Chat.init();
  }

  // Update the navigation bar with user info
  function updateNav() {
    if (!currentUser) return;
    document.getElementById('nav-money-value').textContent = formatMoney(currentUser.money);
    document.getElementById('nav-level-value').textContent = currentUser.level || 1;
    document.getElementById('nav-username').textContent = currentUser.username;
    document.getElementById('home-username').textContent = currentUser.username;

    // Update XP progress bar if it exists
    const xpContainer = document.getElementById('nav-xp-info');
    if (xpContainer) {
      const level = currentUser.level || 1;
      const xp = currentUser.xp || 0;
      const currentLevelXp = 50 * (level - 1) * level / 2;
      const nextLevelXp = 50 * level * (level + 1) / 2;
      const progress = nextLevelXp > currentLevelXp
        ? ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100
        : 0;
      xpContainer.innerHTML = `
        <span class="nav-xp-text">${xp - currentLevelXp} / ${nextLevelXp - currentLevelXp} XP</span>
        <div class="xp-bar-track"><div class="xp-bar-fill" style="width:${Math.min(100, progress)}%"></div></div>
      `;
    }
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
      case 'lobbies': Lobby.load(); break;
      case 'leaderboard': Leaderboard.show('weekly'); break;
      case 'profile': Profile.loadOwn(); break;
      case 'cosmetics': Cosmetics.load(); break;
      case 'admin': Admin.load(); break;
      case 'glossary': Glossary.load(); break;
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

  // Secret admin access: click the nav logo 5 times rapidly
  let adminClickCount = 0;
  let adminClickTimer = null;
  function handleLogoClick() {
    adminClickCount++;
    clearTimeout(adminClickTimer);
    adminClickTimer = setTimeout(() => { adminClickCount = 0; }, 2000);
    if (adminClickCount >= 5) {
      adminClickCount = 0;
      // If already admin, go straight to admin page
      if (currentUser && currentUser.is_admin) {
        navigate('admin');
      } else {
        Admin.showModal();
      }
    }
  }

  return { onLogin, navigate, updateNav, dismissAnnouncement, handleLogoClick };
})();

// ============================================================
// MARKET — Stock List, Search, Watchlist, Charts, Auto-Refresh
// ============================================================
const Market = (() => {
  let filteredStocks = [];
  let currentChartType = 'line'; // 'line' or 'candle'
  let currentDetailStockId = null;
  let currentDetailHistory = []; // Store history so we can redraw without refetching
  let currentHistoryMinutes = 60; // Default time range in minutes

  async function load() {
    const res = await API.getStocks();
    if (res.ok) {
      allStocks = res.data.stocks;
      filteredStocks = allStocks;
      render(allStocks);
    }
    // Load watchlist IDs
    const wlRes = await API.getWatchlist();
    if (wlRes.ok) {
      watchlistIds = new Set(wlRes.data.watchlist.map(w => w.id));
      renderWatchlist(wlRes.data.watchlist);
    }
    // Start auto-refresh polling
    startPolling();
  }

  // --- AUTO-REFRESH: poll for price updates every 10 seconds ---
  function startPolling() {
    stopPolling(); // Clear any existing interval
    pollInterval = setInterval(async () => {
      const res = await API.pollTick();
      if (res.ok && res.data.prices) {
        // Update allStocks with new prices
        const priceMap = {};
        res.data.prices.forEach(p => { priceMap[p.id] = p; });
        allStocks = allStocks.map(s => {
          if (priceMap[s.id]) {
            return { ...s, previous_price: priceMap[s.id].previous_price, current_price: priceMap[s.id].current_price };
          }
          return s;
        });
        // Re-render if we're on the market page
        if (currentPage === 'market') {
          const q = document.getElementById('stock-search')?.value || '';
          if (q.trim()) filterStocks(q); else render(allStocks);
          // Update watchlist too
          const wlRes = await API.getWatchlist();
          if (wlRes.ok) renderWatchlist(wlRes.data.watchlist);
        }
        // Flash the nav money if it changed
        if (currentPage === 'home') {
          App.navigate('home'); // Soft refresh home
        }
      }
    }, 10000); // Every 10 seconds
  }

  function stopPolling() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
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
      const pinned = watchlistIds.has(s.id);
      return `
        <div class="stock-row" onclick="Market.openDetail(${s.id})">
          <span class="stock-symbol">${s.symbol}</span>
          <span class="stock-name">${s.name}</span>
          <span class="stock-sector">${s.sector}</span>
          <span class="stock-price">${formatMoney(s.current_price)}</span>
          <span class="stock-change ${dir}">${formatPercent(pct)}</span>
          <button class="pin-btn ${pinned ? 'pinned' : ''}" onclick="event.stopPropagation(); Market.togglePin(${s.id})" title="${pinned ? 'Unpin' : 'Pin to watchlist'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
        </div>
      `;
    }).join('');
  }

  // --- WATCHLIST ---
  let wlChartType = 'line'; // watchlist chart type: 'line' or 'candle'
  let cachedWatchlist = []; // store for re-rendering on toggle

  function renderWatchlist(watchlist) {
    const el = document.getElementById('watchlist-panel');
    const container = document.getElementById('watchlist-container');
    if (!el) return;
    cachedWatchlist = watchlist;

    if (watchlist.length === 0) {
      if (container) container.style.display = 'none';
      el.innerHTML = '<p class="placeholder-text" style="padding:0.75rem;">Pin stocks with the ★ icon to track them here</p>';
      return;
    }
    if (container) container.style.display = 'block';

    // Update toggle button state
    const toggleBtn = document.getElementById('wl-chart-toggle');
    if (toggleBtn) toggleBtn.textContent = wlChartType === 'candle' ? '📊 Candles' : '📈 Line';

    el.innerHTML = watchlist.map((s, idx) => {
      const pct = s.previous_price > 0 ? ((s.current_price - s.previous_price) / s.previous_price * 100) : 0;
      const dir = changeClass(s.current_price, s.previous_price);
      const weekPct = s.base_price > 0 ? ((s.current_price - s.base_price) / s.base_price * 100) : 0;
      return `
        <div class="wl-card" onclick="Market.openDetail(${s.id})">
          <div class="wl-card-header">
            <div class="wl-card-left">
              <span class="wl-card-symbol">${s.symbol}</span>
              <span class="wl-card-name">${s.name}</span>
            </div>
            <div class="wl-card-right">
              <span class="wl-card-price">${formatMoney(s.current_price)}</span>
              <span class="wl-card-change ${dir}">${formatPercent(pct)}</span>
            </div>
          </div>
          <div class="wl-chart-wrap">
            <canvas class="wl-chart-canvas" id="wl-chart-${idx}"></canvas>
          </div>
          <div class="wl-card-footer">
            <span class="wl-card-sector">${s.sector || 'General'}</span>
            <span class="wl-card-week ${weekPct >= 0 ? 'text-gain' : 'text-loss'}">week ${formatPercent(weekPct)}</span>
            <button class="wl-unpin-btn" onclick="event.stopPropagation(); Market.togglePin(${s.id})" title="Unpin">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Draw charts after HTML renders
    requestAnimationFrame(() => {
      watchlist.forEach((s, idx) => {
        if (wlChartType === 'candle' && s.history && s.history.length > 1) {
          drawWlCandleChart(`wl-chart-${idx}`, s.history);
        } else if (s.sparkline && s.sparkline.length > 1) {
          drawWlLineChart(`wl-chart-${idx}`, s.sparkline);
        }
      });
    });
  }

  // Toggle watchlist chart type
  function toggleWlChartType() {
    wlChartType = wlChartType === 'line' ? 'candle' : 'line';
    renderWatchlist(cachedWatchlist);
  }

  // Watchlist line chart (bigger version of sparkline)
  function drawWlLineChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const pad = { top: 8, right: 8, bottom: 8, left: 44 };
    const w = canvas.width - pad.left - pad.right;
    const h = canvas.height - pad.top - pad.bottom;

    const min = Math.min(...data) * 0.998;
    const max = Math.max(...data) * 1.002;
    const range = max - min || 1;

    const isUp = data[data.length - 1] >= data[0];
    const lineColor = isUp ? '#22c55e' : '#ef4444';
    const fillColor = isUp ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';

    // Y-axis labels (3 ticks)
    ctx.fillStyle = '#64748b';
    ctx.font = '9px JetBrains Mono';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 2; i++) {
      const val = min + (range * i / 2);
      const y = pad.top + h - (h * i / 2);
      ctx.fillText('$' + val.toFixed(val >= 100 ? 0 : 2), pad.left - 4, y + 3);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(canvas.width - pad.right, y); ctx.stroke();
    }

    const points = data.map((val, i) => ({
      x: pad.left + (i / (data.length - 1)) * w,
      y: pad.top + h - ((val - min) / range) * h,
    }));

    // Fill
    ctx.beginPath();
    ctx.moveTo(points[0].x, pad.top + h);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, pad.top + h);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Line
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // End dot
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
  }

  // Watchlist candlestick chart
  function drawWlCandleChart(canvasId, history) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || history.length < 2) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const pad = { top: 8, right: 8, bottom: 8, left: 44 };
    const w = canvas.width - pad.left - pad.right;
    const h = canvas.height - pad.top - pad.bottom;

    let allMin = Infinity, allMax = -Infinity;
    history.forEach(c => {
      allMin = Math.min(allMin, c.low_price || c.price);
      allMax = Math.max(allMax, c.high_price || c.price);
    });
    allMin *= 0.998;
    allMax *= 1.002;
    const range = allMax - allMin || 1;

    const priceToY = (price) => pad.top + h - ((price - allMin) / range) * h;

    // Y-axis labels (3 ticks)
    ctx.fillStyle = '#64748b';
    ctx.font = '9px JetBrains Mono';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 2; i++) {
      const val = allMin + (range * i / 2);
      const y = pad.top + h - (h * i / 2);
      ctx.fillText('$' + val.toFixed(val >= 100 ? 0 : 2), pad.left - 4, y + 3);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(canvas.width - pad.right, y); ctx.stroke();
    }

    // Candles
    const candleSpacing = w / history.length;
    const candleWidth = Math.max(2, Math.min(8, candleSpacing * 0.6));

    history.forEach((candle, i) => {
      const open = candle.open_price || candle.price;
      const close = candle.close_price || candle.price;
      const high = candle.high_price || Math.max(open, close);
      const low = candle.low_price || Math.min(open, close);
      const isGreen = close >= open;
      const color = isGreen ? '#22c55e' : '#ef4444';
      const x = pad.left + (i + 0.5) * candleSpacing;

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, priceToY(high));
      ctx.lineTo(x, priceToY(low));
      ctx.stroke();

      // Body
      const bodyTop = Math.min(priceToY(open), priceToY(close));
      const bodyHeight = Math.max(1, Math.abs(priceToY(open) - priceToY(close)));
      ctx.fillStyle = color;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });
  }

  // Draw a tiny sparkline chart on a small canvas (kept for fallback)
  function drawSparkline(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const pad = 2;

    const min = Math.min(...data) * 0.999;
    const max = Math.max(...data) * 1.001;
    const range = max - min || 1;

    const isUp = data[data.length - 1] >= data[0];
    const color = isUp ? '#22c55e' : '#ef4444';
    const fillColor = isUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';

    const points = data.map((val, i) => ({
      x: pad + (i / (data.length - 1)) * (w - pad * 2),
      y: pad + (h - pad * 2) - ((val - min) / range) * (h - pad * 2),
    }));

    // Fill area
    ctx.beginPath();
    ctx.moveTo(points[0].x, h);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, h);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  async function togglePin(stockId) {
    const res = await API.toggleWatchlist(stockId);
    if (res.ok) {
      if (res.data.action === 'added') {
        watchlistIds.add(stockId);
        showToast('Added to watchlist', 'info');
      } else {
        watchlistIds.delete(stockId);
        showToast('Removed from watchlist', 'info');
      }
      // Re-render
      const q = document.getElementById('stock-search')?.value || '';
      if (q.trim()) filterStocks(q); else render(allStocks);
      const wlRes = await API.getWatchlist();
      if (wlRes.ok) renderWatchlist(wlRes.data.watchlist);
    }
  }

  // --- STOCK DETAIL MODAL ---
  // Opens instantly with cached stock info, then loads chart + holdings async
  async function openDetail(stockId, preserveSettings = false) {
    currentDetailStockId = stockId;
    if (!preserveSettings) {
      currentChartType = 'line';
      currentHistoryMinutes = 60;
    }
    const modal = document.getElementById('stock-modal');
    const content = document.getElementById('stock-detail-content');
    modal.style.display = 'flex';

    // Instantly show basic info from cached stock data (no network wait)
    const cached = allStocks.find(s => s.id === stockId);
    if (cached) {
      const pct = cached.previous_price > 0 ? ((cached.current_price - cached.previous_price) / cached.previous_price * 100) : 0;
      const dir = changeClass(cached.current_price, cached.previous_price);
      const pinned = watchlistIds.has(cached.id);
      renderDetailModal(cached, [], { shares: 0, avg_buy_price: 0 }, pinned, true);
    } else {
      content.innerHTML = '<p class="placeholder-text">Loading...</p>';
    }

    // Fetch full detail (history + holdings) in the background
    const res = await API.getStockDetail(stockId, currentHistoryMinutes);
    if (!res.ok) {
      content.innerHTML = `<p class="error-message">${res.data.error || 'Failed to load stock'}</p>`;
      return;
    }
    // Make sure user hasn't closed or switched stock while we were loading
    if (currentDetailStockId !== stockId) return;

    const { stock, history, holding } = res.data;
    currentDetailHistory = history;
    const pinned = watchlistIds.has(stock.id);
    renderDetailModal(stock, history, holding, pinned, false);
  }

  // Renders the full detail modal content
  function renderDetailModal(stock, history, holding, pinned, isLoading) {
    const content = document.getElementById('stock-detail-content');
    const pct = stock.previous_price > 0 ? ((stock.current_price - stock.previous_price) / stock.previous_price * 100) : 0;
    const dir = changeClass(stock.current_price, stock.previous_price);
    const basePct = stock.base_price > 0 ? ((stock.current_price - stock.base_price) / stock.base_price * 100) : 0;

    const rangeButtons = [
      { mins: 30, label: '30m' },
      { mins: 60, label: '1h' },
      { mins: 360, label: '6h' },
      { mins: 720, label: '12h' },
      { mins: 1440, label: '24h' },
    ];

    content.innerHTML = `
      <div class="stock-detail-header">
        <div class="sd-left">
          <h2>${stock.name}</h2>
          <span class="sd-symbol">${stock.symbol}${stock.sector ? ' · ' + stock.sector : ''}${stock.volatility ? ` · Vol ${(stock.volatility * 100).toFixed(1)}%` : ''}</span>
          ${stock.volatility ? `<span class="edu-tip" data-tip="Volatility: how much this stock moves per tick. ${stock.volatility > 0.03 ? 'This is a volatile stock — bigger swings, more risk and reward.' : 'This is a stable stock — smaller price movements.'}">ⓘ</span>` : ''}
        </div>
        <div style="text-align:right;">
          <div class="sd-price">${formatMoney(stock.current_price)}</div>
          <div class="sd-price-change ${dir === 'up' ? 'text-gain' : dir === 'down' ? 'text-loss' : 'text-muted'}">
            ${formatPercent(pct)} today${basePct !== undefined ? ' · ' + formatPercent(basePct) + ' this week' : ''}
          </div>
        </div>
      </div>

      <div class="chart-controls">
        <div class="chart-controls-left">
          <button class="chart-toggle-btn ${currentChartType === 'line' ? 'active' : ''}" id="btn-line" onclick="Market.setChartType('line')">Line</button>
          <button class="chart-toggle-btn ${currentChartType === 'candle' ? 'active' : ''}" id="btn-candle" onclick="Market.setChartType('candle')">Candlestick</button>
          <span class="edu-tip" data-tip="Line charts show closing prices over time. Candlestick charts show open, high, low, and close — green = price went up, red = down.">ⓘ</span>
        </div>
        <div class="chart-controls-center">
          ${rangeButtons.map(r => `
            <button class="range-btn ${currentHistoryMinutes === r.mins ? 'active' : ''}" onclick="Market.setHistoryRange(${r.mins})">${r.label}</button>
          `).join('')}
        </div>
        <button class="pin-btn-lg ${pinned ? 'pinned' : ''}" onclick="Market.togglePin(${stock.id})" title="${pinned ? 'Unpin' : 'Pin to watchlist'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          ${pinned ? 'Pinned' : 'Pin'}
        </button>
      </div>

      <div class="chart-container" id="stock-chart">
        ${isLoading
          ? '<span class="placeholder-text">Loading chart...</span>'
          : history.length > 1
            ? '<canvas id="stock-chart-canvas" style="width:100%;height:100%;"></canvas>'
            : '<span>Waiting for price data — prices update every 30 seconds</span>'
        }
      </div>

      ${holding.shares > 0 ? `
        <div class="trade-holding-info">
          You own <strong>${holding.shares}</strong> shares at avg price <strong>${formatMoney(holding.avg_buy_price)}</strong> <span class="edu-tip" data-tip="Your 'cost basis' — the average price you paid across all your purchases of this stock.">ⓘ</span>
          · Current value: <strong>${formatMoney(holding.shares * stock.current_price)}</strong>
          · P/L: <span class="${formatPnlColor((stock.current_price - holding.avg_buy_price) * holding.shares)}">
            ${formatMoney((stock.current_price - holding.avg_buy_price) * holding.shares)}
          </span> <span class="edu-tip" data-tip="This is your 'unrealised' profit or loss — it only becomes 'realised' when you sell.">ⓘ</span>
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

      <div class="stock-edu-tip">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <span>${getRandomTip()}</span>
      </div>
    `;

    // Draw chart if we have history and not in loading state
    if (!isLoading && history.length > 1) {
      drawChart('stock-chart-canvas', history, currentChartType);
    }
  }

  function setChartType(type) {
    currentChartType = type;
    document.getElementById('btn-line').classList.toggle('active', type === 'line');
    document.getElementById('btn-candle').classList.toggle('active', type === 'candle');
    // Redraw chart with stored history data (no refetch needed)
    if (currentDetailHistory.length > 1) {
      drawChart('stock-chart-canvas', currentDetailHistory, currentChartType);
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
      if (res.data.newBalance !== undefined) {
        currentUser.money = res.data.newBalance;
        App.updateNav();
      }
      openDetail(stockId);
      load();
    } else {
      showToast(res.data.error || 'Trade failed', 'error');
    }
  }

  function closeModal() {
    document.getElementById('stock-modal').style.display = 'none';
    currentDetailStockId = null;
    currentDetailHistory = [];
    currentChartType = 'line';
    currentHistoryMinutes = 60;
  }

  function setHistoryRange(minutes) {
    currentHistoryMinutes = minutes;
    // Refetch with new time range, preserving chart type
    if (currentDetailStockId) openDetail(currentDetailStockId, true);
  }

  // --- RANDOM EDUCATIONAL TIPS ---
  function getRandomTip() {
    const tips = [
      "A candlestick chart shows four prices per period: open, high, low, and close. Green candles mean the price went up; red means it went down.",
      "Diversifying means spreading your money across different stocks. If one drops, the others might hold steady.",
      "In real markets, a 'bull market' means prices are generally rising. A 'bear market' means they're falling.",
      "The price you see is the 'market price' — what buyers and sellers have agreed on right now.",
      "Volume means how many shares were traded. High volume often means big news or strong interest.",
      "A stock's volatility measures how much its price swings. High volatility = bigger potential gains AND losses.",
      "When you buy low and sell high, the difference is your profit. This is called 'realising a gain.'",
      "A 'stop loss' is when you sell a falling stock to prevent even bigger losses. Sometimes cutting losses early is smart.",
      "The P/E ratio (price-to-earnings) tells you how much investors pay per dollar of profit. Lower can mean cheaper.",
      "Day trading means buying and selling within the same day. It's risky but can be profitable with good timing.",
      "In real markets, stock prices are affected by company earnings, news, economic data, and investor sentiment.",
      "Buying pressure from many investors can push a stock's price up — that's supply and demand in action.",
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  }

  // ============================================================
  // CHART DRAWING — Line Chart & Candlestick Chart
  // ============================================================

  function drawChart(canvasId, history, type) {
    if (type === 'candle') {
      drawCandlestickChart(canvasId, history);
    } else {
      drawLineChart(canvasId, history.map(h => h.close_price || h.price));
    }
  }

  // --- LINE CHART ---
  function drawLineChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const padding = { top: 20, right: 20, bottom: 20, left: 55 };
    const w = canvas.width - padding.left - padding.right;
    const h = canvas.height - padding.top - padding.bottom;

    if (data.length < 2) return;

    const min = Math.min(...data) * 0.998;
    const max = Math.max(...data) * 1.002;
    const range = max - min || 1;

    const points = data.map((val, i) => ({
      x: padding.left + (i / (data.length - 1)) * w,
      y: padding.top + h - ((val - min) / range) * h,
    }));

    const isUp = data[data.length - 1] >= data[0];
    const lineColor = isUp ? '#22c55e' : '#ef4444';
    const fillColor = isUp ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)';

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px JetBrains Mono';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const val = min + (range * i / 4);
      const y = padding.top + h - (h * i / 4);
      ctx.fillText('$' + val.toFixed(2), padding.left - 8, y + 3);
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(canvas.width - padding.right, y); ctx.stroke();
    }

    // Fill area
    ctx.beginPath();
    ctx.moveTo(points[0].x, canvas.height - padding.bottom);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, canvas.height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // End dot
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
  }

  // --- CANDLESTICK CHART ---
  function drawCandlestickChart(canvasId, history) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const padding = { top: 20, right: 20, bottom: 20, left: 55 };
    const w = canvas.width - padding.left - padding.right;
    const h = canvas.height - padding.top - padding.bottom;

    if (history.length < 2) return;

    // Find price range across all candles
    let allMin = Infinity, allMax = -Infinity;
    history.forEach(c => {
      allMin = Math.min(allMin, c.low_price || c.price);
      allMax = Math.max(allMax, c.high_price || c.price);
    });
    allMin *= 0.998;
    allMax *= 1.002;
    const range = allMax - allMin || 1;

    // Helper: price to Y coordinate
    const priceToY = (price) => padding.top + h - ((price - allMin) / range) * h;

    // Grid lines and Y labels
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px JetBrains Mono';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const val = allMin + (range * i / 4);
      const y = padding.top + h - (h * i / 4);
      ctx.fillText('$' + val.toFixed(2), padding.left - 8, y + 3);
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(canvas.width - padding.right, y); ctx.stroke();
    }

    // Draw each candle
    const candleCount = history.length;
    const totalWidth = w;
    const candleSpacing = totalWidth / candleCount;
    const candleWidth = Math.max(2, Math.min(12, candleSpacing * 0.6));

    history.forEach((candle, i) => {
      const open = candle.open_price || candle.price;
      const close = candle.close_price || candle.price;
      const high = candle.high_price || Math.max(open, close);
      const low = candle.low_price || Math.min(open, close);

      const isGreen = close >= open;
      const color = isGreen ? '#22c55e' : '#ef4444';

      const x = padding.left + (i + 0.5) * candleSpacing;
      const yOpen = priceToY(open);
      const yClose = priceToY(close);
      const yHigh = priceToY(high);
      const yLow = priceToY(low);

      // Draw the wick (high-low line)
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // Draw the body (open-close rectangle)
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(1, Math.abs(yOpen - yClose));
      ctx.fillStyle = isGreen ? color : color;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);

      // Body border for definition
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });
  }

  return { load, filterStocks, openDetail, closeModal, updateTradeTotal, executeTrade, togglePin, setChartType, setHistoryRange, startPolling, stopPolling, drawChart, drawLineChart, drawCandlestickChart, toggleWlChartType };
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
      const cardClass = p.equipped_card_style || '';
      const titleName = p.equipped_title
        ? (typeof Cosmetics !== 'undefined' && Cosmetics.COSMETIC_TITLE_MAP[p.equipped_title]
           ? Cosmetics.COSMETIC_TITLE_MAP[p.equipped_title]
           : p.equipped_title.replace('title-', ''))
        : '';

      let valueDisplay;
      if (type === 'weekly') valueDisplay = formatMoney(p.money);
      else if (type === 'alltime') valueDisplay = formatMoney(p.highest_money);
      else valueDisplay = `Lv ${p.level}`;

      return `
        <div class="lb-row ${isMe ? 'lb-me' : ''} ${cardClass}" onclick="Profile.loadById(${p.id})" style="${isMe ? 'border-color:var(--blue);background:var(--blue-bg);' : ''}">
          <span class="lb-rank ${rankClass}">#${rank}</span>
          <div>
            <div class="lb-name">${p.username}${isMe ? ' (you)' : ''}</div>
            <div class="lb-detail">
              ${titleName ? `<span style="color:var(--amber);">${titleName}</span> · ` : ''}
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
    const bgClass = profile.equipped_background ? `profile-${profile.equipped_background}` : '';
    // Map title css_value to display name (look up from Cosmetics module if available)
    const titleDisplay = profile.equipped_title
      ? (typeof Cosmetics !== 'undefined' && Cosmetics.COSMETIC_TITLE_MAP[profile.equipped_title]
         ? Cosmetics.COSMETIC_TITLE_MAP[profile.equipped_title]
         : profile.equipped_title.replace('title-', '').replace(/([A-Z])/g, ' $1').trim())
      : '';

    container.innerHTML = `
      <div class="profile-header ${bgClass}">
        <div class="profile-avatar">${initial}</div>
        <div class="profile-info">
          <h2>${profile.username} ${isMe ? '<span style="color:var(--text-dim);font-size:0.8rem;">(you)</span>' : ''}</h2>
          ${titleDisplay ? `<div class="profile-title title-display">${titleDisplay}</div>` : ''}
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
// LOBBY — Competitive Match System
// ============================================================
const Lobby = (() => {
  let currentLobby = null;      // The lobby object if we're in one
  let matchPollInterval = null;  // Timer for polling match updates
  let waitingPollInterval = null;// Timer for polling waiting room
  let selectedTradeStock = null; // Currently selected stock for trading in match
  let lobbyChartType = 'line';   // Chart type for lobby stock modal
  let lobbyDetailHistory = [];   // Stored history for chart redraws
  let stockHistories = {};       // { stockId: [{open,high,low,close}, ...] } for live inline charts
  let matchChartType = 'line';   // 'line' or 'candle' for inline stock cards
  let matchTimerInterval = null; // Client-side 1-second timer
  let matchTimeLeft = 0;         // Seconds remaining (synced from server, decremented locally)
  let matchPolling = false;      // Guard against overlapping poll requests

  // --- MAIN LOAD: checks if user is already in a lobby ---
  async function load() {
    // Check if player is in a lobby
    const activeRes = await API.getMyActiveLobby();
    if (activeRes.ok && activeRes.data.lobby) {
      currentLobby = activeRes.data.lobby;
      if (currentLobby.status === 'active') {
        showMatch(currentLobby.id);
      } else if (currentLobby.status === 'waiting') {
        showWaiting(currentLobby.id);
      }
    } else {
      // Also check for recently finished lobby to show results
      currentLobby = null;
      showBrowser();
    }
  }

  // --- BROWSER: list open lobbies ---
  async function showBrowser() {
    document.getElementById('lobby-browser').style.display = 'block';
    document.getElementById('lobby-waiting').style.display = 'none';
    document.getElementById('lobby-match').style.display = 'none';
    document.getElementById('lobby-results').style.display = 'none';
    stopAllPolling();

    const listEl = document.getElementById('lobby-list');
    listEl.innerHTML = '<p class="placeholder-text">Loading lobbies...</p>';

    const res = await API.getLobbies();
    if (!res.ok) {
      listEl.innerHTML = '<p class="placeholder-text">Failed to load lobbies</p>';
      return;
    }

    const lobbies = res.data.lobbies;
    if (lobbies.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding:3rem;">
          <p>No lobbies right now. Be the first to create one!</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = lobbies.map(l => {
      const rewardText = l.reward_type === 'pool'
        ? `$${parseFloat(l.pool_entry_fee).toFixed(0)} entry`
        : '25/15/7.5% reward';
      return `
        <div class="lobby-card" onclick="Lobby.joinOrView(${l.id})">
          <div>
            <div class="lobby-card-name">${l.name}</div>
            <div class="lobby-card-creator">by ${l.creator_name} · Lv ${l.creator_level}</div>
          </div>
          <div class="lobby-card-meta">
            <span>${l.time_limit_minutes}min</span>
            <span>·</span>
            <span>${l.tick_speed_seconds}s ticks</span>
          </div>
          <div class="lobby-card-players">${l.player_count}/${l.max_players}</div>
          <div>
            <span class="lobby-card-badge ${l.status}">${l.status}</span>
            ${l.is_locked ? '<span class="lobby-card-badge locked" style="margin-left:0.25rem;">🔒</span>' : ''}
            <div class="lobby-card-reward" style="margin-top:0.2rem;">${rewardText}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- JOIN or VIEW a lobby ---
  async function joinOrView(lobbyId) {
    // Check if we're already in this lobby
    if (currentLobby && currentLobby.id === lobbyId) {
      if (currentLobby.status === 'active') showMatch(lobbyId);
      else showWaiting(lobbyId);
      return;
    }

    // Try to get lobby details first
    const detailRes = await API.getLobbyDetails(lobbyId);
    if (!detailRes.ok) {
      showToast(detailRes.data.error || 'Cannot access lobby', 'error');
      return;
    }

    const lobby = detailRes.data.lobby;

    // If it's active, we can only view if we're in it
    if (lobby.status === 'active') {
      const isInIt = detailRes.data.players.some(p => p.user_id === currentUser.id);
      if (isInIt) {
        currentLobby = lobby;
        showMatch(lobbyId);
      } else {
        showToast('This match is already in progress', 'info');
      }
      return;
    }

    // If it's finished
    if (lobby.status === 'finished') {
      showResults(lobbyId);
      return;
    }

    // Try to join (waiting state)
    const isAlreadyIn = detailRes.data.players.some(p => p.user_id === currentUser.id);
    if (!isAlreadyIn) {
      const joinRes = await API.joinLobby(lobbyId);
      if (!joinRes.ok) {
        showToast(joinRes.data.error || 'Failed to join', 'error');
        return;
      }
      showToast('Joined lobby!', 'success');
      // Refresh user money (entry fee may have been deducted)
      const meRes = await API.getMe();
      if (meRes.ok) { currentUser = meRes.data.user; App.updateNav(); }
    }

    currentLobby = lobby;
    showWaiting(lobbyId);
  }

  // --- CREATE LOBBY ---
  function showCreate() {
    document.getElementById('lobby-create-modal').style.display = 'flex';
    document.getElementById('create-error').textContent = '';
  }
  function hideCreate() {
    document.getElementById('lobby-create-modal').style.display = 'none';
  }
  function toggleRewardFields() {
    const type = document.getElementById('create-reward').value;
    document.getElementById('reward-pool-fields').style.display = type === 'pool' ? 'block' : 'none';
    document.getElementById('reward-pct-fields').style.display = type === 'percentage' ? 'block' : 'none';
  }

  async function doCreate() {
    const settings = {
      name: document.getElementById('create-name').value || '',
      timeLimit: parseInt(document.getElementById('create-time').value),
      maxPlayers: parseInt(document.getElementById('create-players').value),
      tickSpeed: parseInt(document.getElementById('create-tick').value),
      isLocked: document.getElementById('create-locked').value === '1',
      rewardType: document.getElementById('create-reward').value,
      entryFee: parseFloat(document.getElementById('create-entry-fee').value) || 500,
    };

    const res = await API.createLobby(settings);
    if (!res.ok) {
      document.getElementById('create-error').textContent = res.data.error || 'Failed to create lobby';
      return;
    }

    hideCreate();
    showToast('Lobby created!', 'success');
    // Refresh user money
    const meRes = await API.getMe();
    if (meRes.ok) { currentUser = meRes.data.user; App.updateNav(); }
    // Go to waiting room
    currentLobby = { id: res.data.lobbyId };
    showWaiting(res.data.lobbyId);
  }

  // --- WAITING ROOM ---
  async function showWaiting(lobbyId) {
    document.getElementById('lobby-browser').style.display = 'none';
    document.getElementById('lobby-waiting').style.display = 'block';
    document.getElementById('lobby-match').style.display = 'none';
    document.getElementById('lobby-results').style.display = 'none';
    stopAllPolling();

    await refreshWaiting(lobbyId);

    // Poll every 3 seconds to see new players / if match started
    waitingPollInterval = setInterval(() => refreshWaiting(lobbyId), 3000);
  }

  async function refreshWaiting(lobbyId) {
    const res = await API.getLobbyDetails(lobbyId);
    if (!res.ok) return;

    const { lobby, players } = res.data;
    currentLobby = lobby;

    // If match started while we were waiting, switch to match view
    if (lobby.status === 'active') {
      stopAllPolling();
      showMatch(lobbyId);
      return;
    }

    // If lobby was deleted/finished, go back
    if (lobby.status === 'finished' || !lobby) {
      stopAllPolling();
      showBrowser();
      showToast('Lobby closed', 'info');
      return;
    }

    document.getElementById('waiting-lobby-name').textContent = lobby.name;
    document.getElementById('waiting-lobby-settings').textContent =
      `${lobby.time_limit_minutes}min · ${lobby.tick_speed_seconds}s ticks · ${lobby.reward_type === 'pool' ? '$' + parseFloat(lobby.pool_entry_fee).toFixed(0) + ' pool' : '25/15/7.5% reward'}`;

    // Settings tags
    document.getElementById('waiting-settings-bar').innerHTML = `
      <span class="lobby-setting-tag"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> ${lobby.time_limit_minutes} min</span>
      <span class="lobby-setting-tag"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> ${lobby.tick_speed_seconds}s ticks</span>
      <span class="lobby-setting-tag">${players.length}/${lobby.max_players} players</span>
      <span class="lobby-setting-tag">${lobby.is_locked ? '🔒 Locked' : '🔓 Open'}</span>
    `;

    // Actions (only creator can start)
    const isCreator = lobby.creator_id === currentUser.id;
    document.getElementById('waiting-actions').innerHTML = isCreator
      ? `<button class="btn btn-primary btn-sm" onclick="Lobby.startMatch(${lobbyId})" ${players.length < 2 ? 'disabled title="Need at least 2 players"' : ''}>
           Start Match (${players.length} players)
         </button>`
      : `<span class="text-muted" style="font-size:0.82rem;">Waiting for host to start...</span>`;

    // Player list
    document.getElementById('waiting-players').innerHTML = players.map(p => {
      const isC = p.user_id === lobby.creator_id;
      const isMe = p.user_id === currentUser.id;
      return `
        <div class="lobby-player-card ${isC ? 'creator' : ''}">
          <div class="lobby-player-avatar">${p.username.charAt(0).toUpperCase()}</div>
          <div>
            <div class="lobby-player-name">${p.username} ${isMe ? '(you)' : ''} ${isC ? '👑' : ''}</div>
          </div>
          <span class="lobby-player-level">Lv ${p.level}</span>
          <span class="lobby-player-money">${formatMoney(p.open_money)}</span>
        </div>
      `;
    }).join('');
  }

  async function startMatch(lobbyId) {
    const res = await API.startLobby(lobbyId);
    if (!res.ok) {
      showToast(res.data.error || 'Failed to start', 'error');
      return;
    }
    stopAllPolling();
    showMatch(lobbyId);
  }

  async function leaveRoom() {
    if (!currentLobby) { showBrowser(); return; }
    const res = await API.leaveLobby(currentLobby.id);
    if (res.ok) {
      showToast('Left lobby', 'info');
      // Refresh money (refund)
      const meRes = await API.getMe();
      if (meRes.ok) { currentUser = meRes.data.user; App.updateNav(); }
    }
    currentLobby = null;
    stopAllPolling();
    showBrowser();
  }

  // --- ACTIVE MATCH ---
  async function showMatch(lobbyId) {
    document.getElementById('lobby-browser').style.display = 'none';
    document.getElementById('lobby-waiting').style.display = 'none';
    document.getElementById('lobby-match').style.display = 'block';
    document.getElementById('lobby-results').style.display = 'none';
    stopAllPolling();
    selectedTradeStock = null;
    stockHistories = {};
    matchChartType = 'line';

    // Get lobby details for name
    const detailRes = await API.getLobbyDetails(lobbyId);
    if (detailRes.ok) {
      document.getElementById('match-lobby-name').textContent = detailRes.data.lobby.name;
    }

    // Fetch initial price histories for all stocks (full OHLCV for candlestick support)
    const histRes = await API.getAllLobbyHistory(lobbyId);
    if (histRes.ok && histRes.data.histories) {
      for (const [stockId, hist] of Object.entries(histRes.data.histories)) {
        stockHistories[stockId] = hist.map(h => ({
          open: h.open_price || h.price,
          high: h.high_price || h.price,
          low: h.low_price || h.price,
          close: h.close_price || h.price,
        }));
      }
    }

    // Initial tick + render
    await refreshMatch(lobbyId);

    // Start client-side timer (smooth 1-second countdown)
    matchTimerInterval = setInterval(() => {
      if (matchTimeLeft > 0) {
        matchTimeLeft--;
        renderTimer();
      }
    }, 1000);

    // Poll server every 2 seconds for price/ranking updates
    matchPollInterval = setInterval(() => refreshMatch(lobbyId), 2000);
  }

  // Render the countdown timer from local state
  function renderTimer() {
    const mins = Math.floor(matchTimeLeft / 60);
    const secs = matchTimeLeft % 60;
    document.getElementById('match-timer-text').textContent =
      `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.getElementById('match-timer').classList.toggle('urgent', matchTimeLeft < 30);
  }

  // Toggle inline chart type (line / candle)
  function toggleMatchChartType() {
    matchChartType = matchChartType === 'line' ? 'candle' : 'line';
    // Update button text
    const btn = document.getElementById('match-chart-toggle');
    if (btn) btn.textContent = matchChartType === 'line' ? '📊 Candles' : '📈 Line';
    // Redraw all charts immediately
    redrawAllCharts();
  }

  function redrawAllCharts() {
    requestAnimationFrame(() => {
      for (const [stockId, data] of Object.entries(stockHistories)) {
        if (data.length > 1) {
          drawMatchChart(`match-chart-${stockId}`, data, matchChartType);
        }
      }
    });
  }

  async function refreshMatch(lobbyId) {
    // Guard against overlapping poll requests
    if (matchPolling) return;
    matchPolling = true;

    try {
      // Fetch tick data and portfolio in PARALLEL (faster)
      const [tickRes, pfRes] = await Promise.all([
        API.lobbyTick(lobbyId),
        API.getLobbyPortfolio(lobbyId),
      ]);

      if (!tickRes.ok) {
        if (tickRes.data.error === 'Lobby is not active') {
          stopAllPolling();
          showResults(lobbyId);
        }
        return;
      }

      if (tickRes.data.matchEnded) {
        stopAllPolling();
        showResults(lobbyId);
        return;
      }

      const { prices, rankings, timeRemaining } = tickRes.data;

      // Sync client-side timer from server (prevents drift)
      matchTimeLeft = timeRemaining;
      renderTimer();

      // Append new OHLCV data if price has CHANGED since last recorded point.
      // This fixes the multi-tab bug: only one tab gets ticked=true, but both
      // tabs see the new current_price. By comparing to the last stored close,
      // both tabs append the new data point.
      prices.forEach(s => {
        if (!stockHistories[s.id]) stockHistories[s.id] = [];
        const hist = stockHistories[s.id];
        const lastClose = hist.length > 0 ? hist[hist.length - 1].close : null;
        // Append if this is a new price we haven't recorded yet
        if (lastClose === null || lastClose !== s.current_price) {
          const open = s.previous_price || s.current_price;
          const close = s.current_price;
          const high = Math.max(open, close) * (1 + Math.random() * 0.003);
          const low = Math.min(open, close) * (1 - Math.random() * 0.003);
          hist.push({ open, high, low, close });
          if (hist.length > 120) hist.shift();
        }
      });

    // Render stock cards grid
    const gridEl = document.getElementById('match-stocks-grid');
    gridEl.innerHTML = prices.map(s => {
      const pct = s.previous_price > 0 ? ((s.current_price - s.previous_price) / s.previous_price * 100) : 0;
      const dir = changeClass(s.current_price, s.previous_price);
      const sel = selectedTradeStock && selectedTradeStock.id === s.id ? 'selected' : '';
      return `
        <div class="match-stock-card ${sel}" onclick="Lobby.selectStock(${s.id}, '${s.symbol}', ${s.current_price})">
          <div class="match-stock-card-header">
            <div style="display:flex;align-items:center;">
              <span class="match-stock-card-symbol">${s.symbol}</span>
              <span class="match-stock-card-change ${dir}">${formatPercent(pct)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:0.4rem;">
              <span class="match-stock-card-price">${formatMoney(s.current_price)}</span>
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); Lobby.openStockModal(${s.id})" style="padding:0.2rem 0.4rem;" title="Full detail">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              </button>
            </div>
          </div>
          <div class="match-stock-chart-wrap">
            <canvas id="match-chart-${s.id}"></canvas>
          </div>
        </div>
      `;
    }).join('');

    // Draw charts after HTML renders (only needed because we rebuild DOM)
    redrawAllCharts();

    // Update selected trade stock price if open
    if (selectedTradeStock) {
      const updated = prices.find(p => p.id === selectedTradeStock.id);
      if (updated) {
        selectedTradeStock.current_price = updated.current_price;
        const tradePrice = document.getElementById('match-trade-price');
        if (tradePrice) tradePrice.textContent = formatMoney(updated.current_price);
        updateMatchTradeTotal();
      }
    }

    // Update rankings
    document.getElementById('match-rankings').innerHTML = rankings.map((r, i) => {
      const pos = i + 1;
      const posClass = pos === 1 ? 'gold' : pos === 2 ? 'silver' : pos === 3 ? 'bronze' : '';
      const isMe = r.user_id === currentUser.id;
      return `
        <div class="match-rank-row ${isMe ? 'is-me' : ''}">
          <span class="match-rank-pos ${posClass}">#${pos}</span>
          <span class="match-rank-name">${r.username}${isMe ? ' (you)' : ''}</span>
          <span class="match-rank-worth ${r.netWorth >= 10000 ? 'text-gain' : 'text-loss'}">${formatMoney(r.netWorth)}</span>
        </div>
      `;
    }).join('');

    // Update portfolio (already fetched in parallel above)
    if (pfRes.ok) {
      document.getElementById('match-cash').textContent = formatMoney(pfRes.data.cash);
      const holdings = pfRes.data.holdings;
      if (holdings.length === 0) {
        document.getElementById('match-portfolio').innerHTML = '<p class="text-muted" style="font-size:0.78rem;">No holdings yet</p>';
      } else {
        document.getElementById('match-portfolio').innerHTML = holdings.map(h => `
          <div class="match-holding-row">
            <div>
              <span class="mono" style="font-weight:600;font-size:0.82rem;">${h.symbol}</span>
              <span class="text-muted" style="font-size:0.7rem;margin-left:0.3rem;">${h.shares} shares</span>
            </div>
            <span class="mono ${formatPnlColor(h.profitLoss)}" style="font-size:0.78rem;">${formatMoney(h.profitLoss)}</span>
          </div>
        `).join('');
      }

      if (selectedTradeStock) {
        const held = holdings.find(h => h.stock_id === selectedTradeStock.id);
        const holdingEl = document.getElementById('match-trade-holding');
        if (holdingEl) holdingEl.textContent = held ? `You own: ${held.shares} shares` : 'You own: 0 shares';
        const sellBtn = document.getElementById('match-sell-btn');
        if (sellBtn) sellBtn.disabled = !held || held.shares <= 0;
      }
    }
    } finally {
      matchPolling = false;
    }
  }

  // --- INLINE CHART DRAWING (supports line + candlestick) ---
  function drawMatchChart(canvasId, data, type) {
    if (type === 'candle') {
      drawMatchCandleChart(canvasId, data);
    } else {
      drawMatchLineChart(canvasId, data);
    }
  }

  function drawMatchLineChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const pad = { top: 8, right: 8, bottom: 8, left: 8 };
    const w = canvas.width - pad.left - pad.right;
    const h = canvas.height - pad.top - pad.bottom;

    const closes = data.map(d => d.close);
    const min = Math.min(...closes) * 0.998;
    const max = Math.max(...closes) * 1.002;
    const range = max - min || 1;

    const isUp = closes[closes.length - 1] >= closes[0];
    const lineColor = isUp ? '#22c55e' : '#ef4444';
    const fillColor = isUp ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';

    const points = closes.map((val, i) => ({
      x: pad.left + (i / (closes.length - 1)) * w,
      y: pad.top + h - ((val - min) / range) * h,
    }));

    // Fill area
    ctx.beginPath();
    ctx.moveTo(points[0].x, canvas.height - pad.bottom);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, canvas.height - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // End dot
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();

    // Price labels
    ctx.fillStyle = '#64748b';
    ctx.font = '9px JetBrains Mono';
    ctx.textAlign = 'left';
    ctx.fillText('$' + max.toFixed(2), pad.left + 2, pad.top + 9);
    ctx.fillText('$' + min.toFixed(2), pad.left + 2, canvas.height - pad.bottom - 2);
  }

  function drawMatchCandleChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const pad = { top: 8, right: 8, bottom: 8, left: 8 };
    const w = canvas.width - pad.left - pad.right;
    const h = canvas.height - pad.top - pad.bottom;

    // Find price range
    let allMin = Infinity, allMax = -Infinity;
    data.forEach(c => {
      allMin = Math.min(allMin, c.low);
      allMax = Math.max(allMax, c.high);
    });
    allMin *= 0.998;
    allMax *= 1.002;
    const range = allMax - allMin || 1;

    const priceToY = (price) => pad.top + h - ((price - allMin) / range) * h;

    const candleSpacing = w / data.length;
    const candleWidth = Math.max(2, Math.min(8, candleSpacing * 0.6));

    data.forEach((c, i) => {
      const isGreen = c.close >= c.open;
      const color = isGreen ? '#22c55e' : '#ef4444';

      const x = pad.left + (i + 0.5) * candleSpacing;
      const yOpen = priceToY(c.open);
      const yClose = priceToY(c.close);
      const yHigh = priceToY(c.high);
      const yLow = priceToY(c.low);

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(1, Math.abs(yOpen - yClose));
      ctx.fillStyle = color;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

    // Price labels
    ctx.fillStyle = '#64748b';
    ctx.font = '9px JetBrains Mono';
    ctx.textAlign = 'left';
    ctx.fillText('$' + allMax.toFixed(2), pad.left + 2, pad.top + 9);
    ctx.fillText('$' + allMin.toFixed(2), pad.left + 2, canvas.height - pad.bottom - 2);
  }

  function selectStock(stockId, symbol, price) {
    selectedTradeStock = { id: stockId, symbol, current_price: price };
    document.getElementById('match-trade-panel').style.display = 'block';
    document.getElementById('match-trade-symbol').textContent = symbol;
    document.getElementById('match-trade-price').textContent = formatMoney(price);
    document.getElementById('match-trade-shares').value = 1;
    updateMatchTradeTotal();
    document.querySelectorAll('.match-stock-card').forEach(c => c.classList.remove('selected'));
  }

  function closeTrade() {
    selectedTradeStock = null;
    document.getElementById('match-trade-panel').style.display = 'none';
  }

  function updateMatchTradeTotal() {
    if (!selectedTradeStock) return;
    const shares = parseInt(document.getElementById('match-trade-shares').value) || 0;
    document.getElementById('match-trade-total').textContent = formatMoney(shares * selectedTradeStock.current_price);
  }

  async function matchTrade(type) {
    if (!selectedTradeStock || !currentLobby) return;
    const shares = parseInt(document.getElementById('match-trade-shares').value);
    if (!shares || shares < 1) {
      showToast('Enter a valid number of shares', 'error');
      return;
    }

    let res;
    if (type === 'buy') {
      res = await API.lobbyBuy(currentLobby.id, selectedTradeStock.id, shares);
    } else {
      res = await API.lobbySell(currentLobby.id, selectedTradeStock.id, shares);
    }

    if (res.ok) {
      showToast(res.data.message, 'success');
      document.getElementById('match-cash').textContent = formatMoney(res.data.newBalance);
    } else {
      showToast(res.data.error || 'Trade failed', 'error');
    }
  }

  // --- POST-GAME RESULTS ---
  async function showResults(lobbyId) {
    document.getElementById('lobby-browser').style.display = 'none';
    document.getElementById('lobby-waiting').style.display = 'none';
    document.getElementById('lobby-match').style.display = 'none';
    document.getElementById('lobby-results').style.display = 'block';
    stopAllPolling();

    const res = await API.getLobbyResults(lobbyId);
    if (!res.ok) {
      document.getElementById('results-content').innerHTML =
        `<p class="error-message">${res.data.error || 'Failed to load results'}</p>
         <button class="btn btn-secondary btn-sm" onclick="Lobby.backToBrowser()" style="margin-top:1rem;">Back to Lobbies</button>`;
      return;
    }

    const { lobby, results } = res.data;
    const myResult = results.find(r => r.user_id === currentUser.id);
    const myPlacement = myResult ? myResult.placement : '-';
    const placementEmoji = myPlacement === 1 ? '🥇' : myPlacement === 2 ? '🥈' : myPlacement === 3 ? '🥉' : '🏁';

    document.getElementById('results-content').innerHTML = `
      <div class="results-card">
        <span class="results-placement">${placementEmoji}</span>
        <h2>Match Complete!</h2>
        <p class="text-muted" style="font-size:0.9rem;">${lobby.name}</p>
        ${myResult ? `
          <div style="margin-top:1rem;">
            <span class="text-muted">Your Placement: </span>
            <strong style="font-size:1.2rem;">#${myPlacement}</strong>
            ${myResult.reward_earned > 0 ? `<span class="results-reward" style="margin-left:1rem;">+${formatMoney(myResult.reward_earned)}</span>` : ''}
            ${myResult.xp_earned > 0 ? `<span class="results-xp" style="margin-left:0.75rem;">+${myResult.xp_earned} XP</span>` : ''}
          </div>
          ${myPlacement <= 3 ? `
            <div style="margin-top:1rem;">
              <button class="btn btn-primary" onclick="Cosmetics.openCrate(${myPlacement})" style="background:linear-gradient(135deg,var(--accent),#3b82f6);font-size:1rem;padding:0.7rem 1.5rem;">
                🎁 Open Crate Spin!
              </button>
              <div class="text-muted" style="font-size:0.78rem;margin-top:0.3rem;">Top 3 placement reward — spin for a cosmetic item!</div>
            </div>
          ` : ''}
        ` : ''}
      </div>

      <table class="results-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Final Money</th>
            <th>Profit</th>
            <th>Trades</th>
            <th>Reward</th>
            <th>XP</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(r => {
            const isMe = r.user_id === currentUser.id;
            const profit = (r.final_money || 0) - 10000;
            return `
              <tr class="${isMe ? 'is-me' : ''}">
                <td class="rank-cell">#${r.placement}</td>
                <td style="font-family:var(--font-display);font-weight:${isMe ? '700' : '500'};">${r.username}${isMe ? ' (you)' : ''}</td>
                <td>${formatMoney(r.final_money)}</td>
                <td class="${formatPnlColor(profit)}">${formatMoney(profit)}</td>
                <td>${r.tradeStats ? (r.tradeStats.buys + r.tradeStats.sells) : 0}</td>
                <td class="results-reward">${r.reward_earned > 0 ? '+' + formatMoney(r.reward_earned) : '-'}</td>
                <td class="results-xp">+${r.xp_earned || 0}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div style="text-align:center;margin-top:1.5rem;">
        <button class="btn btn-primary" onclick="Lobby.backToBrowser()">Back to Lobbies</button>
      </div>
    `;

    // Refresh user data (rewards + XP applied)
    const meRes = await API.getMe();
    if (meRes.ok) { currentUser = meRes.data.user; App.updateNav(); }
    currentLobby = null;
  }

  function backToBrowser() {
    currentLobby = null;
    showBrowser();
  }

  // --- LOBBY STOCK DETAIL MODAL (with chart) ---
  async function openStockModal(stockId) {
    if (!currentLobby) return;
    lobbyChartType = 'line';
    lobbyDetailHistory = [];

    const modal = document.getElementById('lobby-stock-modal');
    const content = document.getElementById('lobby-stock-detail-content');
    modal.style.display = 'flex';
    content.innerHTML = '<p class="placeholder-text">Loading stock data...</p>';

    const res = await API.getLobbyStockDetail(currentLobby.id, stockId);
    if (!res.ok) {
      content.innerHTML = `<p class="error-message">${res.data.error || 'Failed to load stock'}</p>`;
      return;
    }

    const { stock, history, holding } = res.data;
    lobbyDetailHistory = history;
    renderLobbyStockModal(stock, history, holding);
  }

  function renderLobbyStockModal(stock, history, holding) {
    const content = document.getElementById('lobby-stock-detail-content');
    const pct = stock.previous_price > 0 ? ((stock.current_price - stock.previous_price) / stock.previous_price * 100) : 0;
    const dir = changeClass(stock.current_price, stock.previous_price);
    const basePct = stock.base_price > 0 ? ((stock.current_price - stock.base_price) / stock.base_price * 100) : 0;

    content.innerHTML = `
      <div class="stock-detail-header">
        <div class="sd-left">
          <h2>${stock.name}</h2>
          <span class="sd-symbol">${stock.symbol}</span>
        </div>
        <div style="text-align:right;">
          <div class="sd-price">${formatMoney(stock.current_price)}</div>
          <div class="sd-price-change ${dir === 'up' ? 'text-gain' : dir === 'down' ? 'text-loss' : 'text-muted'}">
            ${formatPercent(pct)} · Base ${formatPercent(basePct)}
          </div>
        </div>
      </div>

      <div class="chart-controls">
        <div class="chart-controls-left">
          <button class="chart-toggle-btn ${lobbyChartType === 'line' ? 'active' : ''}" id="lobby-btn-line" onclick="Lobby.setChartType('line')">Line</button>
          <button class="chart-toggle-btn ${lobbyChartType === 'candle' ? 'active' : ''}" id="lobby-btn-candle" onclick="Lobby.setChartType('candle')">Candlestick</button>
        </div>
        <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-dim);">
          Volatility: ${(stock.volatility * 100).toFixed(1)}%
        </div>
      </div>

      <div class="chart-container" id="lobby-stock-chart">
        ${history.length > 1
          ? '<canvas id="lobby-chart-canvas" style="width:100%;height:100%;"></canvas>'
          : '<span>Waiting for price data — prices update every few seconds</span>'
        }
      </div>

      ${holding.shares > 0 ? `
        <div class="trade-holding-info" style="margin-bottom:1rem;">
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
            <input type="number" id="lobby-modal-buy-shares" min="1" value="1" oninput="Lobby.updateModalTradeTotal('buy', ${stock.current_price})">
          </div>
          <div class="trade-total" id="lobby-modal-buy-total">Total: ${formatMoney(stock.current_price)}</div>
          <button class="btn btn-primary btn-full btn-sm" onclick="Lobby.modalTrade('buy', ${stock.id}, ${stock.current_price})">Buy Shares</button>
        </div>
        <div class="trade-section sell-section">
          <h4>Sell ${stock.symbol}</h4>
          <div class="trade-input-row">
            <input type="number" id="lobby-modal-sell-shares" min="1" max="${holding.shares}" value="1" ${holding.shares <= 0 ? 'disabled' : ''}
                   oninput="Lobby.updateModalTradeTotal('sell', ${stock.current_price})">
          </div>
          <div class="trade-total" id="lobby-modal-sell-total">Total: ${formatMoney(stock.current_price)}</div>
          <button class="btn btn-danger btn-full btn-sm" onclick="Lobby.modalTrade('sell', ${stock.id}, ${stock.current_price})" ${holding.shares <= 0 ? 'disabled' : ''}>Sell Shares</button>
        </div>
      </div>
    `;

    // Draw the chart
    if (history.length > 1) {
      Market.drawChart('lobby-chart-canvas', history, lobbyChartType);
    }
  }

  function setChartType(type) {
    lobbyChartType = type;
    const lineBtn = document.getElementById('lobby-btn-line');
    const candleBtn = document.getElementById('lobby-btn-candle');
    if (lineBtn) lineBtn.classList.toggle('active', type === 'line');
    if (candleBtn) candleBtn.classList.toggle('active', type === 'candle');
    if (lobbyDetailHistory.length > 1) {
      Market.drawChart('lobby-chart-canvas', lobbyDetailHistory, lobbyChartType);
    }
  }

  function updateModalTradeTotal(type, pricePerShare) {
    const input = document.getElementById(`lobby-modal-${type}-shares`);
    const totalEl = document.getElementById(`lobby-modal-${type}-total`);
    const shares = parseInt(input.value) || 0;
    totalEl.textContent = `Total: ${formatMoney(shares * pricePerShare)}`;
  }

  async function modalTrade(type, stockId, price) {
    if (!currentLobby) return;
    const input = document.getElementById(`lobby-modal-${type}-shares`);
    const shares = parseInt(input.value);
    if (!shares || shares < 1) {
      showToast('Enter a valid number of shares', 'error');
      return;
    }

    let res;
    if (type === 'buy') {
      res = await API.lobbyBuy(currentLobby.id, stockId, shares);
    } else {
      res = await API.lobbySell(currentLobby.id, stockId, shares);
    }

    if (res.ok) {
      showToast(res.data.message, 'success');
      document.getElementById('match-cash').textContent = formatMoney(res.data.newBalance);
      // Refresh the modal
      openStockModal(stockId);
    } else {
      showToast(res.data.error || 'Trade failed', 'error');
    }
  }

  function closeStockModal() {
    document.getElementById('lobby-stock-modal').style.display = 'none';
    lobbyDetailHistory = [];
  }

  // --- CLEANUP ---
  function stopAllPolling() {
    if (matchPollInterval) { clearInterval(matchPollInterval); matchPollInterval = null; }
    if (waitingPollInterval) { clearInterval(waitingPollInterval); waitingPollInterval = null; }
    if (matchTimerInterval) { clearInterval(matchTimerInterval); matchTimerInterval = null; }
    matchPolling = false;
  }

  return {
    load, showCreate, hideCreate, doCreate, toggleRewardFields,
    joinOrView, leaveRoom, startMatch,
    selectStock, closeTrade, updateMatchTradeTotal, matchTrade,
    backToBrowser, toggleMatchChartType,
    openStockModal, closeStockModal, setChartType,
    updateModalTradeTotal, modalTrade,
  };
})();

// ============================================================
// CHAT — Global Chat Panel
// ============================================================
const Chat = (() => {
  let isOpen = false;
  let chatPollInterval = null;
  let lastMessageTime = null;
  let unreadCount = 0;

  // Called on login — initializes chat
  function init() {
    // Check if chat is enabled
    API.getChatStatus().then(res => {
      if (res.ok && res.data.chatEnabled) {
        document.getElementById('chat-panel').style.display = 'block';
        startPolling();
      }
    });
  }

  function toggle() {
    isOpen = !isOpen;
    const panel = document.getElementById('chat-panel');
    const body = document.getElementById('chat-body');
    panel.classList.toggle('open', isOpen);
    body.style.display = isOpen ? 'block' : 'none';

    if (isOpen) {
      unreadCount = 0;
      document.getElementById('chat-badge').style.display = 'none';
      // Scroll to bottom
      const msgs = document.getElementById('chat-messages');
      msgs.scrollTop = msgs.scrollHeight;
      // Focus input
      document.getElementById('chat-input').focus();
    }
  }

  function startPolling() {
    // Initial load
    loadMessages();
    // Poll every 4 seconds
    chatPollInterval = setInterval(loadMessages, 4000);
  }

  function stopPolling() {
    if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
  }

  async function loadMessages() {
    const res = await API.getChatMessages(lastMessageTime || '');
    if (!res.ok) return;
    if (res.data.disabled) {
      document.getElementById('chat-messages').innerHTML =
        '<p class="placeholder-text" style="padding:1rem;">Chat is currently disabled.</p>';
      return;
    }

    const msgs = res.data.messages;
    if (msgs.length === 0 && !lastMessageTime) {
      document.getElementById('chat-messages').innerHTML =
        '<p class="placeholder-text" style="padding:1rem;">No messages yet. Say hi!</p>';
      return;
    }

    if (msgs.length > 0) {
      const container = document.getElementById('chat-messages');
      // If this is the first load (no lastMessageTime), replace content
      if (!lastMessageTime) {
        container.innerHTML = '';
      }

      msgs.forEach(m => {
        const div = document.createElement('div');
        div.className = 'chat-msg';
        const time = new Date(m.created_at + 'Z');
        const timeStr = time.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
        const isMe = currentUser && m.username === currentUser.username;
        const chatTitle = m.equipped_title
          ? (typeof Cosmetics !== 'undefined' && Cosmetics.COSMETIC_TITLE_MAP[m.equipped_title]
             ? Cosmetics.COSMETIC_TITLE_MAP[m.equipped_title]
             : '')
          : '';
        div.innerHTML = `
          <span class="chat-msg-user" style="${isMe ? 'color:var(--gain);' : ''}">${m.username}</span>
          ${chatTitle ? `<span class="title-display" style="color:var(--amber);font-size:0.65rem;">${chatTitle}</span>` : ''}
          <span class="chat-msg-level">Lv${m.level}</span>
          <span class="chat-msg-time">${timeStr}</span>
          <div class="chat-msg-text">${m.message}</div>
        `;
        container.appendChild(div);
      });

      // Scroll to bottom
      container.scrollTop = container.scrollHeight;

      // Update last message time
      lastMessageTime = msgs[msgs.length - 1].created_at;

      // Show unread badge if closed
      if (!isOpen && lastMessageTime) {
        unreadCount += msgs.length;
        const badge = document.getElementById('chat-badge');
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = 'inline';
      }
    }
  }

  async function send() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    const res = await API.sendChatMessage(message);
    if (!res.ok) {
      showToast(res.data.error || 'Failed to send message', 'error');
      input.value = message; // Restore on failure
      return;
    }

    // Immediately poll for new messages
    await loadMessages();
  }

  return { init, toggle, send, stopPolling };
})();

// ============================================================
// GLOSSARY — Trading Terms & Educational Content
// ============================================================
const Glossary = (() => {
  let currentCategory = 'all';

  const TERMS = [
    // Basics
    { term: 'Stock', definition: 'A share of ownership in a company. When you buy a stock, you own a tiny piece of that business.', category: 'basics' },
    { term: 'Share', definition: 'A single unit of stock. If you buy 10 shares of Apple, you own 10 units of Apple stock.', category: 'basics' },
    { term: 'Portfolio', definition: 'The collection of all stocks (and other investments) you currently own.', category: 'basics' },
    { term: 'Balance / Cash', definition: 'The money you have available to buy stocks. In BullRun, everyone starts with $10,000.', category: 'basics' },
    { term: 'Net Worth', definition: 'Your total value — cash plus the current value of all stocks you own.', category: 'basics' },
    { term: 'Broker', definition: 'A company that executes your buy and sell orders. In real life, popular brokers include CommSec, Interactive Brokers, and Robinhood.', category: 'basics' },
    { term: 'Exchange', definition: 'A marketplace where stocks are bought and sold, like the ASX (Australian Securities Exchange) or NYSE (New York Stock Exchange).', category: 'basics' },
    { term: 'Ticker Symbol', definition: 'A short code that identifies a stock. For example, AAPL = Apple, TSLA = Tesla. BullRun uses these for all stocks.', category: 'basics' },
    { term: 'Dividend', definition: 'A payment a company makes to its shareholders from its profits. Not all companies pay dividends.', category: 'basics' },
    { term: 'IPO', definition: 'Initial Public Offering — when a company first sells its stock to the public. Before an IPO, the company is "private."', category: 'basics' },

    // Trading
    { term: 'Market Order', definition: 'Buying or selling a stock at the current market price — this is what BullRun uses. You get the stock immediately at whatever the price is right now.', category: 'trading' },
    { term: 'Limit Order', definition: 'An order to buy or sell only at a specific price or better. Unlike market orders, these might not execute immediately.', category: 'trading' },
    { term: 'Stop Loss', definition: 'An order that automatically sells your stock if the price drops to a certain level. It limits how much you can lose on a trade.', category: 'trading' },
    { term: 'Buy / Long', definition: 'Buying a stock because you think the price will go up. You profit when the price rises.', category: 'trading' },
    { term: 'Sell / Close Position', definition: 'Selling stock you own. "Closing a position" means selling all your shares of a particular stock.', category: 'trading' },
    { term: 'Short Selling', definition: 'Borrowing stock and selling it, hoping to buy it back cheaper later. You profit when prices fall. Very risky — not available in BullRun.', category: 'trading' },
    { term: 'Day Trading', definition: 'Buying and selling stocks within the same day, trying to profit from small price movements.', category: 'trading' },
    { term: 'Position', definition: 'The amount of a particular stock you own. "Opening a position" means buying, "closing" means selling all of it.', category: 'trading' },
    { term: 'Cost Basis', definition: 'The average price you paid for your shares. BullRun shows this as "Avg Buy Price" — your profit/loss is calculated from this number.', category: 'trading' },
    { term: 'Realised vs Unrealised Gains', definition: 'Unrealised = your stock went up but you haven\'t sold yet (paper profit). Realised = you sold and locked in the profit/loss.', category: 'trading' },
    { term: 'Dollar-Cost Averaging', definition: 'Investing a fixed amount regularly regardless of price. This smooths out the impact of volatility over time.', category: 'trading' },
    { term: 'Partial Profit', definition: 'Selling some of your shares while keeping the rest. This locks in some profit while staying in the trade.', category: 'trading' },

    // Analysis
    { term: 'Volatility', definition: 'How much a stock\'s price swings up and down. High volatility = bigger moves = more risk and more opportunity. In BullRun, each stock has a volatility rating.', category: 'analysis' },
    { term: 'Candlestick Chart', definition: 'A chart showing four prices per period: open, high, low, close. Green candles = price went up. Red candles = price went down. The "wicks" show the high and low.', category: 'analysis' },
    { term: 'Line Chart', definition: 'A simple chart connecting closing prices over time. Easier to read than candlesticks but shows less detail.', category: 'analysis' },
    { term: 'Support Level', definition: 'A price level where a stock tends to stop falling because buyers step in. Think of it as a "floor."', category: 'analysis' },
    { term: 'Resistance Level', definition: 'A price level where a stock tends to stop rising because sellers step in. Think of it as a "ceiling."', category: 'analysis' },
    { term: 'Trend', definition: 'The general direction a stock is moving — up (bullish), down (bearish), or sideways (consolidating).', category: 'analysis' },
    { term: 'Moving Average', definition: 'The average price over a set number of periods. Traders use 50-day and 200-day moving averages to identify trends.', category: 'analysis' },
    { term: 'Volume', definition: 'The number of shares traded in a given period. High volume confirms a price move is significant.', category: 'analysis' },
    { term: 'Fundamental Analysis', definition: 'Evaluating a stock by examining the company\'s financials, revenue, profits, and business model to determine if the price is fair.', category: 'analysis' },
    { term: 'Technical Analysis', definition: 'Predicting future price movements by studying charts, patterns, and indicators. Candlestick charts are a key tool.', category: 'analysis' },

    // Market
    { term: 'Bull Market', definition: 'A market where prices are generally rising. Investors are optimistic. The bull charges upward — that\'s where BullRun gets its name!', category: 'market' },
    { term: 'Bear Market', definition: 'A market where prices are generally falling (20%+ decline). Investors are pessimistic. The bear swipes downward.', category: 'market' },
    { term: 'Market Cap', definition: 'A company\'s total value = stock price × total shares. Apple\'s market cap is over $3 trillion, making it the most valuable company.', category: 'market' },
    { term: 'Sector', definition: 'A group of similar companies. Common sectors: Technology, Healthcare, Finance, Energy, Consumer. BullRun labels each stock\'s sector.', category: 'market' },
    { term: 'Blue Chip', definition: 'A large, well-established company with a reliable track record. Apple, Microsoft, and Coca-Cola are blue chip stocks.', category: 'market' },
    { term: 'Penny Stock', definition: 'A stock trading below $5. Very risky and volatile. Some BullRun fictional stocks start in this range.', category: 'market' },
    { term: 'Market Correction', definition: 'A 10-20% price drop from recent highs. Corrections are normal and happen regularly in real markets.', category: 'market' },
    { term: 'Crash', definition: 'A sudden, severe price drop (20%+) across the whole market. Famous crashes: 1929, 2008, March 2020.', category: 'market' },
    { term: 'Liquidity', definition: 'How easily you can buy or sell a stock without affecting its price. Popular stocks like Apple have high liquidity.', category: 'market' },
    { term: 'Mean Reversion', definition: 'The theory that prices tend to return to their average over time. BullRun uses this — stocks gently pull back toward their base price.', category: 'market' },

    // Slang
    { term: 'Diamond Hands 💎🙌', definition: 'Holding a stock through big drops without selling. The opposite of "paper hands." Popular meme term from Reddit.', category: 'slang' },
    { term: 'Paper Hands 📄🙌', definition: 'Selling too early out of fear. The opposite of "diamond hands."', category: 'slang' },
    { term: 'YOLO', definition: '"You Only Live Once" — putting all your money into one risky trade. Not recommended in real life!', category: 'slang' },
    { term: 'To The Moon 🚀', definition: 'When a stock price is skyrocketing. "This stock is going to the moon!"', category: 'slang' },
    { term: 'Bag Holder', definition: 'Someone stuck holding a stock that has dropped significantly. They\'re "holding the bag."', category: 'slang' },
    { term: 'FOMO', definition: 'Fear Of Missing Out — buying a stock because everyone else is, usually at the top. Often leads to losses.', category: 'slang' },
    { term: 'FUD', definition: 'Fear, Uncertainty, Doubt — negative news or rumours that make people panic sell.', category: 'slang' },
    { term: 'Whale', definition: 'A trader with a lot of money who can move the market with their trades. In BullRun, heavy buying adds "buy pressure" to stocks.', category: 'slang' },
    { term: 'Pump and Dump', definition: 'Artificially inflating a stock\'s price (pump), then selling at the top (dump). This is illegal in real markets.', category: 'slang' },
    { term: 'Buy the Dip', definition: 'Buying a stock after its price drops, expecting it to recover. Works great when the company is strong, risky when it\'s not.', category: 'slang' },
  ];

  function load() {
    renderTerms();
  }

  function setCategory(cat) {
    currentCategory = cat;
    document.querySelectorAll('.glos-cat').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
    renderTerms();
  }

  function filter() {
    renderTerms();
  }

  function renderTerms() {
    const search = (document.getElementById('glossary-search-input')?.value || '').toLowerCase();
    let filtered = TERMS;
    if (currentCategory !== 'all') filtered = filtered.filter(t => t.category === currentCategory);
    if (search) filtered = filtered.filter(t => t.term.toLowerCase().includes(search) || t.definition.toLowerCase().includes(search));

    const el = document.getElementById('glossary-list');
    if (filtered.length === 0) {
      el.innerHTML = '<p class="empty-state">No terms found matching your search.</p>';
      return;
    }

    el.innerHTML = filtered.map(t => `
      <div class="glos-item">
        <div class="glos-term">${t.term}</div>
        <div class="glos-def">${t.definition}</div>
        <span class="glos-cat-tag">${t.category}</span>
      </div>
    `).join('');
  }

  return { load, setCategory, filter };
})();

// ============================================================
// TOOLTIP — JS-positioned tooltips that can't be clipped
// ============================================================
// Edu-tip icons (ⓘ) with data-tip attribute show a floating
// popup on hover. The popup is appended to <body> with
// position:fixed so overflow:hidden on parents can't clip it.
// ============================================================
(() => {
  let popup = null;

  function getPopup() {
    if (!popup) {
      popup = document.createElement('div');
      popup.className = 'edu-tooltip-popup';
      document.body.appendChild(popup);
    }
    return popup;
  }

  document.addEventListener('mouseover', (e) => {
    const tip = e.target.closest('.edu-tip');
    if (!tip || !tip.dataset.tip) return;

    const p = getPopup();
    p.textContent = tip.dataset.tip;
    p.classList.add('visible');

    // Position below the icon
    const rect = tip.getBoundingClientRect();
    let left = rect.left + rect.width / 2;
    let top = rect.bottom + 8;

    // Measure popup size
    requestAnimationFrame(() => {
      const pw = p.offsetWidth;
      const ph = p.offsetHeight;

      // Keep within viewport horizontally
      if (left - pw / 2 < 8) left = 8 + pw / 2;
      if (left + pw / 2 > window.innerWidth - 8) left = window.innerWidth - 8 - pw / 2;

      // If it would go below viewport, show above instead
      if (top + ph > window.innerHeight - 8) {
        top = rect.top - ph - 8;
      }

      p.style.left = (left - pw / 2) + 'px';
      p.style.top = top + 'px';
    });
  });

  document.addEventListener('mouseout', (e) => {
    const tip = e.target.closest('.edu-tip');
    if (!tip) return;
    if (popup) popup.classList.remove('visible');
  });
})();

// ============================================================
// ADMIN — Admin Panel Module
// ============================================================
const Admin = (() => {
  let allUsers = [];
  let chatEnabled = true;

  function showModal() {
    document.getElementById('admin-modal').style.display = 'flex';
    document.getElementById('admin-password-input').value = '';
    document.getElementById('admin-password-error').textContent = '';
    setTimeout(() => document.getElementById('admin-password-input').focus(), 100);
  }

  function closeModal() {
    document.getElementById('admin-modal').style.display = 'none';
  }

  async function verify() {
    const password = document.getElementById('admin-password-input').value;
    if (!password) {
      document.getElementById('admin-password-error').textContent = 'Enter the admin password';
      return;
    }
    const res = await API.adminVerify(password);
    if (res.ok) {
      currentUser.is_admin = 1;
      closeModal();
      showToast('Admin access granted', 'success');
      App.navigate('admin');
    } else {
      document.getElementById('admin-password-error').textContent = res.data.error || 'Invalid password';
    }
  }

  async function load() {
    await loadUsers();
    await loadLobbies();
    await loadStockControls();
    await loadChatStatus();
  }

  async function loadChatStatus() {
    const res = await API.adminGetConfig();
    if (res.ok) {
      const chatConf = res.data.config.find(c => c.key === 'chat_enabled');
      chatEnabled = chatConf && chatConf.value === '1';
      const btn = document.getElementById('admin-chat-toggle-btn');
      if (btn) btn.textContent = chatEnabled ? '💬 Disable Chat' : '💬 Enable Chat';
    }
  }

  async function loadUsers() {
    const res = await API.adminGetUsers();
    if (!res.ok) return;
    allUsers = res.data.users;
    renderUsers(allUsers);
  }

  function filterUsers() {
    const q = document.getElementById('admin-user-search').value.toLowerCase();
    const filtered = allUsers.filter(u => u.username.toLowerCase().includes(q));
    renderUsers(filtered);
  }

  function renderUsers(users) {
    const tbody = document.getElementById('admin-users-body');
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="placeholder-text">No users found</td></tr>';
      return;
    }
    tbody.innerHTML = users.map(u => {
      const status = u.is_banned ? '<span class="badge badge-red">BANNED</span>' :
                     u.chat_banned ? '<span class="badge badge-yellow">CHAT BAN</span>' :
                     u.is_admin ? '<span class="badge badge-blue">ADMIN</span>' :
                     '<span class="badge badge-green">ACTIVE</span>';
      return `<tr>
        <td>${u.id}</td>
        <td class="mono">${u.username}</td>
        <td>${u.level}</td>
        <td class="mono">${formatMoney(u.money)}</td>
        <td>${u.xp}</td>
        <td>${status}</td>
        <td class="admin-actions-cell">
          <button class="btn btn-sm btn-secondary" onclick="Admin.editUser(${u.id})" title="Edit">✏️</button>
          ${u.is_banned
            ? `<button class="btn btn-sm btn-primary" onclick="Admin.unban(${u.id})" title="Unban">🔓</button>`
            : `<button class="btn btn-sm btn-danger" onclick="Admin.ban(${u.id})" title="Ban">🔨</button>`
          }
          ${u.chat_banned
            ? `<button class="btn btn-sm btn-primary" onclick="Admin.chatUnban(${u.id})" title="Chat Unban">💬</button>`
            : `<button class="btn btn-sm btn-secondary" onclick="Admin.chatBan(${u.id})" title="Chat Ban">🤐</button>`
          }
        </td>
      </tr>`;
    }).join('');
  }

  async function ban(userId) {
    const reason = prompt('Ban reason (optional):') || '';
    if (!confirm('Ban this user?')) return;
    const res = await API.adminBan(userId, true, reason);
    if (res.ok) { showToast('User banned', 'success'); loadUsers(); }
    else showToast(res.data.error, 'error');
  }

  async function unban(userId) {
    const res = await API.adminBan(userId, false);
    if (res.ok) { showToast('User unbanned', 'success'); loadUsers(); }
    else showToast(res.data.error, 'error');
  }

  async function chatBan(userId) {
    const res = await API.adminChatBan(userId, true);
    if (res.ok) { showToast('User chat banned', 'success'); loadUsers(); }
    else showToast(res.data.error, 'error');
  }

  async function chatUnban(userId) {
    const res = await API.adminChatBan(userId, false);
    if (res.ok) { showToast('User chat unbanned', 'success'); loadUsers(); }
    else showToast(res.data.error, 'error');
  }

  function editUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    const action = prompt(
      `Edit ${user.username}\n` +
      `Current Money: ${formatMoney(user.money)}\n` +
      `Current XP: ${user.xp} (Level ${user.level})\n\n` +
      `Type:\n  money:AMOUNT  (e.g. money:50000)\n  xp:AMOUNT  (e.g. xp:1000)\n  admin:1 or admin:0`
    );
    if (!action) return;
    const [key, val] = action.split(':');
    if (key === 'money') {
      const amt = parseFloat(val);
      if (isNaN(amt)) { showToast('Invalid amount', 'error'); return; }
      API.adminSetMoney(userId, amt).then(res => {
        if (res.ok) { showToast(res.data.message, 'success'); loadUsers(); }
        else showToast(res.data.error, 'error');
      });
    } else if (key === 'xp') {
      const xp = parseInt(val);
      if (isNaN(xp)) { showToast('Invalid XP', 'error'); return; }
      API.adminSetXp(userId, xp).then(res => {
        if (res.ok) { showToast(res.data.message, 'success'); loadUsers(); }
        else showToast(res.data.error, 'error');
      });
    } else if (key === 'admin') {
      API.adminToggleAdmin(userId, val === '1').then(res => {
        if (res.ok) { showToast(res.data.message, 'success'); loadUsers(); }
        else showToast(res.data.error, 'error');
      });
    } else {
      showToast('Unknown command. Use money:, xp:, or admin:', 'error');
    }
  }

  async function loadLobbies() {
    const el = document.getElementById('admin-lobbies-list');
    const res = await API.adminGetLobbies();
    if (!res.ok) { el.innerHTML = '<p class="placeholder-text">Failed to load</p>'; return; }
    const lobbies = res.data.lobbies;
    if (lobbies.length === 0) {
      el.innerHTML = '<p class="empty-state">No active lobbies</p>';
      return;
    }
    el.innerHTML = lobbies.map(l => `
      <div class="admin-lobby-row">
        <div>
          <span class="mono" style="font-weight:600;">${l.name}</span>
          <span class="text-muted" style="margin-left:0.5rem;">${l.status} · ${l.player_count}/${l.max_players} players · by ${l.creator_name}</span>
        </div>
        <button class="btn btn-sm btn-danger" onclick="Admin.forceCloseLobby(${l.id})">Force Close</button>
      </div>
    `).join('');
  }

  async function forceCloseLobby(lobbyId) {
    if (!confirm('Force close this lobby? Active matches will be scored.')) return;
    const res = await API.adminForceCloseLobby(lobbyId);
    if (res.ok) { showToast('Lobby closed', 'success'); loadLobbies(); }
    else showToast(res.data.error, 'error');
  }

  async function loadStockControls() {
    const el = document.getElementById('admin-stock-controls');
    const res = await API.getStocks();
    if (!res.ok) { el.innerHTML = '<p class="placeholder-text">Failed to load</p>'; return; }
    el.innerHTML = `
      <div class="admin-stock-grid">
        ${res.data.stocks.map(s => `
          <div class="admin-stock-item">
            <span class="mono" style="font-weight:600;">${s.symbol}</span>
            <span class="mono">${formatMoney(s.current_price)}</span>
            <input type="number" id="admin-stock-price-${s.id}" step="0.01" min="0.01"
                   placeholder="New price" style="width:100px;">
            <button class="btn btn-sm btn-secondary" onclick="Admin.setStockPrice(${s.id})">Set</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  async function setStockPrice(stockId) {
    const input = document.getElementById(`admin-stock-price-${stockId}`);
    const price = parseFloat(input.value);
    if (isNaN(price) || price < 0.01) { showToast('Invalid price', 'error'); return; }
    const res = await API.adminSetStockPrice(stockId, price);
    if (res.ok) { showToast(res.data.message, 'success'); input.value = ''; loadStockControls(); }
    else showToast(res.data.error, 'error');
  }

  function showAnnouncementForm() {
    const el = document.getElementById('admin-announcement-form');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display === 'block') {
      document.getElementById('admin-announcement-input').focus();
    }
  }

  async function pushAnnouncement() {
    const msg = document.getElementById('admin-announcement-input').value.trim();
    if (!msg) { showToast('Enter an announcement message', 'error'); return; }
    const res = await API.adminAnnouncement(msg);
    if (res.ok) {
      showToast('Announcement pushed', 'success');
      document.getElementById('admin-announcement-input').value = '';
      document.getElementById('admin-announcement-form').style.display = 'none';
    } else showToast(res.data.error, 'error');
  }

  async function clearAnnouncements() {
    if (!confirm('Clear all announcements?')) return;
    const res = await API.adminAnnouncement('', 'clear');
    if (res.ok) showToast('Announcements cleared', 'success');
    else showToast(res.data.error, 'error');
  }

  async function toggleChat() {
    chatEnabled = !chatEnabled;
    const res = await API.adminToggleChat(chatEnabled);
    if (res.ok) {
      showToast(res.data.message, 'success');
      const btn = document.getElementById('admin-chat-toggle-btn');
      if (btn) btn.textContent = chatEnabled ? '💬 Disable Chat' : '💬 Enable Chat';
    } else showToast(res.data.error, 'error');
  }

  async function clearChat() {
    if (!confirm('Clear ALL chat messages? This cannot be undone.')) return;
    const res = await API.adminClearChat();
    if (res.ok) showToast('Chat cleared', 'success');
    else showToast(res.data.error, 'error');
  }

  async function weeklyReset() {
    if (!confirm('⚠️ WEEKLY RESET\n\nThis will:\n• Reset ALL player money to $10,000\n• Delete ALL portfolios\n• Reset ALL stock prices\n• Clear ALL trade history\n\nAre you sure?')) return;
    if (!confirm('This is IRREVERSIBLE. Type YES to confirm (press OK).')) return;
    const res = await API.adminWeeklyReset();
    if (res.ok) showToast(res.data.message, 'success');
    else showToast(res.data.error, 'error');
  }

  return {
    showModal, closeModal, verify, load,
    loadUsers, filterUsers, ban, unban, chatBan, chatUnban, editUser,
    loadLobbies, forceCloseLobby, loadStockControls, setStockPrice,
    showAnnouncementForm, pushAnnouncement, clearAnnouncements,
    toggleChat, clearChat, weeklyReset,
  };
})();

// ============================================================
// COSMETICS — Locker, Battle Pass, Crate Spin
// ============================================================
const Cosmetics = (() => {
  let allCosmetics = [];
  let currentFilter = 'all';

  // Rarity colors
  const RARITY_COLORS = {
    common: '#9ca3af',
    uncommon: '#22c55e',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#f59e0b',
  };

  // Readable title mapping for equipped display
  const COSMETIC_TITLE_MAP = {};

  async function load() {
    const res = await API.getCosmetics();
    if (!res.ok) return;
    allCosmetics = res.data.cosmetics;

    // Build title map
    allCosmetics.forEach(c => { COSMETIC_TITLE_MAP[c.css_value] = c.name; });

    // Check for new battle pass unlocks
    const unlockRes = await API.checkUnlocks();
    if (unlockRes.ok && unlockRes.data.unlocked.length > 0) {
      unlockRes.data.unlocked.forEach(item => {
        showToast(`🎉 Battle Pass Unlock: ${item.name}!`, 'success');
      });
      // Reload cosmetics after unlocks
      const refreshed = await API.getCosmetics();
      if (refreshed.ok) allCosmetics = refreshed.data.cosmetics;
    }

    renderEquipped(res.data.equipped);
    renderGrid();
  }

  function showTab(tab) {
    document.querySelectorAll('.cos-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.cos-tab-content').forEach(t => t.style.display = 'none');
    document.querySelector(`.cos-tab[onclick*="${tab}"]`).classList.add('active');
    document.getElementById(`cos-tab-${tab}`).style.display = 'block';
    if (tab === 'battlepass') renderBattlePass();
  }

  function renderEquipped(equipped) {
    const el = document.getElementById('cos-equipped-bar');
    const titleName = equipped.title ? (COSMETIC_TITLE_MAP[equipped.title] || equipped.title) : 'None';
    const bgName = equipped.background ? (COSMETIC_TITLE_MAP[equipped.background] || equipped.background) : 'None';
    const cardName = equipped.card_style ? (COSMETIC_TITLE_MAP[equipped.card_style] || equipped.card_style) : 'None';

    el.innerHTML = `
      <div class="cos-equipped-section">
        <h3>Currently Equipped</h3>
        <div class="cos-equipped-slots">
          <div class="cos-slot">
            <span class="cos-slot-label">Title</span>
            <span class="cos-slot-value">${titleName}</span>
            ${equipped.title ? `<button class="btn btn-sm btn-secondary" onclick="Cosmetics.unequip('title')">Remove</button>` : ''}
          </div>
          <div class="cos-slot">
            <span class="cos-slot-label">Background</span>
            <span class="cos-slot-value">${bgName}</span>
            ${equipped.background ? `<button class="btn btn-sm btn-secondary" onclick="Cosmetics.unequip('background')">Remove</button>` : ''}
          </div>
          <div class="cos-slot">
            <span class="cos-slot-label">Card Style</span>
            <span class="cos-slot-value">${cardName}</span>
            ${equipped.card_style ? `<button class="btn btn-sm btn-secondary" onclick="Cosmetics.unequip('card_style')">Remove</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function filter(type) {
    currentFilter = type;
    document.querySelectorAll('.cos-filter').forEach(f => f.classList.toggle('active', f.dataset.filter === type));
    renderGrid();
  }

  function renderGrid() {
    const el = document.getElementById('cos-grid');
    let items = allCosmetics.filter(c => c.owned);
    if (currentFilter !== 'all') items = items.filter(c => c.type === currentFilter);

    if (items.length === 0) {
      el.innerHTML = '<p class="empty-state">No cosmetics owned yet. Level up to unlock Battle Pass items, or win lobby matches for crate spins!</p>';
      return;
    }

    el.innerHTML = items.map(c => {
      const rarityColor = RARITY_COLORS[c.rarity] || '#9ca3af';
      return `
        <div class="cos-card ${c.equipped ? 'cos-equipped' : ''}" style="border-color:${rarityColor};" onclick="Cosmetics.equip(${c.id})">
          <div class="cos-card-rarity" style="background:${rarityColor};">${c.rarity}</div>
          <div class="cos-card-icon">${c.type === 'title' ? '🏷️' : c.type === 'background' ? '🎨' : '🃏'}</div>
          <div class="cos-card-name">${c.name}</div>
          <div class="cos-card-desc">${c.description}</div>
          <div class="cos-card-type">${c.type.replace('_', ' ')}</div>
          ${c.equipped ? '<div class="cos-card-equipped-badge">EQUIPPED</div>' : ''}
        </div>
      `;
    }).join('');
  }

  async function equip(cosmeticId) {
    const item = allCosmetics.find(c => c.id === cosmeticId);
    if (!item || !item.owned) return;

    if (item.equipped) {
      // Already equipped — unequip it
      await unequip(item.type);
      return;
    }

    const res = await API.equipCosmetic(cosmeticId);
    if (res.ok) {
      showToast(`Equipped ${item.name}`, 'success');
      load(); // Refresh
    } else {
      showToast(res.data.error, 'error');
    }
  }

  async function unequip(type) {
    const res = await API.unequipCosmetic(type);
    if (res.ok) {
      showToast('Cosmetic removed', 'info');
      load();
    } else {
      showToast(res.data.error, 'error');
    }
  }

  function renderBattlePass() {
    const bpItems = allCosmetics.filter(c => c.source === 'battlepass').sort((a, b) => a.battlepass_level - b.battlepass_level);
    const headerEl = document.getElementById('bp-header');
    const trackEl = document.getElementById('bp-track');
    const userLevel = currentUser ? currentUser.level : 1;

    headerEl.innerHTML = `
      <div class="bp-info">
        <h3>Battle Pass — Level ${userLevel}</h3>
        <p class="text-muted">Unlock cosmetics by leveling up through trading and lobby matches</p>
      </div>
    `;

    trackEl.innerHTML = bpItems.map(item => {
      const unlocked = item.owned;
      const rarityColor = RARITY_COLORS[item.rarity] || '#9ca3af';
      return `
        <div class="bp-item ${unlocked ? 'bp-unlocked' : 'bp-locked'}" style="--rarity-color:${rarityColor};">
          <div class="bp-level-marker">Lv ${item.battlepass_level}</div>
          <div class="bp-item-card" style="border-color:${unlocked ? rarityColor : '#333'};">
            <div class="bp-item-icon">${item.type === 'title' ? '🏷️' : item.type === 'background' ? '🎨' : '🃏'}</div>
            <div class="bp-item-name">${item.name}</div>
            <div class="bp-item-rarity" style="color:${rarityColor};">${item.rarity}</div>
            ${unlocked ? '<div class="bp-item-check">✓</div>' : '<div class="bp-item-lock">🔒</div>'}
          </div>
        </div>
      `;
    }).join('');
  }

  // Crate spin — called from post-match results
  async function openCrate(placement) {
    document.getElementById('crate-modal').style.display = 'flex';
    document.getElementById('crate-result').style.display = 'none';
    document.getElementById('crate-subtitle').textContent = `Placement #${placement} — Spinning...`;

    const res = await API.crateSpin(placement);
    if (!res.ok || !res.data.item) {
      document.getElementById('crate-subtitle').textContent = res.data.message || 'No items available';
      document.getElementById('crate-result').style.display = 'block';
      document.getElementById('crate-result-item').innerHTML = '<p>You already own all crate items!</p>';
      return;
    }

    const { item, reel } = res.data;
    const reelEl = document.getElementById('crate-reel');

    // Build reel items
    reelEl.innerHTML = reel.map(r => {
      const col = RARITY_COLORS[r.rarity] || '#9ca3af';
      return `
        <div class="crate-reel-item" style="border-color:${col};">
          <span class="crate-reel-icon">${r.type === 'title' ? '🏷️' : r.type === 'background' ? '🎨' : '🃏'}</span>
          <span class="crate-reel-name">${r.name}</span>
          <span class="crate-reel-rarity" style="color:${col};">${r.rarity}</span>
        </div>
      `;
    }).join('');

    // Animate the reel
    reelEl.style.transition = 'none';
    reelEl.style.transform = 'translateX(0)';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Each item is 140px wide. We want to land on item 15 (index 15).
        // Center it: offset = 15 * 140 - viewport/2 + 70
        const offset = 15 * 140 - 230;
        reelEl.style.transition = 'transform 4s cubic-bezier(0.15, 0.85, 0.2, 1)';
        reelEl.style.transform = `translateX(-${offset}px)`;
      });
    });

    // Show result after animation
    setTimeout(() => {
      const col = RARITY_COLORS[item.rarity] || '#9ca3af';
      document.getElementById('crate-subtitle').textContent = 'You won:';
      document.getElementById('crate-result').style.display = 'block';
      document.getElementById('crate-result-item').innerHTML = `
        <div class="crate-won-card" style="border-color:${col};">
          <div class="crate-won-rarity" style="background:${col};">${item.rarity}</div>
          <div class="crate-won-icon">${item.type === 'title' ? '🏷️' : item.type === 'background' ? '🎨' : '🃏'}</div>
          <div class="crate-won-name">${item.name}</div>
          <div class="crate-won-desc">${item.description}</div>
        </div>
      `;
    }, 4200);
  }

  function closeCrate() {
    document.getElementById('crate-modal').style.display = 'none';
  }

  return {
    load, showTab, filter, equip, unequip,
    renderBattlePass, openCrate, closeCrate,
    RARITY_COLORS, COSMETIC_TITLE_MAP,
  };
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

// Close modals with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    Market.closeModal();
    if (typeof Lobby !== 'undefined') Lobby.closeStockModal();
    if (typeof Admin !== 'undefined') Admin.closeModal();
    if (typeof Cosmetics !== 'undefined') Cosmetics.closeCrate();
  }
});
