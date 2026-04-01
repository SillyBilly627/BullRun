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
│   ├── 0002_watchlist.sql    # Watchlist table + tick tracking config
│   ├── 0003_lobby_stock_history.sql  # Lobby stock price history table
│   └── 0004_seed_cosmetics.sql      # Seed cosmetic items (battle pass + crate)
├── functions/
│   └── api/
│       └── [[path]].js       # ALL backend API routes (~2200 lines, single file)
└── public/
    ├── index.html            # Main HTML shell — SPA pages, modals, chat panel (~560 lines)
    ├── css/
    │   └── style.css         # All styles (~1340 lines) — dark terminal theme
    └── js/
        ├── api.js            # API module — fetch wrapper + all endpoint functions (~240 lines)
        ├── auth.js           # Auth module — login/signup/logout/session check (~130 lines)
        └── app.js            # Main app — Nav, Market, Portfolio, Leaderboard, Profile, Lobby, Chat modules (~2080 lines)
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

**Added in Phase 3:**

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `lobbies` | GET | Yes | List all open/active lobbies with creator info and player count |
| `lobbies/my-active` | GET | Yes | Get user's current active/waiting lobby (if any) |
| `lobbies/create` | POST | Yes | Create a new lobby with settings (time, players, tick speed, rewards) |
| `lobbies/:id` | GET | Yes | Get lobby details, players, and stocks (if active) |
| `lobbies/join` | POST | Yes | Join a waiting lobby (deducts entry fee for pool mode) |
| `lobbies/leave` | POST | Yes | Leave a waiting lobby (refunds entry fee, deletes lobby if creator) |
| `lobbies/start` | POST | Yes | Start match — creator only, needs 2+ players, generates stocks |
| `lobbies/tick` | GET | Yes | Poll for lobby price updates, rankings, timer. Auto-ends match on timeout. |
| `lobbies/buy` | POST | Yes | Buy shares of a lobby stock during active match |
| `lobbies/sell` | POST | Yes | Sell shares of a lobby stock during active match |
| `lobbies/portfolio` | GET | Yes | Get user's holdings within an active lobby match |
| `lobbies/stock-detail` | GET | Yes | Get lobby stock detail with full price history for charts |
| `lobbies/all-history` | GET | Yes | Batch fetch last 60 price points for all stocks in a lobby (for inline charts) |
| `lobbies/results/:id` | GET | Yes | Get finished match results: placements, rewards, XP, trade stats |
| `chat/messages` | GET | Yes | Get recent chat messages (supports `?since=` for incremental polling) |
| `chat/send` | POST | Yes | Send a chat message (200 char max, sanitized, checks chat_banned) |

**Added in Phase 4:**

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `admin/verify` | POST | Yes | Verify admin password, grants is_admin flag to user |
| `admin/users` | GET | Admin | List all users with stats and status |
| `admin/ban` | POST | Admin | Ban or unban a user (game-wide) |
| `admin/chat-ban` | POST | Admin | Ban or unban a user from chat only |
| `admin/set-money` | POST | Admin | Set a user's money to a specific amount |
| `admin/set-xp` | POST | Admin | Set a user's XP (auto-calculates level) |
| `admin/set-stock-price` | POST | Admin | Manually set a stock's current price |
| `admin/announcement` | POST | Admin | Push new announcement or clear all |
| `admin/toggle-chat` | POST | Admin | Enable or disable global chat |
| `admin/clear-chat` | POST | Admin | Delete all chat messages |
| `admin/force-close-lobby` | POST | Admin | Force-end a lobby (scores if active) |
| `admin/lobbies` | GET | Admin | List active/waiting lobbies |
| `admin/weekly-reset` | POST | Admin | Reset all money, portfolios, stock prices |
| `admin/toggle-admin` | POST | Admin | Grant or revoke admin from a user |
| `admin/give-cosmetic` | POST | Admin | Give a cosmetic item to any user |
| `admin/config` | GET | Admin | Get all game_config values |
| `cosmetics` | GET | Yes | List all cosmetics with ownership + equipped status |
| `cosmetics/equip` | POST | Yes | Equip or unequip an owned cosmetic |
| `cosmetics/check-unlocks` | POST | Yes | Auto-unlock battle pass items at current level |
| `cosmetics/crate-spin` | POST | Yes | Spin for a random crate item (placement-weighted) |

