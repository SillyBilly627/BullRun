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

// ----------------------------------------------------------
// RANDOM COMPANY NAME GENERATOR (for lobby stocks)
// ----------------------------------------------------------
// Combines random prefixes + suffixes to create unique
// fictional company names for each lobby match.
// ----------------------------------------------------------

const COMPANY_PREFIXES = [
  'Nova', 'Blue', 'Iron', 'Peak', 'Volt', 'Star', 'Core', 'Wave', 'Edge', 'Apex',
  'Nex', 'Zeta', 'Arc', 'Flux', 'Pulse', 'Quant', 'Vex', 'Orion', 'Titan', 'Aero',
  'Crux', 'Drift', 'Echo', 'Fuse', 'Grid', 'Hyper', 'Ion', 'Jade', 'Kite', 'Luna',
  'Mesa', 'Nyx', 'Opal', 'Prism', 'Rift', 'Sage', 'Thorn', 'Ultra', 'Vale', 'Warp'
];

const COMPANY_SUFFIXES = [
  'Tech', 'Systems', 'Dynamics', 'Corp', 'Labs', 'Networks', 'Group', 'Holdings',
  'Digital', 'Ventures', 'Solutions', 'Industries', 'Capital', 'Bio', 'Energy',
  'Robotics', 'AI', 'Forge', 'Works', 'Global'
];

const SECTORS = ['Technology', 'Energy', 'Healthcare', 'Finance', 'Aerospace', 'Gaming', 'Crypto', 'Mining', 'Media', 'Biotech'];

function generateCompanyName(usedNames) {
  let attempts = 0;
  while (attempts < 100) {
    const prefixIdx = crypto.getRandomValues(new Uint8Array(1))[0] % COMPANY_PREFIXES.length;
    const suffixIdx = crypto.getRandomValues(new Uint8Array(1))[0] % COMPANY_SUFFIXES.length;
    const name = COMPANY_PREFIXES[prefixIdx] + COMPANY_SUFFIXES[suffixIdx];
    if (!usedNames.has(name)) {
      usedNames.add(name);
      const fullName = COMPANY_PREFIXES[prefixIdx] + ' ' + COMPANY_SUFFIXES[suffixIdx];
      // Generate 3-4 letter symbol from the name
      const symbol = (COMPANY_PREFIXES[prefixIdx].substring(0, 2) + COMPANY_SUFFIXES[suffixIdx].substring(0, 2)).toUpperCase();
      return { name: fullName, symbol };
    }
    attempts++;
  }
  // Fallback
  const fallback = 'Company' + Date.now();
  return { name: fallback, symbol: fallback.substring(0, 4).toUpperCase() };
}

// ----------------------------------------------------------
// LOBBY STOCK GENERATION — Creates random stocks for a match
// ----------------------------------------------------------

