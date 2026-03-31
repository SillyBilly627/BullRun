-- ============================================================
-- BullRun — Migration 0002: Watchlist + Tick Tracking
-- ============================================================

-- User watchlist (pinned stocks)
CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stock_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (stock_id) REFERENCES stocks(id),
    UNIQUE(user_id, stock_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);

-- Track the last time stock prices were ticked
INSERT OR IGNORE INTO game_config (key, value) VALUES
    ('last_tick_time', '2000-01-01T00:00:00Z');