### Frontend Pages

- **Auth screen** — login/signup with validation and Enter key support
- **Home page** — welcome card, stats (net worth, cash, level, XP), quick action buttons, market movers (top 3 gainers + 3 losers), holdings summary
- **Market page** — searchable stock list with live price updates (10s polling), LIVE indicator badge, watchlist panel with mini sparkline charts, pin/unpin stocks with star icons
- **Stock detail modal** — instant-loading modal with stock info from cache, async chart loading, line/candlestick chart toggle, time-based range selector (30m/1h/6h/12h/24h), buy/sell forms, holdings info with P/L, educational tips
- **Portfolio page** — summary cards (cash, holdings value, net worth, P/L) + individual holdings list with per-stock P/L
- **Leaderboard page** — tabbed view (weekly/all-time/level), clickable rows to view profiles, highlights current user
- **Profile page** — avatar with initial, username, title, join date, stats grid, holdings list
- **Lobbies page** — full lobby system with 4 sub-views:
  - *Browser:* lists all open/active lobbies as clickable cards (name, creator, settings, player count, reward type). Create Lobby button opens modal.
  - *Create modal:* name, match length (5-60 min), max players (2-8), tick speed (3-10s), locked/open, reward type. Pool mode has entry fee input; Percentage mode shows fixed tier breakdown (25%/15%/7.5%).
  - *Waiting room:* live player list (3s polling), settings tags, host-only Start button, leave button. Auto-detects when match starts.
  - *Active match:* responsive grid of stock cards each with a **live inline chart** (line or candlestick, toggled via button in top bar). Charts store full OHLCV data, build in real-time, and load history on match start. Click a card to select it for trading (trade bar appears). Click expand icon (↗) for full-screen stock detail modal with bigger chart + buy/sell forms. Rankings + portfolio in 2-column bottom bar. Client-side 1-second countdown timer (synced from server every 2s). Flashes red at <30s. Tick + portfolio fetched in parallel via Promise.all. Overlap guard prevents stacking requests.
  - *Post-game results:* placement emoji, reward earned, XP earned, full results table with every player's final money, profit, trade count, reward, XP.
- **Global chat panel** — collapsible bottom-right panel visible on all pages after login, 4-second polling with incremental `?since=` parameter, unread badge when minimized, timestamps, user levels, send with Enter key, checks chat_enabled config
- **XP progress bar** — shown in nav bar next to level badge, shows current XP / XP needed for next level with gradient fill bar
- **Toast notifications** — success/error/info toasts with educational tips after trades
- **Announcement banner** — dismissable top banner for admin messages
- **Loading screen** — animated logo + progress bar on page load
- **Mobile responsive** — bottom nav bar on small screens, stacked layouts

**Added in Phase 4:**
- **Cosmetics page ("Locker")** — nav tab to view owned cosmetics, equip/unequip, filter by type (titles/backgrounds/card styles). Sub-tabs for "My Locker" and "Battle Pass" progression track.
- **Battle pass track** — horizontal scrolling progression showing all level-gated cosmetics, locked/unlocked state, rarity colors
- **Crate spin modal** — animated reel spin with rarity-weighted item selection, triggered after top-3 lobby placement
- **Admin panel page** — hidden page accessed by clicking the BullRun logo 5 times. Features: user management table (ban/unban, set money/XP, toggle admin), stock price manipulation, lobby force-close, announcement push/clear, chat toggle/clear, weekly reset button
- **Admin password modal** — password prompt for first-time admin access (default: BullRun2026!)
- **Cosmetic visuals** — equipped titles shown on profiles/leaderboard/chat, profile backgrounds applied as CSS gradients, leaderboard card styles with glow/border effects

