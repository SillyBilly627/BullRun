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
├── package.json              # Scripts: dev, deploy, db:migrate:local, db:migrate:remote
├── wrangler.toml             # Cloudflare config (D1 + KV bindings)
├── README.md                 # User-facing setup instructions
├── DEVELOPMENT.md            # THIS FILE — project status for AI context
├── migrations/
│   └── 0001_initial.sql      # Full DB schema + seed data (35 stocks)
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
| `stocks/:id` | GET | Yes | Stock detail + price history + user's holding |
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

### Frontend Pages

- **Auth screen** — login/signup with validation and Enter key support
- **Home page** — welcome card, stats (net worth, cash, level, XP), quick action buttons, market movers, holdings summary
- **Market page** — searchable stock list, click to open detail modal with buy/sell forms and line chart
- **Portfolio page** — summary cards (cash, holdings value, net worth, P/L) + individual holdings list
- **Leaderboard page** — tabbed view (weekly/all-time/level), clickable rows to view profiles
- **Profile page** — avatar, username, stats grid, holdings list
- **Lobbies page** — placeholder "Coming Soon"
- **Toast notifications** — success/error/info toasts with educational tips
- **Announcement banner** — dismissable top banner
- **Loading screen** — animated logo + progress bar on page load

### Database Tables Created

Users, stocks (35 seeded), portfolios, transactions, stock_history, lobbies, lobby_players, lobby_stocks, lobby_portfolios, lobby_transactions, cosmetics, user_cosmetics, chat_messages, announcements, bans, game_config (with default settings).

### Key Design Decisions

- **Password rules:** Min 4 chars, at least 1 letter, 1 number, 1 capital
- **XP formula:** 10 base + 5 per $100 profit on each profitable sell
- **Level formula:** XP needed for level N = 50 × (N-1) × N / 2
- **Buy pressure:** When players buy, pressure = (shares × price) / 10000 is added to the stock's buy_pressure field (negative for sells). This is used by the price engine (Phase 2) to bias price movement.
- **Starting money:** $10,000 (resets weekly)
- **Session TTL:** 7 days

---

## What's NOT Built Yet (Remaining Phases)

### Phase 2 — Core Gameplay (Priority: HIGH)
- [ ] **Stock price engine** — random walk algorithm that runs on a schedule (every 30-60 seconds), uses `crypto.getRandomValues()` for randomness, incorporates buy_pressure from player activity
- [ ] **Stock history recording** — save OHLCV candles to stock_history table each tick
- [ ] **Candlestick chart toggle** — switch between line chart and proper candlestick chart in the stock detail modal
- [ ] **Stock pinning/watchlist** — ability to pin stocks to a separate watchlist panel
- [ ] **Auto-refresh** — poll for updated stock prices periodically on the frontend (every 10-30 seconds)
- [ ] **Weekly reset** — scheduled job to reset all player money to $10,000 and stock prices to base

### Phase 3 — Competitive & Social (Priority: MEDIUM)
- [ ] **Closed Stockmarketing lobbies** — create/join lobbies with configurable settings (time limit, tick speed, player count, lock, reward type)
- [ ] **Lobby waiting room** — shows players, levels, money before match starts
- [ ] **Lobby match gameplay** — separate stock set (5-8 random names), faster ticks, in-match leaderboard, countdown timer
- [ ] **Post-game score page** — rankings, stats, rewards, XP earned
- [ ] **Reward systems** — money pool and percentage-based rewards
- [ ] **Global chat** — collapsible chat panel, messages show username + level, admin can enable/disable/clear/ban
- [ ] **Leveling milestones** — unlock cosmetics at certain levels

### Phase 4 — Polish & Extras (Priority: LOW)
- [ ] **Cosmetics system** — titles, profile backgrounds, leaderboard card styles
- [ ] **Battle pass** — progression track tied to leveling, unlocks cosmetics
- [ ] **Crate spin** — post-lobby-win reward spin for cosmetics not in battle pass
- [ ] **Cosmetics page** — preview and equip cosmetics
- [ ] **Admin panel** — hidden button + admin password, view/ban players/IPs, manipulate stocks/levels/money/cosmetics, manage announcements, toggle chat, force-close lobbies
- [ ] **Public announcements** — admin creates, players see as non-obtrusive banners (backend exists, admin UI doesn't)
- [ ] **Educational features** — tooltips throughout the app, glossary page, contextual hints, post-trade summaries (basic tips exist, needs expansion)
- [ ] **Security review** — rate limiting, input validation audit, XSS prevention audit
- [ ] **Native Swift wrapper apps** — macOS + iOS/iPadOS (stretch goal, only if time allows)

---

## How to Continue Development

1. Read this file to understand what exists
2. Read the master prompt (the original project brief) in the conversation history for full requirements
3. Pick up from the next uncompleted phase
4. After making changes, commit with a descriptive message and update the checklist above
5. Keep the same patterns: all API routes in the single `[[path]].js` file, vanilla JS frontend modules, dark theme CSS variables

### Key files to modify per phase:
- **New API routes:** Add to `functions/api/[[path]].js`
- **New pages/UI:** Add HTML to `public/index.html`, styles to `public/css/style.css`, logic to `public/js/app.js`
- **New database tables:** Create a new migration file `migrations/0002_*.sql`
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

- Xavier is NOT a coder. Write all code yourself. Give complete files, not snippets.
- Keep code simple with comments. No complex frameworks.
- Build incrementally — make it work, then layer on features.
- The game may run on a school network — security matters.
- Must stay on Cloudflare free tier ($5/month max if absolutely needed).
- The frontend is a single-page app — all pages are divs inside `index.html` that get shown/hidden.
- The backend is a single catch-all function — route matching is done with string comparison inside the `onRequest` handler.
- Use CSS variables defined in `:root` for all colors/sizing.
- The app uses vanilla JS module pattern: `const ModuleName = (() => { ... return { publicMethods }; })();`
