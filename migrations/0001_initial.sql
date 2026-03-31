-- ============================================================
-- BullRun — Database Schema (Cloudflare D1 / SQLite)
-- ============================================================
-- This creates all the tables the game needs.
-- Run this once when setting up the project.
-- ============================================================

-- ----------------------------------------
-- USERS — Player accounts
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,  -- case-insensitive usernames
    password_hash TEXT NOT NULL,                    -- PBKDF2-hashed password
    password_salt TEXT NOT NULL,                    -- unique salt per user
    money REAL DEFAULT 10000.00,                   -- current Open mode balance
    xp INTEGER DEFAULT 0,                          -- experience points
    level INTEGER DEFAULT 1,                       -- player level
    highest_money REAL DEFAULT 10000.00,           -- all-time highest balance
    is_admin INTEGER DEFAULT 0,                    -- 1 = admin account
    is_banned INTEGER DEFAULT 0,                   -- 1 = banned from game
    chat_banned INTEGER DEFAULT 0,                 -- 1 = banned from chat only
    equipped_title TEXT DEFAULT NULL,               -- currently equipped title
    equipped_background TEXT DEFAULT NULL,          -- currently equipped profile bg
    equipped_card_style TEXT DEFAULT NULL,          -- currently equipped leaderboard card
    created_at TEXT DEFAULT (datetime('now')),
    last_active TEXT DEFAULT (datetime('now'))
);

-- ----------------------------------------
-- STOCKS — All tradeable stocks (Open mode)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL UNIQUE,          -- e.g. "AAPL", "NEON"
    name TEXT NOT NULL,                   -- e.g. "Apple Inc.", "NeonTech"
    sector TEXT DEFAULT 'General',        -- e.g. "Tech", "Energy"
    current_price REAL NOT NULL,          -- latest price
    previous_price REAL NOT NULL,         -- price before last tick (for % change)
    base_price REAL NOT NULL,             -- starting price at week reset
    volatility REAL DEFAULT 0.02,         -- how much this stock moves per tick (0-1)
    buy_pressure REAL DEFAULT 0.0,        -- accumulated player buy/sell pressure
    is_active INTEGER DEFAULT 1,          -- 1 = tradeable, 0 = delisted
    created_at TEXT DEFAULT (datetime('now'))
);

-- ----------------------------------------
-- PORTFOLIOS — What stocks each player owns
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS portfolios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stock_id INTEGER NOT NULL,
    shares INTEGER NOT NULL DEFAULT 0,          -- number of shares held
    avg_buy_price REAL NOT NULL DEFAULT 0.0,    -- average price paid per share
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (stock_id) REFERENCES stocks(id),
    UNIQUE(user_id, stock_id)                   -- one row per user per stock
);

-- ----------------------------------------
-- TRANSACTIONS — Trade history log
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stock_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('buy', 'sell')),
    shares INTEGER NOT NULL,
    price_per_share REAL NOT NULL,      -- price at time of trade
    total_cost REAL NOT NULL,           -- shares * price
    profit_loss REAL DEFAULT 0.0,       -- profit/loss (only for sells)
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (stock_id) REFERENCES stocks(id)
);

-- ----------------------------------------
-- STOCK_HISTORY — Price history for charts
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS stock_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id INTEGER NOT NULL,
    price REAL NOT NULL,
    open_price REAL NOT NULL,       -- candle open
    high_price REAL NOT NULL,       -- candle high
    low_price REAL NOT NULL,        -- candle low
    close_price REAL NOT NULL,      -- candle close
    volume INTEGER DEFAULT 0,       -- shares traded in this period
    timestamp TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (stock_id) REFERENCES stocks(id)
);

-- ----------------------------------------
-- LOBBIES — Closed mode game lobbies
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS lobbies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'waiting' CHECK(status IN ('waiting', 'active', 'finished')),
    max_players INTEGER DEFAULT 8,
    time_limit_minutes INTEGER DEFAULT 15,
    tick_speed_seconds INTEGER DEFAULT 5,
    is_locked INTEGER DEFAULT 0,          -- 1 = invite only
    reward_type TEXT DEFAULT 'pool' CHECK(reward_type IN ('pool', 'percentage')),
    pool_entry_fee REAL DEFAULT 500.0,    -- entry fee if pool mode
    reward_percentage REAL DEFAULT 10.0,  -- % reward if percentage mode
    started_at TEXT DEFAULT NULL,
    finished_at TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- ----------------------------------------