async function generateLobbyStocks(env, lobbyId) {
  const stockCount = 5 + (crypto.getRandomValues(new Uint8Array(1))[0] % 4); // 5-8 stocks
  const usedNames = new Set();
  const usedSymbols = new Set();

  for (let i = 0; i < stockCount; i++) {
    let company = generateCompanyName(usedNames);
    // Ensure unique symbol within this lobby
    while (usedSymbols.has(company.symbol)) {
      company = generateCompanyName(usedNames);
    }
    usedSymbols.add(company.symbol);

    // Random starting price between $10 and $500
    const priceRandom = crypto.getRandomValues(new Uint16Array(1))[0];
    const basePrice = Math.round((10 + (priceRandom / 65535) * 490) * 100) / 100;

    // Random volatility between 0.03 and 0.08 (lobby stocks are more volatile)
    const volRandom = crypto.getRandomValues(new Uint8Array(1))[0];
    const volatility = Math.round((0.03 + (volRandom / 255) * 0.05) * 1000) / 1000;

    const sectorIdx = crypto.getRandomValues(new Uint8Array(1))[0] % SECTORS.length;

    await env.DB.prepare(`
      INSERT INTO lobby_stocks (lobby_id, symbol, name, current_price, previous_price, base_price, volatility)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(lobbyId, company.symbol, company.name + ' (' + SECTORS[sectorIdx] + ')', basePrice, basePrice, basePrice, volatility).run();
  }
}

// ----------------------------------------------------------
// LOBBY TICK — Price updates for active lobby matches
// ----------------------------------------------------------

async function tickLobbyPrices(env, lobbyId, tickSpeedSeconds) {
  const kvKey = `lobby_tick_${lobbyId}`;
  const lastTickStr = await env.SESSION_STORE.get(kvKey);
  const now = Date.now();
  const tickInterval = tickSpeedSeconds * 1000;

  if (lastTickStr && (now - parseInt(lastTickStr)) < tickInterval) {
    return false; // Not time yet
  }

  await env.SESSION_STORE.put(kvKey, now.toString());

  const stocks = await env.DB.prepare(
    'SELECT * FROM lobby_stocks WHERE lobby_id = ?'
  ).bind(lobbyId).all();

  const randomBytes = new Uint32Array(stocks.results.length);
  crypto.getRandomValues(randomBytes);

  for (let i = 0; i < stocks.results.length; i++) {
    const stock = stocks.results[i];
    const random = (randomBytes[i] / 0xFFFFFFFF) * 2 - 1;

    // Lobby stocks are more volatile and faster-moving
    let change = random * stock.volatility;

    // Player pressure effect (stronger in lobbies)
    const pressureEffect = stock.buy_pressure * 0.002;
    change += pressureEffect;

    // Mean reversion (weaker in lobbies — let prices run wilder)
    const deviation = (stock.current_price - stock.base_price) / stock.base_price;
    const meanReversion = -deviation * 0.003;
    change += meanReversion;

    // 15% chance of momentum spike in lobbies (more exciting)
    const momentumRoll = new Uint8Array(1);
    crypto.getRandomValues(momentumRoll);
    if (momentumRoll[0] < 38) { // ~15%
      change *= 3.0;
    }

    let newPrice = stock.current_price * (1 + change);
    newPrice = Math.max(0.50, Math.min(newPrice, stock.base_price * 100));
    newPrice = Math.round(newPrice * 100) / 100;

    const open = stock.current_price;
    const close = newPrice;
    const high = Math.max(open, close) * (1 + Math.abs(change) * 0.3);
    const low = Math.min(open, close) * (1 - Math.abs(change) * 0.3);

    await env.DB.prepare(`
      UPDATE lobby_stocks
      SET previous_price = current_price, current_price = ?, buy_pressure = buy_pressure * 0.6
      WHERE id = ?
    `).bind(newPrice, stock.id).run();

    await env.DB.prepare(`
      INSERT INTO lobby_stock_history (lobby_id, stock_id, price, open_price, high_price, low_price, close_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(lobbyId, stock.id, newPrice, open, Math.round(high * 100) / 100, Math.round(low * 100) / 100, close).run();
  }

  return true;
}

// ----------------------------------------------------------
// END LOBBY MATCH — Calculate results and distribute rewards
// ----------------------------------------------------------

async function endLobbyMatch(env, lobbyId) {
  const lobby = await env.DB.prepare('SELECT * FROM lobbies WHERE id = ?').bind(lobbyId).first();
  if (!lobby || lobby.status !== 'active') return null;

  // Mark lobby as finished
  await env.DB.prepare(
    "UPDATE lobbies SET status = 'finished', finished_at = datetime('now') WHERE id = ?"
  ).bind(lobbyId).run();

  // Get all lobby stocks for valuation
  const lobbyStocks = await env.DB.prepare(
    'SELECT * FROM lobby_stocks WHERE lobby_id = ?'
  ).bind(lobbyId).all();
  const stockMap = {};
  lobbyStocks.results.forEach(s => { stockMap[s.id] = s; });

  // Get all players
  const players = await env.DB.prepare(
    'SELECT lp.*, u.username, u.level, u.money as open_money FROM lobby_players lp JOIN users u ON lp.user_id = u.id WHERE lp.lobby_id = ?'
  ).bind(lobbyId).all();

  // Calculate final net worth for each player
  const playerResults = [];
  for (const player of players.results) {
    // Get their lobby holdings
    const holdings = await env.DB.prepare(
      'SELECT * FROM lobby_portfolios WHERE lobby_id = ? AND user_id = ?'
    ).bind(lobbyId, player.user_id).all();

    let holdingsValue = 0;
    holdings.results.forEach(h => {
      const stock = stockMap[h.stock_id];
      if (stock) holdingsValue += h.shares * stock.current_price;
    });

    const finalMoney = player.money + holdingsValue;
    playerResults.push({
      ...player,
      final_money: finalMoney,
      profit: finalMoney - 10000
    });
  }

  // Sort by final money (highest first) for placement
  playerResults.sort((a, b) => b.final_money - a.final_money);

  // Calculate rewards and XP, then update each player
  const totalPlayers = playerResults.length;
  const participationXp = 25;
  const winXp = 100;

  for (let i = 0; i < playerResults.length; i++) {
    const p = playerResults[i];
    const placement = i + 1;
    let reward = 0;
    let xpEarned = participationXp; // Everyone gets participation XP

    if (lobby.reward_type === 'pool') {
      // Pool mode: entry fees form a pot, distributed to top 3
      const pool = lobby.pool_entry_fee * totalPlayers;
      if (placement === 1) reward = Math.round(pool * 0.50 * 100) / 100;
      else if (placement === 2) reward = Math.round(pool * 0.30 * 100) / 100;
      else if (placement === 3) reward = Math.round(pool * 0.20 * 100) / 100;
    } else {
      // Percentage mode: top 3 win a % of their open mode balance
      if (placement === 1) reward = Math.round(p.open_money * (lobby.reward_percentage / 100) * 100) / 100;
      else if (placement === 2) reward = Math.round(p.open_money * (lobby.reward_percentage / 100) * 0.6 * 100) / 100;
      else if (placement === 3) reward = Math.round(p.open_money * (lobby.reward_percentage / 100) * 0.3 * 100) / 100;
    }

    // Bonus XP for placement
    if (placement === 1) xpEarned += winXp;
    else if (placement === 2) xpEarned += Math.floor(winXp * 0.6);
    else if (placement === 3) xpEarned += Math.floor(winXp * 0.3);

    // Bonus XP for profit
    if (p.profit > 0) {
      xpEarned += Math.floor(p.profit / 100) * 5;
    }

    // Update lobby_players with final results
    await env.DB.prepare(
      'UPDATE lobby_players SET final_money = ?, placement = ?, reward_earned = ?, xp_earned = ? WHERE lobby_id = ? AND user_id = ?'
    ).bind(p.final_money, placement, reward, xpEarned, lobbyId, p.user_id).run();

    // Add reward to player's open mode money
    if (reward > 0) {
      await env.DB.prepare('UPDATE users SET money = money + ? WHERE id = ?').bind(reward, p.user_id).run();
      // Update highest_money if applicable
      const updated = await env.DB.prepare('SELECT money, highest_money FROM users WHERE id = ?').bind(p.user_id).first();
      if (updated && updated.money > updated.highest_money) {
        await env.DB.prepare('UPDATE users SET highest_money = ? WHERE id = ?').bind(updated.money, p.user_id).run();
      }
    }

    // Add XP to player
    const user = await env.DB.prepare('SELECT xp FROM users WHERE id = ?').bind(p.user_id).first();
    if (user) {
      const newXp = user.xp + xpEarned;
      const newLevel = calculateLevel(newXp);
      await env.DB.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').bind(newXp, newLevel, p.user_id).run();
    }
  }

  // Clean up KV tick key
  await env.SESSION_STORE.delete(`lobby_tick_${lobbyId}`);

  return playerResults;
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

      // Get price history filtered by time range (in minutes)
      const minutes = parseInt(url.searchParams.get('minutes') || '60');
      const clampedMinutes = Math.min(Math.max(minutes, 5), 1440); // 5 min to 24 hours
      const history = await env.DB.prepare(
        `SELECT price, open_price, high_price, low_price, close_price, volume, timestamp
         FROM stock_history
         WHERE stock_id = ? AND timestamp >= datetime('now', '-' || ? || ' minutes')
         ORDER BY timestamp ASC`
      ).bind(stockId, clampedMinutes).all();

      // Get user's holdings for this stock
      const holding = await env.DB.prepare(
        'SELECT shares, avg_buy_price FROM portfolios WHERE user_id = ? AND stock_id = ?'
      ).bind(user.id, stockId).first();

      return jsonResponse({
        stock,
        history: history.results, // already ordered oldest-first (ASC)
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

    // --- GET USER'S WATCHLIST WITH MINI CHART DATA ---
    if (path === 'watchlist' && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const watchlist = await env.DB.prepare(`
        SELECT s.id, s.symbol, s.name, s.sector, s.current_price, s.previous_price, s.base_price
        FROM watchlist w
        JOIN stocks s ON w.stock_id = s.id
        WHERE w.user_id = ?
        ORDER BY s.symbol
      `).bind(user.id).all();

      // Fetch mini price history (last 20 points) for each watchlist stock
      const withSparklines = await Promise.all(watchlist.results.map(async (stock) => {
        const hist = await env.DB.prepare(
          'SELECT close_price FROM stock_history WHERE stock_id = ? ORDER BY timestamp DESC LIMIT 20'
        ).bind(stock.id).all();
        return {
          ...stock,
          sparkline: hist.results.map(h => h.close_price).reverse()
        };
      }));

      return jsonResponse({ watchlist: withSparklines });
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
    // LOBBY ROUTES — Competitive Matches
    // ======================================

    // --- LIST OPEN LOBBIES ---
    if (path === 'lobbies' && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const lobbies = await env.DB.prepare(`
        SELECT l.*, u.username as creator_name, u.level as creator_level,
               (SELECT COUNT(*) FROM lobby_players WHERE lobby_id = l.id) as player_count
        FROM lobbies l
        JOIN users u ON l.creator_id = u.id
        WHERE l.status IN ('waiting', 'active')
        ORDER BY l.created_at DESC
        LIMIT 50
      `).all();

      return jsonResponse({ lobbies: lobbies.results });
    }

    // --- GET USER'S ACTIVE/WAITING LOBBY ---
    if (path === 'lobbies/my-active' && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const activeLobby = await env.DB.prepare(`
        SELECT l.* FROM lobbies l
        JOIN lobby_players lp ON l.id = lp.lobby_id
        WHERE lp.user_id = ? AND l.status IN ('waiting', 'active')
        LIMIT 1
      `).bind(user.id).first();

      return jsonResponse({ lobby: activeLobby || null });
    }

    // --- CREATE LOBBY ---
    if (path === 'lobbies/create' && method === 'POST') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      // Check if user is already in a lobby
      const existing = await env.DB.prepare(`
        SELECT l.id FROM lobbies l
        JOIN lobby_players lp ON l.id = lp.lobby_id
        WHERE lp.user_id = ? AND l.status IN ('waiting', 'active')
      `).bind(user.id).first();
      if (existing) return jsonResponse({ error: 'You are already in a lobby. Leave it first.' }, 400);

      const body = await request.json();
      const name = sanitize(body.name || '').substring(0, 40) || `${user.username}'s Lobby`;
      const maxPlayers = Math.max(2, Math.min(8, parseInt(body.maxPlayers) || 8));
      const timeLimitMinutes = Math.max(5, Math.min(60, parseInt(body.timeLimit) || 15));
      const tickSpeed = Math.max(3, Math.min(10, parseInt(body.tickSpeed) || 5));
      const isLocked = body.isLocked ? 1 : 0;
      const rewardType = body.rewardType === 'percentage' ? 'percentage' : 'pool';
      const poolEntryFee = Math.max(0, Math.min(5000, parseFloat(body.entryFee) || 500));
      const rewardPercentage = Math.max(1, Math.min(50, parseFloat(body.rewardPercentage) || 10));

      // For pool mode, check if user can afford the entry fee
      if (rewardType === 'pool' && user.money < poolEntryFee) {
        return jsonResponse({ error: `Not enough money for the $${poolEntryFee.toFixed(2)} entry fee` }, 400);
      }

      // Create the lobby
      const result = await env.DB.prepare(`
        INSERT INTO lobbies (creator_id, name, max_players, time_limit_minutes, tick_speed_seconds, is_locked, reward_type, pool_entry_fee, reward_percentage)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(user.id, name, maxPlayers, timeLimitMinutes, tickSpeed, isLocked, rewardType, poolEntryFee, rewardPercentage).run();

      const lobbyId = result.meta.last_row_id;

      // Auto-join the creator
      await env.DB.prepare(
        'INSERT INTO lobby_players (lobby_id, user_id) VALUES (?, ?)'
      ).bind(lobbyId, user.id).run();

      // Deduct entry fee for pool mode
      if (rewardType === 'pool') {
        await env.DB.prepare('UPDATE users SET money = money - ? WHERE id = ?').bind(poolEntryFee, user.id).run();
      }

      return jsonResponse({ success: true, lobbyId });
    }

    // --- GET LOBBY DETAILS ---
    if (path.match(/^lobbies\/\d+$/) && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const lobbyId = parseInt(path.split('/')[1]);
      const lobby = await env.DB.prepare('SELECT * FROM lobbies WHERE id = ?').bind(lobbyId).first();
      if (!lobby) return jsonResponse({ error: 'Lobby not found' }, 404);

      // Get players in this lobby
      const players = await env.DB.prepare(`
        SELECT lp.*, u.username, u.level, u.money as open_money
        FROM lobby_players lp
        JOIN users u ON lp.user_id = u.id
        WHERE lp.lobby_id = ?
        ORDER BY lp.joined_at
      `).bind(lobbyId).all();

      // Get lobby stocks if match is active
      let stocks = [];
      if (lobby.status === 'active') {
        const stocksRes = await env.DB.prepare(
          'SELECT * FROM lobby_stocks WHERE lobby_id = ? ORDER BY symbol'
        ).bind(lobbyId).all();
        stocks = stocksRes.results;
      }

      return jsonResponse({ lobby, players: players.results, stocks });
    }

    // --- JOIN LOBBY ---
    if (path === 'lobbies/join' && method === 'POST') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const body = await request.json();
      const lobbyId = parseInt(body.lobbyId);
      if (!lobbyId) return jsonResponse({ error: 'Invalid lobby' }, 400);

      // Check if user is already in a lobby
      const existing = await env.DB.prepare(`
        SELECT l.id FROM lobbies l
        JOIN lobby_players lp ON l.id = lp.lobby_id
        WHERE lp.user_id = ? AND l.status IN ('waiting', 'active')
      `).bind(user.id).first();
      if (existing) return jsonResponse({ error: 'You are already in a lobby. Leave it first.' }, 400);

      const lobby = await env.DB.prepare('SELECT * FROM lobbies WHERE id = ?').bind(lobbyId).first();
      if (!lobby) return jsonResponse({ error: 'Lobby not found' }, 404);
      if (lobby.status !== 'waiting') return jsonResponse({ error: 'This lobby has already started or ended' }, 400);
      if (lobby.is_locked) return jsonResponse({ error: 'This lobby is locked' }, 400);

      // Check max players
      const count = await env.DB.prepare(
        'SELECT COUNT(*) as c FROM lobby_players WHERE lobby_id = ?'
      ).bind(lobbyId).first();
      if (count.c >= lobby.max_players) return jsonResponse({ error: 'Lobby is full' }, 400);

      // For pool mode, check if user can afford the entry fee
      if (lobby.reward_type === 'pool' && user.money < lobby.pool_entry_fee) {
        return jsonResponse({ error: `Not enough money for the $${lobby.pool_entry_fee.toFixed(2)} entry fee` }, 400);
      }

      // Join the lobby
      await env.DB.prepare(
        'INSERT INTO lobby_players (lobby_id, user_id) VALUES (?, ?)'
      ).bind(lobbyId, user.id).run();

      // Deduct entry fee for pool mode
      if (lobby.reward_type === 'pool') {
        await env.DB.prepare('UPDATE users SET money = money - ? WHERE id = ?').bind(lobby.pool_entry_fee, user.id).run();
      }

      return jsonResponse({ success: true });
    }

    // --- LEAVE LOBBY ---
    if (path === 'lobbies/leave' && method === 'POST') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const body = await request.json();
      const lobbyId = parseInt(body.lobbyId);
      if (!lobbyId) return jsonResponse({ error: 'Invalid lobby' }, 400);

      const lobby = await env.DB.prepare('SELECT * FROM lobbies WHERE id = ?').bind(lobbyId).first();
      if (!lobby) return jsonResponse({ error: 'Lobby not found' }, 404);
      if (lobby.status !== 'waiting') return jsonResponse({ error: 'Cannot leave an active match' }, 400);

      // Remove player from lobby
      await env.DB.prepare('DELETE FROM lobby_players WHERE lobby_id = ? AND user_id = ?').bind(lobbyId, user.id).run();

      // Refund entry fee for pool mode
      if (lobby.reward_type === 'pool') {
        await env.DB.prepare('UPDATE users SET money = money + ? WHERE id = ?').bind(lobby.pool_entry_fee, user.id).run();
      }

      // If creator left, delete the lobby entirely and refund everyone
      if (lobby.creator_id === user.id) {
        // Refund all remaining players
        if (lobby.reward_type === 'pool') {
          const remainingPlayers = await env.DB.prepare(
            'SELECT user_id FROM lobby_players WHERE lobby_id = ?'
          ).bind(lobbyId).all();
          for (const p of remainingPlayers.results) {
            await env.DB.prepare('UPDATE users SET money = money + ? WHERE id = ?').bind(lobby.pool_entry_fee, p.user_id).run();
          }
        }
        await env.DB.prepare('DELETE FROM lobby_players WHERE lobby_id = ?').bind(lobbyId).run();
        await env.DB.prepare('DELETE FROM lobbies WHERE id = ?').bind(lobbyId).run();
      }

      return jsonResponse({ success: true });
    }

    // --- START LOBBY MATCH (creator only) ---
    if (path === 'lobbies/start' && method === 'POST') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const body = await request.json();
      const lobbyId = parseInt(body.lobbyId);
      if (!lobbyId) return jsonResponse({ error: 'Invalid lobby' }, 400);

      const lobby = await env.DB.prepare('SELECT * FROM lobbies WHERE id = ?').bind(lobbyId).first();
      if (!lobby) return jsonResponse({ error: 'Lobby not found' }, 404);
      if (lobby.creator_id !== user.id) return jsonResponse({ error: 'Only the creator can start the match' }, 403);
      if (lobby.status !== 'waiting') return jsonResponse({ error: 'Lobby already started or finished' }, 400);

      // Need at least 2 players
      const count = await env.DB.prepare('SELECT COUNT(*) as c FROM lobby_players WHERE lobby_id = ?').bind(lobbyId).first();
      if (count.c < 2) return jsonResponse({ error: 'Need at least 2 players to start' }, 400);

      // Generate random stocks for this match
      await generateLobbyStocks(env, lobbyId);

      // Set all players to $10,000 starting money
      await env.DB.prepare('UPDATE lobby_players SET money = 10000.00 WHERE lobby_id = ?').bind(lobbyId).run();

      // Update lobby status
      await env.DB.prepare(
        "UPDATE lobbies SET status = 'active', started_at = datetime('now') WHERE id = ?"
      ).bind(lobbyId).run();

      return jsonResponse({ success: true });
    }

    // --- LOBBY TICK (poll for price updates during match) ---
    if (path === 'lobbies/tick' && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const lobbyId = parseInt(url.searchParams.get('lobbyId'));
      if (!lobbyId) return jsonResponse({ error: 'Missing lobbyId' }, 400);

      const lobby = await env.DB.prepare('SELECT * FROM lobbies WHERE id = ?').bind(lobbyId).first();
      if (!lobby) return jsonResponse({ error: 'Lobby not found' }, 404);

      // Check if match has expired
      if (lobby.status === 'active' && lobby.started_at) {
        const startTime = new Date(lobby.started_at + 'Z').getTime();
        const endTime = startTime + (lobby.time_limit_minutes * 60 * 1000);
        const now = Date.now();
        const timeRemaining = Math.max(0, endTime - now);

        if (timeRemaining <= 0) {
          // Match is over — end it
          await endLobbyMatch(env, lobbyId);
          return jsonResponse({ matchEnded: true, lobbyId });
        }

        // Tick prices
        const ticked = await tickLobbyPrices(env, lobbyId, lobby.tick_speed_seconds);

        // Get current prices
        const prices = await env.DB.prepare(
          'SELECT id, symbol, current_price, previous_price FROM lobby_stocks WHERE lobby_id = ?'
        ).bind(lobbyId).all();

        // Get mini leaderboard (player net worth rankings)
        const players = await env.DB.prepare(`
          SELECT lp.user_id, lp.money, u.username
          FROM lobby_players lp JOIN users u ON lp.user_id = u.id
          WHERE lp.lobby_id = ?
        `).bind(lobbyId).all();

        // Calculate net worth for each player
        const lobbyStocks = await env.DB.prepare(
          'SELECT * FROM lobby_stocks WHERE lobby_id = ?'
        ).bind(lobbyId).all();
        const stockMap = {};
        lobbyStocks.results.forEach(s => { stockMap[s.id] = s; });

        const rankings = [];
        for (const p of players.results) {
          const holdings = await env.DB.prepare(
            'SELECT stock_id, shares FROM lobby_portfolios WHERE lobby_id = ? AND user_id = ?'
          ).bind(lobbyId, p.user_id).all();
          let holdingsValue = 0;
          holdings.results.forEach(h => {
            if (stockMap[h.stock_id]) holdingsValue += h.shares * stockMap[h.stock_id].current_price;
          });
          rankings.push({
            user_id: p.user_id,
            username: p.username,
            netWorth: Math.round((p.money + holdingsValue) * 100) / 100
          });
        }
        rankings.sort((a, b) => b.netWorth - a.netWorth);

        return jsonResponse({
          ticked,
          prices: prices.results,
          rankings,
          timeRemaining: Math.floor(timeRemaining / 1000),
          matchEnded: false
        });
      }

      return jsonResponse({ error: 'Lobby is not active', status: lobby.status }, 400);
    }

    // --- BUY STOCK IN LOBBY ---
    if (path === 'lobbies/buy' && method === 'POST') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const body = await request.json();
      const lobbyId = parseInt(body.lobbyId);
      const stockId = parseInt(body.stockId);
      const shares = parseInt(body.shares);

      if (!lobbyId || !stockId || !shares || shares < 1) {
        return jsonResponse({ error: 'Invalid request' }, 400);
      }

      // Verify player is in this active lobby
      const player = await env.DB.prepare(
        'SELECT * FROM lobby_players WHERE lobby_id = ? AND user_id = ?'
      ).bind(lobbyId, user.id).first();
      if (!player) return jsonResponse({ error: 'You are not in this lobby' }, 403);

      const lobby = await env.DB.prepare('SELECT status FROM lobbies WHERE id = ?').bind(lobbyId).first();
      if (!lobby || lobby.status !== 'active') return jsonResponse({ error: 'Match is not active' }, 400);

      // Get the lobby stock
      const stock = await env.DB.prepare(
        'SELECT * FROM lobby_stocks WHERE id = ? AND lobby_id = ?'
      ).bind(stockId, lobbyId).first();
      if (!stock) return jsonResponse({ error: 'Stock not found' }, 404);

      const totalCost = stock.current_price * shares;
      if (player.money < totalCost) {
        return jsonResponse({ error: `Not enough money. Need $${totalCost.toFixed(2)}` }, 400);
      }

      // Deduct money
      await env.DB.prepare(
        'UPDATE lobby_players SET money = money - ? WHERE lobby_id = ? AND user_id = ?'
      ).bind(totalCost, lobbyId, user.id).run();

      // Update or create holding
      const existing = await env.DB.prepare(
        'SELECT shares, avg_buy_price FROM lobby_portfolios WHERE lobby_id = ? AND user_id = ? AND stock_id = ?'
      ).bind(lobbyId, user.id, stockId).first();

      if (existing) {
        const newTotal = existing.shares + shares;
        const newAvg = ((existing.avg_buy_price * existing.shares) + (stock.current_price * shares)) / newTotal;
        await env.DB.prepare(
          'UPDATE lobby_portfolios SET shares = ?, avg_buy_price = ? WHERE lobby_id = ? AND user_id = ? AND stock_id = ?'
        ).bind(newTotal, newAvg, lobbyId, user.id, stockId).run();
      } else {
        await env.DB.prepare(
          'INSERT INTO lobby_portfolios (lobby_id, user_id, stock_id, shares, avg_buy_price) VALUES (?, ?, ?, ?, ?)'
        ).bind(lobbyId, user.id, stockId, shares, stock.current_price).run();
      }

      // Log transaction
      await env.DB.prepare(
        'INSERT INTO lobby_transactions (lobby_id, user_id, stock_id, type, shares, price_per_share, total_cost) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(lobbyId, user.id, stockId, 'buy', shares, stock.current_price, totalCost).run();

      // Add buy pressure
      const pressure = (shares * stock.current_price) / 5000;
      await env.DB.prepare('UPDATE lobby_stocks SET buy_pressure = buy_pressure + ? WHERE id = ?').bind(pressure, stockId).run();

      // Get updated player money
      const updatedPlayer = await env.DB.prepare(
        'SELECT money FROM lobby_players WHERE lobby_id = ? AND user_id = ?'
      ).bind(lobbyId, user.id).first();

      return jsonResponse({
        success: true,
        message: `Bought ${shares}x ${stock.symbol} @ $${stock.current_price.toFixed(2)}`,
        newBalance: updatedPlayer.money
      });
    }

    // --- SELL STOCK IN LOBBY ---
    if (path === 'lobbies/sell' && method === 'POST') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const body = await request.json();
      const lobbyId = parseInt(body.lobbyId);
      const stockId = parseInt(body.stockId);
      const shares = parseInt(body.shares);

      if (!lobbyId || !stockId || !shares || shares < 1) {
        return jsonResponse({ error: 'Invalid request' }, 400);
      }

      const player = await env.DB.prepare(
        'SELECT * FROM lobby_players WHERE lobby_id = ? AND user_id = ?'
      ).bind(lobbyId, user.id).first();
      if (!player) return jsonResponse({ error: 'You are not in this lobby' }, 403);

      const lobby = await env.DB.prepare('SELECT status FROM lobbies WHERE id = ?').bind(lobbyId).first();
      if (!lobby || lobby.status !== 'active') return jsonResponse({ error: 'Match is not active' }, 400);

      const holding = await env.DB.prepare(
        'SELECT shares, avg_buy_price FROM lobby_portfolios WHERE lobby_id = ? AND user_id = ? AND stock_id = ?'
      ).bind(lobbyId, user.id, stockId).first();
      if (!holding || holding.shares < shares) {
        return jsonResponse({ error: 'Not enough shares' }, 400);
      }

      const stock = await env.DB.prepare(
        'SELECT * FROM lobby_stocks WHERE id = ? AND lobby_id = ?'
      ).bind(stockId, lobbyId).first();
      if (!stock) return jsonResponse({ error: 'Stock not found' }, 404);

      const totalRevenue = stock.current_price * shares;
      const profitLoss = (stock.current_price - holding.avg_buy_price) * shares;

      // Add money
      await env.DB.prepare(
        'UPDATE lobby_players SET money = money + ? WHERE lobby_id = ? AND user_id = ?'
      ).bind(totalRevenue, lobbyId, user.id).run();

      // Update or remove holding
      const remaining = holding.shares - shares;
      if (remaining <= 0) {
        await env.DB.prepare(
          'DELETE FROM lobby_portfolios WHERE lobby_id = ? AND user_id = ? AND stock_id = ?'
        ).bind(lobbyId, user.id, stockId).run();
      } else {
        await env.DB.prepare(
          'UPDATE lobby_portfolios SET shares = ? WHERE lobby_id = ? AND user_id = ? AND stock_id = ?'
        ).bind(remaining, lobbyId, user.id, stockId).run();
      }

      // Log transaction
      await env.DB.prepare(
        'INSERT INTO lobby_transactions (lobby_id, user_id, stock_id, type, shares, price_per_share, total_cost, profit_loss) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(lobbyId, user.id, stockId, 'sell', shares, stock.current_price, totalRevenue, profitLoss).run();

      // Add sell pressure
      const pressure = -(shares * stock.current_price) / 5000;
      await env.DB.prepare('UPDATE lobby_stocks SET buy_pressure = buy_pressure + ? WHERE id = ?').bind(pressure, stockId).run();

      const updatedPlayer = await env.DB.prepare(
        'SELECT money FROM lobby_players WHERE lobby_id = ? AND user_id = ?'
      ).bind(lobbyId, user.id).first();

      return jsonResponse({
        success: true,
        message: `Sold ${shares}x ${stock.symbol} @ $${stock.current_price.toFixed(2)}`,
        profitLoss,
        newBalance: updatedPlayer.money
      });
    }

    // --- GET LOBBY PORTFOLIO ---
    if (path === 'lobbies/portfolio' && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const lobbyId = parseInt(url.searchParams.get('lobbyId'));
      if (!lobbyId) return jsonResponse({ error: 'Missing lobbyId' }, 400);

      const player = await env.DB.prepare(
        'SELECT money FROM lobby_players WHERE lobby_id = ? AND user_id = ?'
      ).bind(lobbyId, user.id).first();
      if (!player) return jsonResponse({ error: 'You are not in this lobby' }, 403);

      const holdings = await env.DB.prepare(`
        SELECT lp.shares, lp.avg_buy_price, ls.id as stock_id, ls.symbol, ls.name, ls.current_price, ls.previous_price
        FROM lobby_portfolios lp
        JOIN lobby_stocks ls ON lp.stock_id = ls.id
        WHERE lp.lobby_id = ? AND lp.user_id = ?
      `).bind(lobbyId, user.id).all();

      let totalValue = 0;
      const enriched = holdings.results.map(h => {
        const val = h.shares * h.current_price;
        totalValue += val;
        return {
          ...h,
          currentValue: val,
          profitLoss: val - (h.shares * h.avg_buy_price),
          profitLossPercent: ((h.current_price - h.avg_buy_price) / h.avg_buy_price * 100)
        };
      });

      return jsonResponse({
        holdings: enriched,
        cash: player.money,
        totalValue,
        netWorth: player.money + totalValue
      });
    }

    // --- GET LOBBY MATCH RESULTS ---
    if (path.match(/^lobbies\/results\/\d+$/) && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      const lobbyId = parseInt(path.split('/')[2]);
      const lobby = await env.DB.prepare('SELECT * FROM lobbies WHERE id = ?').bind(lobbyId).first();
      if (!lobby) return jsonResponse({ error: 'Lobby not found' }, 404);
      if (lobby.status !== 'finished') return jsonResponse({ error: 'Match has not finished yet' }, 400);

      const results = await env.DB.prepare(`
        SELECT lp.*, u.username, u.level
        FROM lobby_players lp
        JOIN users u ON lp.user_id = u.id
        WHERE lp.lobby_id = ?
        ORDER BY lp.placement ASC
      `).bind(lobbyId).all();

      // Get trade stats per player
      const enrichedResults = [];
      for (const r of results.results) {
        const trades = await env.DB.prepare(
          'SELECT type, COUNT(*) as count, SUM(total_cost) as total FROM lobby_transactions WHERE lobby_id = ? AND user_id = ? GROUP BY type'
        ).bind(lobbyId, r.user_id).all();
        const tradeStats = { buys: 0, sells: 0, buyVolume: 0, sellVolume: 0 };
        trades.results.forEach(t => {
          if (t.type === 'buy') { tradeStats.buys = t.count; tradeStats.buyVolume = t.total; }
          else { tradeStats.sells = t.count; tradeStats.sellVolume = t.total; }
        });
        enrichedResults.push({ ...r, tradeStats });
      }

      return jsonResponse({ lobby, results: enrichedResults });
    }

    // ======================================
    // GLOBAL CHAT ROUTES
    // ======================================

    // --- GET RECENT CHAT MESSAGES ---
    if (path === 'chat/messages' && method === 'GET') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      // Check if chat is enabled
      const config = await env.DB.prepare("SELECT value FROM game_config WHERE key = 'chat_enabled'").first();
      if (config && config.value !== '1') {
        return jsonResponse({ messages: [], disabled: true });
      }

      const since = url.searchParams.get('since') || '';
      let messages;
      if (since) {
        messages = await env.DB.prepare(`
          SELECT cm.id, cm.message, cm.created_at, u.username, u.level, u.equipped_title
          FROM chat_messages cm JOIN users u ON cm.user_id = u.id
          WHERE cm.created_at > ?
          ORDER BY cm.created_at ASC
          LIMIT 50
        `).bind(since).all();
      } else {
        messages = await env.DB.prepare(`
          SELECT cm.id, cm.message, cm.created_at, u.username, u.level, u.equipped_title
          FROM chat_messages cm JOIN users u ON cm.user_id = u.id
          ORDER BY cm.created_at DESC
          LIMIT 50
        `).all();
        // Reverse so oldest first
        messages.results.reverse();
      }

      return jsonResponse({ messages: messages.results });
    }

    // --- SEND CHAT MESSAGE ---
    if (path === 'chat/send' && method === 'POST') {
      const user = await getSessionUser(request, env);
      if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

      // Check if chat is enabled
      const config = await env.DB.prepare("SELECT value FROM game_config WHERE key = 'chat_enabled'").first();
      if (config && config.value !== '1') {
        return jsonResponse({ error: 'Chat is currently disabled' }, 403);
      }

      // Check if user is chat banned
      if (user.chat_banned) {
        return jsonResponse({ error: 'You are banned from chat' }, 403);
      }

      const body = await request.json();
      const message = sanitize((body.message || '').substring(0, 200));
      if (!message) return jsonResponse({ error: 'Message cannot be empty' }, 400);

      await env.DB.prepare(
        'INSERT INTO chat_messages (user_id, message) VALUES (?, ?)'
      ).bind(user.id, message).run();

      return jsonResponse({ success: true });
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
