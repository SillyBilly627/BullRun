// ============================================================
// BullRun — Backend API (Cloudflare Pages Function)
// ============================================================
// This single file handles ALL /api/* routes.
// It runs as a Cloudflare Pages Function (serverless).
// ============================================================

// ----------------------------------------------------------
// PASSWORD HASHING (PBKDF2 via Web Crypto API)
// ----------------------------------------------------------
// We use PBKDF2 instead of bcrypt because Cloudflare Workers
// have the Web Crypto API built in. PBKDF2 is industry-standard
// and perfectly secure for password hashing.
// ----------------------------------------------------------

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  // Convert the hash to a hex string
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSessionToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ----------------------------------------------------------
// HELPER: Build JSON response with CORS headers
// ----------------------------------------------------------
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// ----------------------------------------------------------
// HELPER: Get the logged-in user from their session token
// ----------------------------------------------------------
async function getSessionUser(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  // Look up the session in KV
  const sessionData = await env.SESSION_STORE.get(token);
  if (!sessionData) return null;
  const session = JSON.parse(sessionData);
  // Fetch the full user from the database
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.userId).first();
  if (!user || user.is_banned) return null;
  return user;
}

// ----------------------------------------------------------
// HELPER: Validate password requirements
// ----------------------------------------------------------
function validatePassword(password) {
  if (password.length < 4) return 'Password must be at least 4 characters';
  if (!/[a-z]/i.test(password)) return 'Password must include at least one letter';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one capital letter';
  return null;
}

// ----------------------------------------------------------
// HELPER: Sanitize user input (prevent XSS)
// ----------------------------------------------------------
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&]/g, (c) => {
    const map = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;' };
    return map[c];
  }).trim();
}

// ----------------------------------------------------------
// HELPER: Validate username
// ----------------------------------------------------------
function validateUsername(username) {
  if (!username || username.length < 2) return 'Username must be at least 2 characters';
  if (username.length > 20) return 'Username must be 20 characters or less';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Username can only contain letters, numbers, and underscores';
  return null;
}

// ----------------------------------------------------------
// HELPER: Calculate level from XP
// ----------------------------------------------------------
function calculateLevel(xp) {
  // Each level requires progressively more XP
  // Level 1: 0 XP, Level 2: 100 XP, Level 3: 250 XP, etc.
  // Formula: XP needed for level N = 50 * N * (N-1)
  let level = 1;
  while (xp >= 50 * level * (level + 1) / 2) {
    level++;
  }
  return level;
}

function xpForLevel(level) {
  return 50 * (level - 1) * level / 2;
}

// ----------------------------------------------------------
// STOCK PRICE ENGINE — Random Walk + Player Pressure
// ----------------------------------------------------------
// This is the heart of the game. Every 30 seconds (configurable),
// all stock prices update using a random walk algorithm that
// also factors in player buying/selling pressure.
//
// It uses a "lazy tick" approach — prices update whenever any
// player requests stock data, IF enough time has passed since
// the last tick. This avoids needing a cron job.
// ----------------------------------------------------------