-- LOBBY_PLAYERS — Players in each lobby
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS lobby_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lobby_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    money REAL DEFAULT 10000.00,     -- starting money for this match
    final_money REAL DEFAULT NULL,   -- ending money (set when match ends)
    placement INTEGER DEFAULT NULL,  -- final rank
    reward_earned REAL DEFAULT 0.0,  -- reward won
    xp_earned INTEGER DEFAULT 0,     -- XP earned from this match
    joined_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (lobby_id) REFERENCES lobbies(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(lobby_id, user_id)
);

-- ----------------------------------------
-- LOBBY_STOCKS — Stocks in each closed match
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS lobby_stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lobby_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    current_price REAL NOT NULL,
    previous_price REAL NOT NULL,
    base_price REAL NOT NULL,
    volatility REAL DEFAULT 0.05,
    buy_pressure REAL DEFAULT 0.0,
    FOREIGN KEY (lobby_id) REFERENCES lobbies(id)
);

-- ----------------------------------------
-- LOBBY_PORTFOLIOS — Holdings within a match
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS lobby_portfolios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lobby_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    stock_id INTEGER NOT NULL,       -- references lobby_stocks.id
    shares INTEGER NOT NULL DEFAULT 0,
    avg_buy_price REAL NOT NULL DEFAULT 0.0,
    FOREIGN KEY (lobby_id) REFERENCES lobbies(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (stock_id) REFERENCES lobby_stocks(id),
    UNIQUE(lobby_id, user_id, stock_id)
);

-- ----------------------------------------
-- LOBBY_TRANSACTIONS — Trade log for matches
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS lobby_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lobby_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    stock_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('buy', 'sell')),
    shares INTEGER NOT NULL,
    price_per_share REAL NOT NULL,
    total_cost REAL NOT NULL,
    profit_loss REAL DEFAULT 0.0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (lobby_id) REFERENCES lobbies(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (stock_id) REFERENCES lobby_stocks(id)
);

-- ----------------------------------------
-- COSMETICS — All cosmetic items in the game
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS cosmetics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('title', 'background', 'card_style', 'effect')),
    rarity TEXT DEFAULT 'common' CHECK(rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    description TEXT DEFAULT '',
    css_value TEXT DEFAULT '',         -- CSS class or value for rendering
    source TEXT DEFAULT 'battlepass' CHECK(source IN ('battlepass', 'crate')),
    battlepass_level INTEGER DEFAULT NULL,  -- which level unlocks this (if battlepass)
    created_at TEXT DEFAULT (datetime('now'))
);

-- ----------------------------------------
-- USER_COSMETICS — Cosmetics owned by players
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS user_cosmetics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    cosmetic_id INTEGER NOT NULL,
    obtained_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (cosmetic_id) REFERENCES cosmetics(id),
    UNIQUE(user_id, cosmetic_id)
);

-- ----------------------------------------
-- CHAT_MESSAGES — Global chat
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ----------------------------------------
-- ANNOUNCEMENTS — Admin announcements
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ----------------------------------------
-- BANS — IP and account bans
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER DEFAULT NULL,       -- NULL if IP-only ban
    ip_address TEXT DEFAULT NULL,        -- NULL if account-only ban
    reason TEXT DEFAULT '',
    banned_by INTEGER DEFAULT NULL,      -- admin who issued the ban
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (banned_by) REFERENCES users(id)
);

-- ----------------------------------------
-- GAME_CONFIG — Global game settings
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS game_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Insert default config values
INSERT OR IGNORE INTO game_config (key, value) VALUES
    ('admin_password', 'BullRun2026!'),          -- default admin panel password
    ('chat_enabled', '1'),                        -- global chat on/off
    ('open_market_tick_seconds', '30'),           -- how often prices update
    ('starting_money', '10000'),                  -- money on weekly reset
    ('weekly_reset_day', 'monday'),               -- when the week resets
    ('xp_per_profitable_trade', '10'),            -- XP for a profitable sell
    ('xp_per_lobby_participation', '25'),         -- XP for playing a lobby
    ('xp_per_lobby_win', '100');                  -- XP for winning a lobby