### Database Tables Created

Users, stocks (35 seeded), portfolios, transactions, stock_history, lobbies, lobby_players, lobby_stocks, lobby_portfolios, lobby_transactions, lobby_stock_history, cosmetics, user_cosmetics, chat_messages, announcements, bans, game_config (with default settings), watchlist.

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

### Phase 3 — Competitive & Social ✅ COMPLETE

**Closed Stockmarketing (Lobby Mode):**
- [x] **Lobby creation** — player creates a lobby with settings: time limit (5-60 min), max players (2-8), lock toggle, tick speed (3-10 seconds), reward type (money pool OR percentage-based)
- [x] **Lobby waiting room** — shows all joined players with their levels and Open mode money. Creator can start the match. Auto-refreshes every 3 seconds to detect new players and match start.
- [x] **Lobby match gameplay** — 5-8 stocks with randomly generated company names per match (40 prefixes × 20 suffixes × 10 sectors). Faster ticks (3-10 sec). Each player starts with $10,000 match money. Separate portfolio/transactions from Open mode.
- [x] **In-match UI** — responsive grid of stock cards each with a live chart (line or candlestick, toggled via top bar button). Charts store OHLCV data, build in real-time from tick data, and load full history on match start via `lobbies/all-history` endpoint. Click card to trade, click expand icon for full detail modal. Rankings + portfolio in 2-column bottom bar. Client-side 1-second countdown timer (server-synced every 2s, flashes red at <30s). Tick + portfolio fetched in parallel. Overlap guard prevents stacking. Multi-tab chart sync fixed (uses price comparison, not ticked flag).
- [x] **Post-game score page** — final rankings with placement emoji, P/L per player, trade count, reward amount won, XP earned. Full results table.
- [x] **Reward system (money pool)** — all players pay entry fee on join. Pool distributed: 1st=50%, 2nd=30%, 3rd=20%. Rewards go to Open mode balance.
- [x] **Reward system (percentage)** — fixed tiers: 1st gets +25% of open mode balance, 2nd gets +15%, 3rd gets +7.5%. No custom percentage input — tiers are preset and shown in create modal.
- [x] **XP from lobbies** — 25 XP participation + 100/60/30 XP for 1st/2nd/3rd + 5 XP per $100 profit

**Global Chat:**
- [x] **Chat panel** — collapsible bottom-right panel visible on all pages after login, messages show username + level + timestamp, polls every 4 seconds with incremental `?since=` parameter, unread badge when minimized
- [x] **Admin controls** — backend supports: enable/disable chat via `game_config` table, `chat_banned` field on users prevents sending (admin panel UI deferred to Phase 4)
- [x] **Simple design** — one global room, no private messaging, 200 char max, XSS sanitized

**Leveling:**
- [x] **XP progress bar** — shown in nav bar with gradient fill, shows current XP / XP needed for next level
- [x] **Leveling milestones** — cosmetic items unlock at certain levels via Phase 4 battle pass system