async function tickStockPrices(env) {
  // Check when the last tick happened (stored in KV for speed)
  const lastTickStr = await env.SESSION_STORE.get('last_stock_tick');
  const now = Date.now();
  const tickInterval = 30 * 1000; // 30 seconds between ticks

  if (lastTickStr && (now - parseInt(lastTickStr)) < tickInterval) {
    return false; // Not time yet
  }

  // Mark this tick time immediately (prevents double-ticks)
  await env.SESSION_STORE.put('last_stock_tick', now.toString());

  // Get all active stocks
  const stocks = await env.DB.prepare(
    'SELECT * FROM stocks WHERE is_active = 1'
  ).all();

  // Generate random values for all stocks at once
  const randomBytes = new Uint32Array(stocks.results.length);
  crypto.getRandomValues(randomBytes);

  for (let i = 0; i < stocks.results.length; i++) {
    const stock = stocks.results[i];

    // Convert random uint32 to a number between -1 and 1
    const random = (randomBytes[i] / 0xFFFFFFFF) * 2 - 1;

    // Base price change from random walk
    // Volatility controls how much the stock swings per tick
    let change = random * stock.volatility;

    // Add player pressure effect
    // buy_pressure is accumulated from player buys (+) and sells (-)
    // We scale it down so it's a gentle nudge, not a rocket
    const pressureEffect = stock.buy_pressure * 0.001;
    change += pressureEffect;

    // Mean reversion — gently pull price back toward base_price
    // This prevents stocks from going to infinity or zero
    // The further from base, the stronger the pull
    const deviation = (stock.current_price - stock.base_price) / stock.base_price;
    const meanReversion = -deviation * 0.005; // 0.5% pull per tick
    change += meanReversion;

    // Add occasional momentum (trending days)
    // 10% chance of a bigger move in the same direction
    const momentumRoll = new Uint8Array(1);
    crypto.getRandomValues(momentumRoll);
    if (momentumRoll[0] < 25) { // ~10% chance
      change *= 2.5; // Bigger move
    }

    // Calculate new price
    let newPrice = stock.current_price * (1 + change);

    // Clamp — stocks can't go below $0.50 or above 100x their base
    newPrice = Math.max(0.50, Math.min(newPrice, stock.base_price * 100));
    newPrice = Math.round(newPrice * 100) / 100; // Round to 2 decimals

    // Calculate candle data for this tick
    // Open = previous close (current_price before update)
    const open = stock.current_price;
    const close = newPrice;
    const high = Math.max(open, close) * (1 + Math.abs(change) * 0.3); // slight wick
    const low = Math.min(open, close) * (1 - Math.abs(change) * 0.3);  // slight wick

    // Update stock price in database
    await env.DB.prepare(`
      UPDATE stocks
      SET previous_price = current_price,
          current_price = ?,
          buy_pressure = buy_pressure * 0.7
      WHERE id = ?
    `).bind(newPrice, stock.id).run();
    // Note: buy_pressure decays by 30% each tick (multiplied by 0.7)
    // This means pressure fades over time if players stop trading

    // Record price history (candle data)
    await env.DB.prepare(`
      INSERT INTO stock_history (stock_id, price, open_price, high_price, low_price, close_price, volume, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
    `).bind(stock.id, newPrice, open, Math.round(high * 100) / 100, Math.round(low * 100) / 100, close).run();
  }

  return true; // Tick happened
}