-- ----------------------------------------
-- SEED DATA — Starting stocks for Open mode
-- ----------------------------------------
INSERT OR IGNORE INTO stocks (symbol, name, sector, current_price, previous_price, base_price, volatility) VALUES
    -- Real company names (simulated prices)
    ('AAPL', 'Apple Inc.', 'Technology', 178.50, 178.50, 178.50, 0.015),
    ('TSLA', 'Tesla Inc.', 'Automotive', 245.00, 245.00, 245.00, 0.035),
    ('MSFT', 'Microsoft Corp.', 'Technology', 420.00, 420.00, 420.00, 0.012),
    ('AMZN', 'Amazon.com Inc.', 'E-Commerce', 185.00, 185.00, 185.00, 0.020),
    ('GOOGL', 'Alphabet Inc.', 'Technology', 165.00, 165.00, 165.00, 0.018),
    ('NVDA', 'NVIDIA Corp.', 'Technology', 890.00, 890.00, 890.00, 0.040),
    ('META', 'Meta Platforms', 'Social Media', 510.00, 510.00, 510.00, 0.025),
    ('NFLX', 'Netflix Inc.', 'Entertainment', 680.00, 680.00, 680.00, 0.022),
    ('DIS', 'Walt Disney Co.', 'Entertainment', 112.00, 112.00, 112.00, 0.018),
    ('SPOT', 'Spotify Technology', 'Music', 325.00, 325.00, 325.00, 0.028),
    ('UBER', 'Uber Technologies', 'Transport', 78.00, 78.00, 78.00, 0.030),
    ('COIN', 'Coinbase Global', 'Crypto', 205.00, 205.00, 205.00, 0.045),
    ('RBLX', 'Roblox Corp.', 'Gaming', 42.00, 42.00, 42.00, 0.038),
    ('EA', 'Electronic Arts', 'Gaming', 138.00, 138.00, 138.00, 0.020),
    ('NKE', 'Nike Inc.', 'Fashion', 98.00, 98.00, 98.00, 0.016),
    -- Fake companies (fun made-up names)
    ('NEON', 'NeonTech Industries', 'Technology', 67.00, 67.00, 67.00, 0.035),
    ('VOID', 'Void Dynamics', 'Aerospace', 234.00, 234.00, 234.00, 0.030),
    ('PXLR', 'PixelForge Labs', 'Gaming', 19.50, 19.50, 19.50, 0.050),
    ('SOLR', 'SolarVolt Energy', 'Energy', 88.00, 88.00, 88.00, 0.025),
    ('AQUA', 'AquaPure Systems', 'Utilities', 45.00, 45.00, 45.00, 0.015),
    ('BOLT', 'BoltSpeed Logistics', 'Logistics', 112.00, 112.00, 112.00, 0.028),
    ('CRYO', 'CryoGen Medical', 'Healthcare', 156.00, 156.00, 156.00, 0.022),
    ('DUSK', 'DuskWave Media', 'Media', 34.00, 34.00, 34.00, 0.040),
    ('FLUX', 'FluxCore Robotics', 'Technology', 278.00, 278.00, 278.00, 0.032),
    ('GRIT', 'GritStone Mining', 'Mining', 53.00, 53.00, 53.00, 0.020),
    ('HALO', 'HaloSync Networks', 'Telecom', 92.00, 92.00, 92.00, 0.018),
    ('IRON', 'IronClad Security', 'Cybersecurity', 145.00, 145.00, 145.00, 0.026),
    ('JETS', 'JetStream Aviation', 'Airlines', 67.00, 67.00, 67.00, 0.035),
    ('KODA', 'Koda Biotech', 'Biotech', 312.00, 312.00, 312.00, 0.042),
    ('LYNX', 'Lynx Financial', 'Finance', 78.00, 78.00, 78.00, 0.020),
    ('MARS', 'MarsCol Ventures', 'Space', 420.00, 420.00, 420.00, 0.048),
    ('NOVA', 'NovaShield Defense', 'Defense', 198.00, 198.00, 198.00, 0.016),
    ('ONYX', 'OnyxWear Fashion', 'Fashion', 28.00, 28.00, 28.00, 0.030),
    ('PYRO', 'PyroFuel Energy', 'Energy', 64.00, 64.00, 64.00, 0.034),
    ('REEF', 'ReefGuard Eco', 'Environment', 41.00, 41.00, 41.00, 0.025);

-- ----------------------------------------
-- INDEXES — Speed up common queries
-- ----------------------------------------
CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_stock ON stock_history(stock_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_lobby_players_lobby ON lobby_players(lobby_id);
CREATE INDEX IF NOT EXISTS idx_lobby_players_user ON lobby_players(user_id);
