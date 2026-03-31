# BullRun — Development Status & Context

> **This file exists so that if development continues in a new AI chat session, the assistant can read this and know exactly where the project stands, what's been built, what's remaining, and how everything fits together.**

---

## Project Summary

**BullRun** is a multiplayer stock market simulation game built as a Year 12 school project. Players trade simulated stocks, compete on leaderboards, earn XP, and unlock cosmetics. The game is designed to be semi-educational, teaching players the basics of real stock trading.

- **Developer:** Xavier (Year 12, Western Australia)
- **Deadline:** 1 month from project start
- **Hosting:** Cloudflare (Pages + Functions + D1 + KV) — free tier
- **Assessment criteria:** Working product + design quality
- **Expected players:** 10–30 on the school network

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Vanilla HTML, CSS, JavaScript | No frameworks. Single-page app with client-side routing. |
| Backend | Cloudflare Pages Functions | Single catch-all handler at `functions/api/[[path]].js` |
| Database | Cloudflare D1 (SQLite) | Schema in `migrations/0001_initial.sql` |
| Sessions | Cloudflare KV | Bearer tokens stored with 7-day TTL |
| Password hashing | PBKDF2 (Web Crypto API) | 100,000 iterations, SHA-256, unique salt per user |
| Fonts | Outfit (display) + JetBrains Mono (numbers) | Loaded from Google Fonts |
| Theme | Dark financial terminal | Green (#22c55e) for gains, red (#ef4444) for losses |

---

## Project Structure

```
bullrun/
├── .gitignore
├── setup.sh                  # Local dev setup script (use npm run setup)
├── package.json              # Scripts: setup, dev, deploy, db:migrate:local, db:migrate:remote
├── wrangler.toml             # Cloudflare config (D1 + KV bindings)
├── README.md                 # User-facing setup instructions
├── DEVELOPMENT.md            # THIS FILE — project status for AI context
├── migrations/
│   ├── 0001_initial.sql      # Full DB schema + seed data (35 stocks)
│   └── 0002_watchlist.sql    # Watchlist table + tick tracking config
├── functions/
│   └── api/
│       └── [[path]].js       # ALL backend API routes (single file)
└── public/
    ├── index.html            # Main HTML shell (SPA)
    ├── css/
    │   └── style.css         # All styles (~600 lines)
    └── js/
        ├── api.js            # Fetch wrapper, all API endpoint functions
        ├── auth.js           # Login/signup/logout/session check
        └── app.js            # Navigation, pages, Market, Portfolio, Leaderboard, Profile modules
```

---

## What's Been Built (Phase 1) ✅ TESTED & WORKING

Phase 1 has been tested and confirmed working locally:
- ✅ Account creation and login
- ✅ Market browsing (smooth and responsive)
- ✅ Buying and selling stocks
- ✅ Portfolio tracking with P/L
- ✅ Leaderboards (all 3 types)
- ✅ Player profiles

### Backend API Routes (all in `functions/api/[[path]].js`)

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `auth/signup` | POST | No | Create account (validates username + password rules) |
| `auth/login` | POST | No | Login (returns bearer token) |
| `auth/logout` | POST | Yes | Invalidate session |
| `auth/me` | GET | Yes | Get current user data |
| `stocks` | GET | Yes | List all active stocks |
| `stocks/:id` | GET | Yes | Stock detail + price history + user's holding. Accepts `?minutes=N` (5-1440, default 60) for time-based history range |
| `stocks/buy` | POST | Yes | Buy shares (deducts money, updates portfolio, adds buy pressure) |
| `stocks/sell` | POST | Yes | Sell shares (adds money, calculates P/L, awards XP if profitable) |
| `portfolio` | GET | Yes | User's holdings with P/L calculations |
| `transactions` | GET | Yes | Trade history (last 50) |
| `leaderboards/weekly` | GET | Yes | Top 50 by current money |
| `leaderboards/alltime` | GET | Yes | Top 50 by highest_money ever |
| `leaderboards/level` | GET | Yes | Top 50 by XP |
| `profile/:id` | GET | Yes | Player profile + their holdings |
| `announcements` | GET | No | Active announcements |
| `config/chat-status` | GET | No | Whether global chat is enabled |

**Added in Phase 2:**

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `stocks/tick` | GET | Yes | Poll for price updates — triggers a tick if 30+ seconds have passed, returns all current prices |
| `watchlist` | GET | Yes | Get user's pinned stocks with mini sparkline data (last 20 close prices per stock) |
| `watchlist/toggle` | POST | Yes | Add or remove a stock from watchlist (auto-detects) |

### Frontend Pages

- **Auth screen** — login/signup with validation and Enter key support
- **Home page** — welcome card, stats (net worth, cash, level, XP), quick action buttons, market movers (top 3 gainers + 3 losers), holdings summary
- **Market page** — searchable stock list with live price updates (10s polling), LIVE indicator badge, watchlist panel with mini sparkline charts, pin/unpin stocks with star icons
- **Stock detail modal** — instant-loading modal with stock info from cache, async chart loading, line/candlestick chart toggle, time-based range selector (30m/1h/6h/12h/24h), buy/sell forms, holdings info with P/L, educational tips
- **Portfolio page** — summary cards (cash, holdings value, net worth, P/L) + individual holdings list with per-stock P/L
- **Leaderboard page** — tabbed view (weekly/all-time/level), clickable rows to view profiles, highlights current user
- **Profile page** — avatar with initial, username, title, join date, stats grid, holdings list
- **Lobbies page** — placeholder "Coming Soon"
- **Toast notifications** — success/error/info toasts with educational tips after trades
- **Announcement banner** — dismissable top banner for admin messages
- **Loading screen** — animated logo + progress bar on page load
- **Mobile responsive** — bottom nav bar on small screens, stacked layouts

### Database Tables Created

Users, stocks (35 seeded), portfolios, transactions, stock_history, lobbies, lobby_players, lobby_stocks, lobby_portfolios, lobby_transactions, cosmetics, user_cosmetics, chat_messages, announcements, bans, game_config (with default settings).

### Key Design Decisions

- **Password rules:** Min 4 chars, at least 1 letter, 1 number, 1 capital
- **XP formula:** 10 base + 5 per $100 profit on each profitable sell
- **Level formula:** XP needed for level N = 50 × (N-1) × N / 2
- **Buy pressure:** When players buy, pressure = (shares × price) / 10000 is added to the stock's buy_pressure field (negative for sells). Pressure decays by 30% each tick (multiplied by 0.7).
- **Price engine:** Random walk with `crypto.getRandomValues()`. Each tick: random change scaled by volatility + buy pressure effect (×0.001) + mean reversion toward base_price (0.5% pull per tick). 10% chance of momentum spike (2.5x move). Prices clamped between $0.50 and 100× base price. Ticks every 30 seconds via lazy evaluation.
- **Starting money:** $10,000 (resets weekly)
- **Session TTL:** 7 days
- **Chart data:** OHLCV candles recorded each tick. Wicks extend 30% beyond the body for visual variation. History queryable by time range (5 min to 24 hours).

---

## Remaining Phases

### Phase 2 — Core Gameplay ✅ COMPLETE
- [x] **Stock price engine** — random walk algorithm using `crypto.getRandomValues()`, incorporates buy_pressure from player activity, mean reversion toward base_price, occasional momentum spikes (10% chance of 2.5x moves)
- [x] **Stock history recording** — saves OHLCV candles to stock_history table each tick
- [x] **Candlestick chart toggle** — switch between line chart and candlestick chart in the stock detail modal
- [x] **Stock pinning/watchlist** — pin/unpin stocks with star icon, watchlist panel at top of market page, mini sparkline charts on each pinned stock showing last 20 price ticks
- [x] **Auto-refresh** — polls `stocks/tick` endpoint every 10 seconds, updates prices in-place with flash animations
- [x] **Lazy tick evaluation** — prices auto-update when any player fetches stock data (every 30 seconds)
- [x] **Chart history range** — stock detail modal has time-based range selector (30m, 1h, 6h, 12h, 24h), backend filters by timestamp with `?minutes=` parameter (clamped 5-1440)
- [x] **Instant modal loading** — stock detail modal opens instantly with cached price data, chart and holdings load asynchronously in the background
- [x] **Educational tips** — 12 rotating stock market tips shown contextually
- [ ] **Weekly reset** — scheduled job to reset all player money to $10,000 and stock prices to base (needs Cloudflare Cron Trigger or manual admin action)

### Phase 3 — Competitive & Social (Priority: HIGH — build next)

**Closed Stockmarketing (Lobby Mode):**
- [ ] **Lobby creation** — player creates a lobby with settings: time limit (10 min to 1 hour), max players, lock toggle (prevent randoms joining), tick speed (3-10 seconds), reward type (money pool OR percentage-based)
- [ ] **Lobby waiting room** — shows all joined players with their levels, Open mode money, and leaderboard positions. Creator can start the match.
- [ ] **Lobby match gameplay** — 5-8 stocks with randomly generated company names per match. Faster ticks (3-10 sec based on settings). Each player starts with $10,000 match money. Separate portfolio/transactions from Open mode.
- [ ] **In-match UI** — small leaderboard showing live player rankings, countdown timer, portfolio view, buy/sell interface
- [ ] **Post-game score page** — final rankings, shares bought/sold per player, profit/loss, times sold under buy price, reward amount won, XP earned
- [ ] **Reward system (money pool)** — all players put in a set entry fee on join. Winners take portions of the pool. Rewards go to Open mode balance.
- [ ] **Reward system (percentage)** — 1st/2nd/3rd win a percentage of their existing Open mode balance
- [ ] **XP from lobbies** — XP for participation + bonus XP based on placement

**Global Chat:**
- [ ] **Chat panel** — collapsible sidebar or bottom panel visible on all pages, messages show username + level
- [ ] **Admin controls** — admin can enable/disable chat globally, clear history, ban individual players from chat (without banning from game)
- [ ] **Simple design** — one global room, no private messaging

**Leveling:**
- [ ] **Leveling milestones** — unlock cosmetic items at certain levels (ties into Phase 4 battle pass)

**NOTE:** Database tables for lobbies and chat already exist in `migrations/0001_initial.sql`:
- `lobbies` — lobby settings (status, max_players, time_limit, tick_speed, is_locked, reward_type, pool_entry_fee, reward_percentage)
- `lobby_players` — players in each lobby (money, final_money, placement, reward_earned, xp_earned)
- `lobby_stocks` — stocks generated per match (symbol, name, price, volatility, buy_pressure)
- `lobby_portfolios` — holdings within a match
- `lobby_transactions` — trade log for matches
- `chat_messages` — global chat (user_id, message, created_at)
- `game_config` has `chat_enabled` key (default '1')

### Phase 4 — Polish & Extras (Priority: LOW)
- [ ] **Cosmetics system** — titles, profile backgrounds, leaderboard card styles, visual effects. Items stored in `cosmetics` table, ownership in `user_cosmetics` table. Users equip via `equipped_title`, `equipped_background`, `equipped_card_style` fields on users table.
- [ ] **Battle pass** — progression track tied to leveling. As players level up, they unlock cosmetic items from a predefined list. Uses `battlepass_level` field in `cosmetics` table.
- [ ] **Crate spin** — after winning Closed mode matches, players get a crate spin from a separate pool of cosmetics NOT in the battle pass. Higher placement = better chances at rare items. Uses `source` field ('battlepass' vs 'crate') in `cosmetics` table. Rarities: common, uncommon, rare, epic, legendary.
- [ ] **Cosmetics page** — dedicated page for previewing and equipping cosmetics before applying them
- [ ] **Admin panel** — hidden/secret button + admin password (stored in `game_config` table, default 'BullRun2026!'). Features: view all connected players and IPs, ban accounts/IPs (uses `bans` table), push announcements, manipulate stock prices/player levels/money/cosmetics, view and force-close active lobbies, enable/disable global chat, clear chat history, ban players from chat individually
- [ ] **Educational features** — tooltips throughout the app explaining stock concepts, glossary page with trading terminology, contextual hints (e.g., "In real life, this is called a market order"), post-trade summaries explaining real-world equivalents
- [ ] **Security review** — rate limiting, input validation audit, XSS prevention audit
- [ ] **Native Swift wrapper apps** — macOS + iOS/iPadOS using WKWebView in SwiftUI (stretch goal, only if time allows)

---

## How to Continue Development

1. Read this file to understand what exists
2. Pick up from the next uncompleted phase (Phase 3)
3. After making changes, commit with a descriptive message and update the checklist above
4. Keep the same patterns: all API routes in the single `[[path]].js` file, vanilla JS frontend modules, dark theme CSS variables
5. **The original master prompt/project brief is NOT available in new sessions** — all requirements are documented in this file. If something is ambiguous, ask Xavier.

### Key files to modify per phase:
- **New API routes:** Add to `functions/api/[[path]].js`
- **New pages/UI:** Add HTML to `public/index.html`, styles to `public/css/style.css`, logic to `public/js/app.js`
- **New database tables:** Create a new migration file `migrations/0003_*.sql` (next number in sequence)
- **Configuration:** `wrangler.toml` for Cloudflare bindings

### Local development:
```bash
npm run setup        # First time only — creates DB and runs migrations
npm run dev          # Start local server on port 8788
```

### If you need to reset the local database:
```bash
rm -rf .wrangler     # Delete the old database
npm run setup        # Re-run setup from scratch
```

### Pulling updates from GitHub:
```bash
git checkout -- setup.sh    # Required: setup.sh gets modified by chmod, must reset before pulling
git pull origin main        # Pull latest code
rm -rf .wrangler            # Only if database schema changed (new migration files)
npm run setup               # Only if database was reset above
npm run dev                 # Start the server
```
Note: If only frontend code changed (JS/CSS/HTML), you can just `git pull` and restart `npm run dev` without resetting the database.

### Deployment:
```bash
npm run deploy              # Deploy to Cloudflare Pages
npm run db:migrate:remote   # Run migrations on production
```

---

## Known Issues & Fixes

### Local database path mismatch (RESOLVED)
**Problem:** `wrangler d1 execute --local` and `wrangler pages dev` store the local D1 database in different paths inside `.wrangler/`. This caused "no such table" errors because the migration created tables in one database file while the dev server read from a different one.

**Fix:** Created `setup.sh` (run via `npm run setup`) which:
1. Starts the dev server briefly to let it create the database file
2. Finds the exact path of that database file
3. Runs the migration SQL directly into it using `sqlite3`
4. Stops the server

This ensures the tables are always in the same database file the dev server uses. The `npm run db:migrate:local` command still exists but should NOT be used — always use `npm run setup` for local development.

### School network SSL certificate errors
**Problem:** School networks with web filtering intercept HTTPS traffic, causing `SELF_SIGNED_CERT_IN_CHAIN` errors when running `npm install`.

**Fix:** Run `npm config set strict-ssl false` before `npm install`. The `self-signed certificate` warnings that appear when starting the dev server are harmless — they're just wrangler trying to fetch metadata from Cloudflare, which isn't needed for local development.

---

## Important Notes for AI Assistants

### About Xavier
- Xavier is NOT a coder. Write all code yourself. Give complete files, not snippets.
- Keep code simple with comments. No complex frameworks.
- Build incrementally — make it work, then layer on features.
- Give him exact terminal commands to run. Don't assume he knows git/npm.
- When something breaks, ask for terminal output or screenshots to debug.

### Code Patterns (must follow for consistency)
- The frontend is a single-page app — all pages are divs inside `index.html` that get shown/hidden via `App.navigate()`.
- The backend is a single catch-all function — route matching is done with string comparison inside the `onRequest` handler in `functions/api/[[path]].js`.
- Use CSS variables defined in `:root` for all colors/sizing.
- The app uses vanilla JS module pattern: `const ModuleName = (() => { ... return { publicMethods }; })();`
- All API calls go through the `API` module in `api.js` which adds Bearer token auth headers.
- New database migrations go in `migrations/` as numbered SQL files (e.g., `0003_*.sql`). The `setup.sh` script auto-runs all `migrations/*.sql` files in order.
- Toast notifications: `showToast(message, type, tip)` where type is 'success', 'error', or 'info'.

### Hosting Constraints
- Must stay on Cloudflare free tier ($5/month max if absolutely needed).
- The game may run on a school network — only ports 80 and 443 are open.
- School network has SSL interception — `npm config set strict-ssl false` is needed.
- No Durable Objects (paid tier) — use polling instead of WebSockets for real-time updates.

### GitHub Workflow
- Repo: `https://github.com/SillyBilly627/BullRun`
- Xavier will need to provide a GitHub Personal Access Token (fine-grained, with Contents read+write permission on the BullRun repo) for pushing.
- Push with: `git remote set-url origin https://SillyBilly627:TOKEN@github.com/SillyBilly627/BullRun.git`
- Always commit with descriptive messages explaining what changed and why.
- Always update DEVELOPMENT.md after completing features.
- The `setup.sh` file gets modified locally by `chmod +x` — Xavier must run `git checkout -- setup.sh` before `git pull`.

### Lobby Tick System (for Phase 3)
- Lobby matches need their own tick system separate from the Open market's lazy ticks.
- Open market ticks every 30 seconds. Lobby ticks are faster (3-10 seconds configurable).
- Since we can't use Durable Objects, lobby ticks should use the same lazy evaluation pattern: frontend polls for updates, backend ticks if enough time has passed.
- Lobby stocks use `lobby_stocks` table (separate from main `stocks` table).
- Random company name generation needed for lobby stocks (e.g., "NovaCrest Holdings", "BlueArc Systems").