// ============================================================
// ROUTE HANDLER
// ============================================================

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', '').replace(/\/$/, '');
  const method = request.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // ======================================
    // AUTH ROUTES
    // ======================================

    // --- SIGNUP ---
    if (path === 'auth/signup' && method === 'POST') {
      const body = await request.json();
      const username = sanitize(body.username || '');
      const password = body.password || '';

      // Validate username
      const usernameError = validateUsername(username);
      if (usernameError) return jsonResponse({ error: usernameError }, 400);

      // Validate password
      const passwordError = validatePassword(password);
      if (passwordError) return jsonResponse({ error: passwordError }, 400);

      // Check if username already exists
      const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
      if (existing) return jsonResponse({ error: 'Username already taken' }, 409);

      // Hash the password
      const salt = generateSalt();
      const hash = await hashPassword(password, salt);

      // Create the user
      const result = await env.DB.prepare(
        'INSERT INTO users (username, password_hash, password_salt) VALUES (?, ?, ?)'
      ).bind(username, hash, salt).run();

      const userId = result.meta.last_row_id;

      // Create a session
      const token = generateSessionToken();
      await env.SESSION_STORE.put(token, JSON.stringify({ userId, username }), { expirationTtl: 86400 * 7 }); // 7 days

      return jsonResponse({
        success: true,
        token,
        user: { id: userId, username, money: 10000, xp: 0, level: 1 }
      });
    }

    // --- LOGIN ---
    if (path === 'auth/login' && method === 'POST') {
      const body = await request.json();
      const username = sanitize(body.username || '');
      const password = body.password || '';

      if (!username || !password) {
        return jsonResponse({ error: 'Username and password are required' }, 400);
      }

      // Find the user
      const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
      if (!user) return jsonResponse({ error: 'Invalid username or password' }, 401);

      // Check if banned
      if (user.is_banned) return jsonResponse({ error: 'This account has been banned' }, 403);

      // Verify password
      const hash = await hashPassword(password, user.password_salt);
      if (hash !== user.password_hash) {
        return jsonResponse({ error: 'Invalid username or password' }, 401);
      }

      // Update last_active
      await env.DB.prepare('UPDATE users SET last_active = datetime(\'now\') WHERE id = ?').bind(user.id).run();

      // Create a session
      const token = generateSessionToken();
      await env.SESSION_STORE.put(token, JSON.stringify({ userId: user.id, username: user.username }), { expirationTtl: 86400 * 7 });

      return jsonResponse({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          money: user.money,
          xp: user.xp,
          level: user.level,
          is_admin: user.is_admin,
          equipped_title: user.equipped_title,
          equipped_background: user.equipped_background,
          equipped_card_style: user.equipped_card_style,
        }
      });
    }

    // --- LOGOUT ---
    if (path === 'auth/logout' && method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        await env.SESSION_STORE.delete(token);
      }
      return jsonResponse({ success: true });
    }

    // --- GET CURRENT USER ---
    if (path === 'auth/me' && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      return jsonResponse({
        user: {
          id: user.id,
          username: user.username,
          money: user.money,
          xp: user.xp,
          level: user.level,
          highest_money: user.highest_money,
          is_admin: user.is_admin,
          equipped_title: user.equipped_title,
          equipped_background: user.equipped_background,
          equipped_card_style: user.equipped_card_style,
          created_at: user.created_at,
        }
      });
    }

    // ======================================
    // STOCK ROUTES
    // ======================================

    // --- GET ALL STOCKS ---
    if (path === 'stocks' && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      // Run a price tick if enough time has passed
      await tickStockPrices(env);

      const stocks = await env.DB.prepare(
        'SELECT id, symbol, name, sector, current_price, previous_price, base_price, volatility FROM stocks WHERE is_active = 1 ORDER BY symbol'
      ).all();

      return jsonResponse({ stocks: stocks.results });
    }

    // --- GET SINGLE STOCK DETAIL ---
    if (path.match(/^stocks\/\d+$/) && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const stockId = parseInt(path.split('/')[1]);
      const stock = await env.DB.prepare('SELECT * FROM stocks WHERE id = ? AND is_active = 1').bind(stockId).first();
      if (!stock) return jsonResponse({ error: 'Stock not found' }, 404);

      // Get price history (last 100 entries)
      const history = await env.DB.prepare(
        'SELECT price, open_price, high_price, low_price, close_price, volume, timestamp FROM stock_history WHERE stock_id = ? ORDER BY timestamp DESC LIMIT 100'
      ).bind(stockId).all();

      // Get user's holdings for this stock
      const holding = await env.DB.prepare(
        'SELECT shares, avg_buy_price FROM portfolios WHERE user_id = ? AND stock_id = ?'
      ).bind(user.id, stockId).first();

      return jsonResponse({
        stock,
        history: history.results.reverse(), // oldest first for charting
        holding: holding || { shares: 0, avg_buy_price: 0 }
      });
    }

    // --- BUY STOCK ---
    if (path === 'stocks/buy' && method === 'POST') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const body = await request.json();
      const stockId = parseInt(body.stockId);
      const shares = parseInt(body.shares);

      if (!stockId || !shares || shares < 1) {
        return jsonResponse({ error: 'Invalid stock or share amount' }, 400);
      }

      // Get stock
      const stock = await env.DB.prepare('SELECT * FROM stocks WHERE id = ? AND is_active = 1').bind(stockId).first();
      if (!stock) return jsonResponse({ error: 'Stock not found' }, 404);

      const totalCost = stock.current_price * shares;

      // Check if user has enough money
      if (user.money < totalCost) {
        return jsonResponse({ error: 'Not enough money. You need $' + totalCost.toFixed(2) }, 400);
      }

      // Deduct money from user
      await env.DB.prepare('UPDATE users SET money = money - ? WHERE id = ?').bind(totalCost, user.id).run();

      // Add shares to portfolio (upsert)
      const existing = await env.DB.prepare(
        'SELECT shares, avg_buy_price FROM portfolios WHERE user_id = ? AND stock_id = ?'
      ).bind(user.id, stockId).first();

      if (existing) {
        // Update existing holding — recalculate average buy price
        const newTotalShares = existing.shares + shares;
        const newAvgPrice = ((existing.avg_buy_price * existing.shares) + (stock.current_price * shares)) / newTotalShares;
        await env.DB.prepare(
          'UPDATE portfolios SET shares = ?, avg_buy_price = ? WHERE user_id = ? AND stock_id = ?'
        ).bind(newTotalShares, newAvgPrice, user.id, stockId).run();
      } else {
        // New holding
        await env.DB.prepare(
          'INSERT INTO portfolios (user_id, stock_id, shares, avg_buy_price) VALUES (?, ?, ?, ?)'
        ).bind(user.id, stockId, shares, stock.current_price).run();
      }

      // Log the transaction
      await env.DB.prepare(
        'INSERT INTO transactions (user_id, stock_id, type, shares, price_per_share, total_cost) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(user.id, stockId, 'buy', shares, stock.current_price, totalCost).run();

      // Add buy pressure to the stock (makes price go up slightly)
      const pressureAmount = (shares * stock.current_price) / 10000; // scaled
      await env.DB.prepare('UPDATE stocks SET buy_pressure = buy_pressure + ? WHERE id = ?').bind(pressureAmount, stockId).run();

      // Get updated user money
      const updatedUser = await env.DB.prepare('SELECT money FROM users WHERE id = ?').bind(user.id).first();

      return jsonResponse({
        success: true,
        message: `Bought ${shares} shares of ${stock.symbol} at $${stock.current_price.toFixed(2)} each`,
        totalCost,
        newBalance: updatedUser.money,
        tip: shares === 1
          ? "In real trading, this is called a 'market order' — you buy at the current price."
          : "Tip: Diversifying across multiple stocks reduces your risk if one drops."
      });
    }

    // --- SELL STOCK ---
    if (path === 'stocks/sell' && method === 'POST') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const body = await request.json();
      const stockId = parseInt(body.stockId);
      const shares = parseInt(body.shares);

      if (!stockId || !shares || shares < 1) {
        return jsonResponse({ error: 'Invalid stock or share amount' }, 400);
      }

      // Check holdings
      const holding = await env.DB.prepare(
        'SELECT shares, avg_buy_price FROM portfolios WHERE user_id = ? AND stock_id = ?'
      ).bind(user.id, stockId).first();

      if (!holding || holding.shares < shares) {
        return jsonResponse({ error: 'You don\'t own enough shares' }, 400);
      }

      // Get stock
      const stock = await env.DB.prepare('SELECT * FROM stocks WHERE id = ? AND is_active = 1').bind(stockId).first();
      if (!stock) return jsonResponse({ error: 'Stock not found' }, 404);

      const totalRevenue = stock.current_price * shares;
      const profitLoss = (stock.current_price - holding.avg_buy_price) * shares;

      // Add money to user
      await env.DB.prepare('UPDATE users SET money = money + ? WHERE id = ?').bind(totalRevenue, user.id).run();

      // Update or remove portfolio entry
      const remainingShares = holding.shares - shares;
      if (remainingShares <= 0) {
        await env.DB.prepare('DELETE FROM portfolios WHERE user_id = ? AND stock_id = ?').bind(user.id, stockId).run();
      } else {
        await env.DB.prepare('UPDATE portfolios SET shares = ? WHERE user_id = ? AND stock_id = ?').bind(remainingShares, user.id, stockId).run();
      }

      // Log transaction
      await env.DB.prepare(
        'INSERT INTO transactions (user_id, stock_id, type, shares, price_per_share, total_cost, profit_loss) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(user.id, stockId, 'sell', shares, stock.current_price, totalRevenue, profitLoss).run();

      // Add XP for profitable trades
      let xpEarned = 0;
      if (profitLoss > 0) {
        xpEarned = 10 + Math.floor(profitLoss / 100) * 5; // 10 base + 5 per $100 profit
        const newXp = user.xp + xpEarned;
        const newLevel = calculateLevel(newXp);
        await env.DB.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').bind(newXp, newLevel, user.id).run();
      }

      // Add sell pressure (makes price go down slightly)
      const pressureAmount = -(shares * stock.current_price) / 10000;
      await env.DB.prepare('UPDATE stocks SET buy_pressure = buy_pressure + ? WHERE id = ?').bind(pressureAmount, stockId).run();

      // Update highest_money if applicable
      const updatedUser = await env.DB.prepare('SELECT money FROM users WHERE id = ?').bind(user.id).first();
      if (updatedUser.money > user.highest_money) {
        await env.DB.prepare('UPDATE users SET highest_money = ? WHERE id = ?').bind(updatedUser.money, user.id).run();
      }

      return jsonResponse({
        success: true,
        message: `Sold ${shares} shares of ${stock.symbol} at $${stock.current_price.toFixed(2)} each`,
        totalRevenue,
        profitLoss,
        xpEarned,
        newBalance: updatedUser.money,
        tip: profitLoss > 0
          ? `Nice trade! You made $${profitLoss.toFixed(2)} profit. In real markets, this is called "realising a gain."`
          : profitLoss < 0
            ? `You sold at a loss of $${Math.abs(profitLoss).toFixed(2)}. Sometimes cutting losses early is a smart strategy — it's called a "stop loss."`
            : 'You broke even on this trade. No gain, no loss.'
      });
    }

    // --- GET USER PORTFOLIO ---
    if (path === 'portfolio' && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const holdings = await env.DB.prepare(`
        SELECT p.shares, p.avg_buy_price, s.id as stock_id, s.symbol, s.name, s.current_price, s.previous_price
        FROM portfolios p
        JOIN stocks s ON p.stock_id = s.id
        WHERE p.user_id = ?
        ORDER BY s.symbol
      `).bind(user.id).all();

      // Calculate totals
      let totalValue = 0;
      let totalCost = 0;
      const enriched = holdings.results.map(h => {
        const currentValue = h.shares * h.current_price;
        const costBasis = h.shares * h.avg_buy_price;
        totalValue += currentValue;
        totalCost += costBasis;
        return {
          ...h,
          currentValue,
          costBasis,
          profitLoss: currentValue - costBasis,
          profitLossPercent: ((h.current_price - h.avg_buy_price) / h.avg_buy_price * 100)
        };
      });

      return jsonResponse({
        holdings: enriched,
        totalValue,
        totalCost,
        totalProfitLoss: totalValue - totalCost,
        cash: user.money,
        netWorth: user.money + totalValue
      });
    }

    // --- GET TRANSACTION HISTORY ---
    if (path === 'transactions' && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const limit = parseInt(url.searchParams.get('limit') || '50');
      const transactions = await env.DB.prepare(`
        SELECT t.*, s.symbol, s.name
        FROM transactions t
        JOIN stocks s ON t.stock_id = s.id
        WHERE t.user_id = ?
        ORDER BY t.created_at DESC
        LIMIT ?
      `).bind(user.id, limit).all();

      return jsonResponse({ transactions: transactions.results });
    }

    // ======================================
    // LEADERBOARD ROUTES
    // ======================================

    // --- WEEKLY MONEY LEADERBOARD ---
    if (path === 'leaderboards/weekly' && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      // Get top players by current money + portfolio value
      // For simplicity in Phase 1, just use money balance
      const leaders = await env.DB.prepare(`
        SELECT id, username, money, level, equipped_title, equipped_card_style
        FROM users WHERE is_banned = 0
        ORDER BY money DESC LIMIT 50
      `).all();

      return jsonResponse({ leaderboard: leaders.results });
    }

    // --- ALL-TIME LEADERBOARD ---
    if (path === 'leaderboards/alltime' && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const leaders = await env.DB.prepare(`
        SELECT id, username, highest_money, level, equipped_title, equipped_card_style
        FROM users WHERE is_banned = 0
        ORDER BY highest_money DESC LIMIT 50
      `).all();

      return jsonResponse({ leaderboard: leaders.results });
    }

    // --- LEVEL LEADERBOARD ---
    if (path === 'leaderboards/level' && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const leaders = await env.DB.prepare(`
        SELECT id, username, level, xp, equipped_title, equipped_card_style
        FROM users WHERE is_banned = 0
        ORDER BY xp DESC LIMIT 50
      `).all();

      return jsonResponse({ leaderboard: leaders.results });
    }

    // ======================================
    // PLAYER PROFILE ROUTES
    // ======================================

    // --- GET PLAYER PROFILE ---
    if (path.match(/^profile\/\d+$/) && method === 'GET') {
      const authUser = await getSessionUser(request, env);
      if (!authUser) return jsonResponse({ error: 'Not authenticated' }, 401);

      const profileId = parseInt(path.split('/')[1]);
      const profile = await env.DB.prepare(`
        SELECT id, username, money, xp, level, highest_money,
               equipped_title, equipped_background, equipped_card_style,
               created_at
        FROM users WHERE id = ? AND is_banned = 0
      `).bind(profileId).first();

      if (!profile) return jsonResponse({ error: 'Player not found' }, 404);

      // Get their stock holdings
      const holdings = await env.DB.prepare(`
        SELECT s.symbol, s.name, p.shares, s.current_price
        FROM portfolios p JOIN stocks s ON p.stock_id = s.id
        WHERE p.user_id = ?
      `).bind(profileId).all();

      return jsonResponse({
        profile,
        holdings: holdings.results,
        totalStocks: holdings.results.length,
        totalShares: holdings.results.reduce((sum, h) => sum + h.shares, 0)
      });
    }

    // ======================================
    // STOCK TICK ENDPOINT (for polling)
    // ======================================

    // --- POLL FOR PRICE UPDATES ---
    // Frontend calls this every 10 seconds to get fresh prices
    if (path === 'stocks/tick' && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      // Run a tick if enough time has passed
      const ticked = await tickStockPrices(env);

      // Return all current prices (lightweight — just id, price, previous)
      const prices = await env.DB.prepare(
        'SELECT id, symbol, current_price, previous_price FROM stocks WHERE is_active = 1'
      ).all();

      return jsonResponse({ ticked, prices: prices.results });
    }

    // ======================================
    // WATCHLIST
    // ======================================

    // --- GET USER'S WATCHLIST ---
    if (path === 'watchlist' && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const watchlist = await env.DB.prepare(`
        SELECT s.id, s.symbol, s.name, s.sector, s.current_price, s.previous_price
        FROM watchlist w
        JOIN stocks s ON w.stock_id = s.id
        WHERE w.user_id = ?
        ORDER BY s.symbol
      `).bind(user.id).all();

      return jsonResponse({ watchlist: watchlist.results });
    }

    // --- ADD/REMOVE FROM WATCHLIST ---
    if (path === 'watchlist/toggle' && method === 'POST') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const body = await request.json();
      const stockId = parseInt(body.stockId);
      if (!stockId) return jsonResponse({ error: 'Invalid stock' }, 400);

      // Check if already in watchlist
      const existing = await env.DB.prepare(
        'SELECT id FROM watchlist WHERE user_id = ? AND stock_id = ?'
      ).bind(user.id, stockId).first();

      if (existing) {
        // Remove from watchlist
        await env.DB.prepare('DELETE FROM watchlist WHERE user_id = ? AND stock_id = ?').bind(user.id, stockId).run();
        return jsonResponse({ success: true, action: 'removed' });
      } else {
        // Add to watchlist
        await env.DB.prepare('INSERT INTO watchlist (user_id, stock_id) VALUES (?, ?)').bind(user.id, stockId).run();
        return jsonResponse({ success: true, action: 'added' });
      }
    }

    // ======================================
    // ANNOUNCEMENTS
    // ======================================

    if (path === 'announcements' && method === 'GET') {
      const announcements = await env.DB.prepare(
        'SELECT id, message, created_at FROM announcements WHERE is_active = 1 ORDER BY created_at DESC LIMIT 5'
      ).all();
      return jsonResponse({ announcements: announcements.results });
    }

    // ======================================
    // GAME CONFIG (public)
    // ======================================

    if (path === 'config/chat-status' && method === 'GET') {
      const config = await env.DB.prepare("SELECT value FROM game_config WHERE key = 'chat_enabled'").first();
      return jsonResponse({ chatEnabled: config ? config.value === '1' : true });
    }

    // ======================================
    // 404 — Unknown route
    // ======================================
    return jsonResponse({ error: 'Not found', path }, 404);

  } catch (err) {
    console.error('API Error:', err);
    return jsonResponse({ error: 'Internal server error', details: err.message }, 500);
  }
}
