-- ============================================================
-- BullRun — Migration 0003: Lobby Stock History
-- ============================================================
-- Adds price history tracking for lobby match stocks
-- so we can show mini charts during matches.
-- ============================================================

CREATE TABLE IF NOT EXISTS lobby_stock_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lobby_id INTEGER NOT NULL,
    stock_id INTEGER NOT NULL,       -- references lobby_stocks.id
    price REAL NOT NULL,
    open_price REAL NOT NULL,
    high_price REAL NOT NULL,
    low_price REAL NOT NULL,
    close_price REAL NOT NULL,
    timestamp TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (lobby_id) REFERENCES lobbies(id),
    FOREIGN KEY (stock_id) REFERENCES lobby_stocks(id)
);

CREATE INDEX IF NOT EXISTS idx_lobby_stock_history ON lobby_stock_history(lobby_id, stock_id, timestamp);