**Architecture notes for Phase 3:**
- Lobby ticks use the same lazy evaluation pattern as Open mode: frontend polls, backend ticks if enough time has passed. KV key `lobby_tick_{id}` tracks last tick per lobby.
- Match auto-ends via the tick endpoint: if `timeRemaining <= 0`, `endLobbyMatch()` is called which calculates placements, distributes rewards, awards XP, and cleans up.
- Chat uses incremental polling: first load gets last 50 messages, subsequent polls use `?since=` timestamp to only fetch new messages.
- Lobby stocks use `lobby_stocks` table (separate from main `stocks`). Lobby stock history in `lobby_stock_history` table (migration 0003).
- Random company names: 40 prefixes × 20 suffixes with collision detection. Symbols are first 2 chars of prefix + first 2 chars of suffix, uppercased.
- Lobby price engine: more volatile than Open mode (volatility 0.03-0.08, 15% momentum chance at 3x multiplier, weaker mean reversion 0.3%, faster pressure decay ×0.6).
- **Multi-tab chart sync:** Charts append new data when `current_price !== lastRecordedClose`, NOT based on the `ticked` flag. This ensures all browser tabs update charts even when only one tab triggers the actual tick.
- **Performance optimizations:** tick + portfolio calls run in parallel via `Promise.all`. A `matchPolling` guard (try/finally) prevents overlapping requests. Client-side 1-second timer runs independently for smooth countdown; server syncs the authoritative time every 2 seconds.
- **Inline chart data:** stockHistories stores OHLCV objects `{open, high, low, close}` so both line and candlestick views work on the inline cards.

### Phase 4 — Polish & Extras ✅ CORE COMPLETE

**Cosmetics system:**
- [x] **Seed cosmetics into DB** — `migrations/0004_seed_cosmetics.sql` populates 20 battle pass items (levels 2-20) and 17 crate items across all rarities. Types: titles, backgrounds, card_styles.
- [x] **Equip cosmetics** — `cosmetics/equip` API route handles equip/unequip. Updates `equipped_title`, `equipped_background`, `equipped_card_style` on users table.
- [x] **Cosmetics page** — "Locker" nav tab with grid display, filter by type, equipped bar showing current loadout with remove buttons.
- [x] **Visual application** — titles display on profiles/leaderboard/chat with name lookup. Profile backgrounds applied via CSS classes. Leaderboard rows get card_style CSS classes (border glow, animations).

**Battle pass (tied to leveling):**
- [x] **Battle pass track** — horizontal scrolling progression UI. Items auto-unlock when player level >= `battlepass_level`. `cosmetics/check-unlocks` route called on Locker page load, grants any unlocked items and shows toast notifications.
- [x] **Leveling milestones** — toast notification fires for each newly unlocked item when visiting the Locker page.

**Crate spin (tied to lobby wins):**
- [x] **Crate spin UI** — animated reel with 20 items, CSS cubic-bezier easing, lands on winning item at position 15. Result reveal card with animation. Modal triggered by `Cosmetics.openCrate(placement)`.
- [x] **Rarity weights** — placement-based weighting. 1st place: legendary 10%, epic 20%, rare 25%, uncommon 25%, common 20%. Worse placements shift heavily toward common. Pool built by repeating items by weight count, random selection via `crypto.getRandomValues`.

**Admin panel:**
- [x] **Hidden access** — click the BullRun logo in the nav bar 5 times within 2 seconds. If already admin (`is_admin=1`), goes straight to admin page. Otherwise shows password modal. Password checked against `game_config.admin_password` (default 'BullRun2026!'). Successful verification sets `is_admin=1` on the user.
- [x] **Admin features:** user management table (search, ban/unban game, ban/unban chat, edit money/XP/admin status via `key:value` prompt), push/clear announcements, toggle/clear global chat, stock price manipulation grid, active lobby list with force-close, weekly reset button (double confirmation).
- [x] **Admin API routes** — all 16 admin routes verify `is_admin=1` on the authenticated user. The `admin/verify` route grants admin flag after password check.

**Other Phase 4 items:**
- [x] **Weekly reset** — admin panel button triggers reset: all user money to $10,000, clear portfolios, reset stock prices to base, clear stock history and transactions. Double confirmation prompt.
- [x] **Crate spin trigger from lobby results** — "Open Crate Spin!" button appears on post-match results for players who placed top 3, calls `Cosmetics.openCrate(placement)`.
- [ ] **Educational features** — tooltips throughout the app explaining stock concepts, glossary page with trading terminology, contextual hints, post-trade summaries explaining real-world equivalents.
- [ ] **Security review** — rate limiting, input validation audit, XSS prevention audit.
- [ ] **Native Swift wrapper apps** — macOS + iOS/iPadOS using WKWebView in SwiftUI (stretch goal, only if time allows).

