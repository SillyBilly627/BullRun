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
  function renderWatchlist(watchlist) {
    const el = document.getElementById('watchlist-panel');
    const container = document.getElementById('watchlist-container');
    if (!el) return;
    if (watchlist.length === 0) {
      if (container) container.style.display = 'none';
      el.innerHTML = '<p class="placeholder-text" style="padding:0.75rem;">Pin stocks with the ★ icon to track them here</p>';
      return;
    }
    if (container) container.style.display = 'block';
    el.innerHTML = watchlist.map((s, idx) => {
      const pct = s.previous_price > 0 ? ((s.current_price - s.previous_price) / s.previous_price * 100) : 0;
      const dir = changeClass(s.current_price, s.previous_price);
      const weekPct = s.base_price > 0 ? ((s.current_price - s.base_price) / s.base_price * 100) : 0;
      return `
        <div class="watchlist-item" onclick="Market.openDetail(${s.id})">
          <div class="wl-top">
            <span class="wl-symbol">${s.symbol}</span>
            <span class="wl-change ${dir}">${formatPercent(pct)}</span>
          </div>
          <canvas class="wl-sparkline" id="wl-spark-${idx}" width="120" height="36"></canvas>
          <div class="wl-bottom">
            <span class="wl-price">${formatMoney(s.current_price)}</span>
            <span class="wl-week ${weekPct >= 0 ? 'text-gain' : 'text-loss'}" style="font-size:0.6rem;">wk ${formatPercent(weekPct)}</span>
          </div>
        </div>
      `;
    }).join('');

    // Draw mini sparklines after HTML is rendered
    requestAnimationFrame(() => {
      watchlist.forEach((s, idx) => {
        if (s.sparkline && s.sparkline.length > 1) {
          drawSparkline(`wl-spark-${idx}`, s.sparkline);
        }
      });
    });
  }

  // Draw a tiny sparkline chart on a small canvas
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
          <span class="sd-symbol">${stock.symbol}${stock.sector ? ' · ' + stock.sector : ''}</span>
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

  return { load, filterStocks, openDetail, closeModal, updateTradeTotal, executeTrade, togglePin, setChartType, setHistoryRange, startPolling, stopPolling };
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