**Architecture notes for Phase 4:**
- Admin access uses a two-step approach: first verify password via `admin/verify` (which sets `is_admin=1`), then all subsequent admin routes check `user.is_admin`. Once admin, no need to re-enter password.
- Secret admin entry: clicking the nav logo 5 times within 2 seconds triggers `App.handleLogoClick()` which either navigates to admin page (if already admin) or shows the password modal.
- Cosmetics use `css_value` field as the key: stored on user as `equipped_title`, `equipped_background`, `equipped_card_style`. Frontend maps `css_value` → display name via `Cosmetics.COSMETIC_TITLE_MAP` (built on load from all cosmetics data).
- Profile backgrounds are CSS classes prefixed with `profile-`: e.g. `bg-aurora` → `.profile-bg-aurora` in CSS. Applied as a class on `.profile-header`.
- Card styles are CSS classes applied directly: e.g. `card-neon` → `.card-neon` on leaderboard `.lb-row` elements. Some include animations (`neonPulse`, `plasmaPulse`).
- Battle pass auto-unlock: `cosmetics/check-unlocks` finds all `source='battlepass'` items where `battlepass_level <= user.level` and not in `user_cosmetics`, then inserts them. Called on Locker page load.
- Crate spin reel: backend generates 20-item array, places the won item at position 15. Frontend animates with CSS `transform: translateX()` and cubic-bezier easing over 4 seconds, then shows result card after 4.2s delay.
- Weekly reset is destructive: clears portfolios, transactions, stock_history tables. Resets all user money and stock prices. Double confirmation required in admin UI.

---

## How to Continue Development

1. Read this file to understand what exists
2. Pick up from any remaining uncompleted items (crate spin trigger, educational features, security review)
3. After making changes, commit with a descriptive message and update the checklist above
4. Keep the same patterns: all API routes in the single `[[path]].js` file, vanilla JS frontend modules, dark theme CSS variables
5. **The original master prompt/project brief is NOT available in new sessions** — all requirements are documented in this file. If something is ambiguous, ask Xavier.

### Key files to modify per phase:
- **New API routes:** Add to `functions/api/[[path]].js`
- **New pages/UI:** Add HTML to `public/index.html`, styles to `public/css/style.css`, logic to `public/js/app.js`
- **New database tables:** Create a new migration file `migrations/0005_*.sql` (next number in sequence)
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
2. Finds the exact path of that database file (by checking SQLite file headers, not file extensions — newer wrangler versions don't use `.sqlite` extensions)
3. Runs the migration SQL directly into it using `sqlite3`
4. Stops the server

This ensures the tables are always in the same database file the dev server uses. The `npm run db:migrate:local` command still exists but should NOT be used — always use `npm run setup` for local development.

### School network SSL certificate errors (RESOLVED)
**Problem:** School networks with web filtering intercept HTTPS traffic, causing `SELF_SIGNED_CERT_IN_CHAIN` errors when running `npm install`.

**Fix:** Run `npm config set strict-ssl false` before `npm install`. The `self-signed certificate` warnings that appear when starting the dev server are harmless — they're just wrangler trying to fetch metadata from Cloudflare, which isn't needed for local development.

### Multi-tab lobby chart freeze (RESOLVED)
**Problem:** When 2+ browser tabs poll the same lobby match, only one tab's request triggers the actual price tick (via KV last-tick check). The other tab received `ticked=false` and the old code only appended chart data when `ticked=true`, so that tab's charts froze while price text still updated.

**Fix:** Changed chart data logic to compare `current_price !== lastRecordedClose` instead of checking the `ticked` flag. Both tabs now see the new price and append the data point regardless of which triggered the tick.

### Lobby timer skipping seconds (RESOLVED)
**Problem:** The countdown timer in lobby matches only updated when the server poll response arrived (every ~2 seconds), making it visibly skip seconds.

**Fix:** Added a client-side `setInterval` that decrements `matchTimeLeft` every 1 second independently. The server response syncs the authoritative time every 2 seconds to prevent drift, but the display is always smooth.

### Lobby poll latency (RESOLVED)
**Problem:** Each poll cycle ran tick and portfolio API calls sequentially, doubling the wait time.

**Fix:** Both calls now run in parallel via `Promise.all([API.lobbyTick(), API.getLobbyPortfolio()])`. Added a `matchPolling` boolean guard with `try/finally` to prevent overlapping requests if a response is slow.

---

## Important Notes for AI Assistants

### DOCUMENTATION MANDATE
**After completing ANY feature, fix, or change — no matter how small — you MUST update this DEVELOPMENT.md file before committing.** Add the change to the relevant section (checklist, architecture notes, known issues, etc.) so the next session has complete context. Xavier cannot do this himself. If you skip this step, the next session will be working blind.

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
- New database migrations go in `migrations/` as numbered SQL files (e.g., `0004_*.sql`). The `setup.sh` script auto-runs all `migrations/*.sql` files in order.
- Toast notifications: `showToast(message, type, tip)` where type is 'success', 'error', or 'info'.

### Frontend Module Architecture (all in `app.js`)

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `App` | Core navigation, home page, announcements | `onLogin`, `navigate`, `updateNav`, `dismissAnnouncement` |
| `Market` | Open market stock list, watchlist, chart drawing | `load`, `filterStocks`, `openDetail`, `closeModal`, `executeTrade`, `togglePin`, `setChartType`, `setHistoryRange`, `drawChart`, `drawLineChart`, `drawCandlestickChart`, `startPolling`, `stopPolling` |
| `Portfolio` | Portfolio page with holdings + P/L | `load` |
| `Leaderboard` | Ranked player lists (weekly/alltime/level) | `show` |
| `Profile` | Player profile pages | `loadOwn`, `loadById` |
| `Lobby` | Full lobby system (browser, create, waiting, match, results) | `load`, `showCreate`, `hideCreate`, `doCreate`, `toggleRewardFields`, `joinOrView`, `leaveRoom`, `startMatch`, `selectStock`, `closeTrade`, `updateMatchTradeTotal`, `matchTrade`, `backToBrowser`, `toggleMatchChartType`, `openStockModal`, `closeStockModal`, `setChartType`, `updateModalTradeTotal`, `modalTrade` |
| `Chat` | Global chat panel | `init`, `toggle`, `send`, `stopPolling` |

**Global state variables:** `currentUser`, `allStocks`, `currentPage`, `pollInterval`, `watchlistIds`

**Global helper functions:** `showToast()`, `formatMoney()`, `formatPercent()`, `changeClass()`, `formatPnlColor()`

**Navigation:** `App.navigate(page)` hides all `.page` divs and shows `#page-{page}`. The page name triggers a data load via switch-case (e.g., `'lobbies'` calls `Lobby.load()`).

### Database Schema Quick Reference

**Users table key fields:** `id`, `username`, `password_hash`, `password_salt`, `money` (default 10000), `xp` (default 0), `level` (default 1), `highest_money`, `is_admin` (default 0), `is_banned` (default 0), `chat_banned` (default 0), `equipped_title`, `equipped_background`, `equipped_card_style`, `last_active`, `created_at`

**Lobbies table:** `id`, `creator_id`, `name`, `status` ('waiting'/'active'/'finished'), `max_players`, `time_limit_minutes`, `tick_speed_seconds`, `is_locked`, `reward_type` ('pool'/'percentage'), `pool_entry_fee`, `reward_percentage`, `started_at`, `finished_at`, `created_at`

**Lobby players:** `lobby_id`, `user_id`, `money` (match money, default 10000), `final_money`, `placement`, `reward_earned`, `xp_earned`, `joined_at`

**Cosmetics table (exists, not yet populated):** `id`, `name`, `type` ('title'/'background'/'card_style'/'effect'), `rarity` ('common'/'uncommon'/'rare'/'epic'/'legendary'), `description`, `css_value`, `source` ('battlepass'/'crate'), `battlepass_level`

**User cosmetics (exists, not yet populated):** `user_id`, `cosmetic_id`, `equipped` (0/1), `obtained_at`

**Game config (key-value):** `chat_enabled` (default '1'), `admin_password` (default 'BullRun2026!')

### Hosting Constraints
- Must stay on Cloudflare free tier ($5/month max if absolutely needed).
- The game may run on a school network — only ports 80 and 443 are open.
- School network has SSL interception — `npm config set strict-ssl false` is needed.
- No Durable Objects (paid tier) — use polling instead of WebSockets for real-time updates.

### GitHub Workflow
- Repo: `https://github.com/SillyBilly627/BullRun`
- Xavier will provide a GitHub Personal Access Token (fine-grained, with Contents read+write permission on the BullRun repo) for pushing.
- Push with: `git remote set-url origin https://SillyBilly627:TOKEN@github.com/SillyBilly627/BullRun.git`
- Always commit with descriptive messages explaining what changed and why.
- **Always update DEVELOPMENT.md after completing features** (see documentation mandate above).
- The `setup.sh` file gets modified locally by `chmod +x` — Xavier must run `git checkout -- setup.sh` before `git pull`.

### Lobby Tick System (Phase 3 — IMPLEMENTED)
- Lobby matches use their own tick system separate from the Open market's lazy ticks.
- Open market ticks every 30 seconds. Lobby ticks are faster (3-10 seconds configurable per lobby).
- Uses the same lazy evaluation pattern: frontend polls every 2 seconds, backend ticks if enough time has passed (checked via KV key `lobby_tick_{id}`).
- Lobby stocks use `lobby_stocks` table (separate from main `stocks` table). Price history in `lobby_stock_history` table.
- Random company name generation: 40 prefixes × 20 suffixes, with collision detection for both names and symbols within a lobby.
- Lobby price engine differences from Open mode: higher volatility range (0.03-0.08), stronger player pressure effect (×0.002 vs ×0.001), weaker mean reversion (0.3% vs 0.5%), faster pressure decay (×0.6 vs ×0.7), 15% momentum chance at 3x multiplier (vs 10% at 2.5x in Open mode).
- Match auto-ends: lobby tick endpoint checks if `timeRemaining <= 0` and calls `endLobbyMatch()` to calculate placements, distribute rewards, award XP, and clean up the KV tick key.
- **Frontend chart sync:** stockHistories stores OHLCV objects `{open, high, low, close}`. New data is appended when `current_price !== lastRecordedClose` (not based on `ticked` flag). This ensures multi-tab support works correctly.
- **Polling architecture:** `refreshMatch()` uses `Promise.all` for parallel tick+portfolio fetch. A `matchPolling` guard (try/finally) prevents overlapping requests. Client-side `setInterval` counts down every 1 second independently; server syncs authoritative time every 2 seconds.

### Reward System Details
**Pool mode:** All players pay an entry fee (configurable, $0-$5000). Total pool = entry_fee × player_count. Distributed: 1st=50%, 2nd=30%, 3rd=20%.

**Percentage mode:** Fixed tiers (no custom input). 1st place earns +25% of their Open mode cash balance. 2nd earns +15%. 3rd earns +7.5%. These are hardcoded in `endLobbyMatch()` in `[[path]].js`.

**XP from lobbies:** 25 XP for participation + 100 XP for 1st / 60 XP for 2nd / 30 XP for 3rd + 5 XP per $100 profit. All XP/level updates happen in `endLobbyMatch()`.
