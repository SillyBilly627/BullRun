# BullRun — Stock Market Simulation Game

A multiplayer stock market simulator built as a school project. Players trade simulated stocks with live-updating prices, compete in lobbies, climb leaderboards, unlock cosmetics, and learn the basics of real trading — all with fake money.

---

## Features

**Trading**
- 70 stocks to trade (32 real companies like Apple, Tesla, NVIDIA + 38 fictional ones like Void Dynamics, FangByte Security)
- Prices update every 30 seconds using a random walk algorithm — player buying and selling affects prices
- Candlestick and line charts with time-based ranges (30m, 1h, 6h, 12h, 24h)
- Watchlist with large chart cards and line/candlestick toggle
- Portfolio tracking with per-stock profit/loss

**Competitive**
- Lobby matches — create or join timed matches with 5-8 randomly generated stocks, faster tick speeds, and cash/percentage rewards for top 3
- Three leaderboards — weekly money, all-time best, and XP level rankings
- Player profiles with stats and holdings

**Progression**
- XP and leveling from profitable trades and lobby matches
- Battle pass with 58 cosmetic rewards spread across levels 2-250
- Crate spins after top-3 lobby finishes with rarity-weighted drops (27 crate items)
- Cosmetics: titles (shown in chat/leaderboard), profile backgrounds (gradient effects), leaderboard card styles (animated borders and glows)

**Social**
- Global chat with real-time polling
- Announcement banners from admins
- Educational tips about real stock trading concepts

**Admin Panel**
- Hidden access (click the logo 5 times, password: `BullRun2026!`)
- Ban/unban players, manipulate money/XP/stock prices, push announcements
- Toggle/clear chat, force-close lobbies, trigger weekly resets
- Give cosmetics to any player

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML, CSS, JavaScript (no frameworks) |
| Backend | Cloudflare Pages Functions (serverless) |
| Database | Cloudflare D1 (SQLite) |
| Sessions | Cloudflare KV (key-value store) |
| Passwords | PBKDF2 hashing (100,000 iterations, unique salt per user) |
| Hosting | Cloudflare free tier |

---

## Local Testing (Step by Step)

### What You Need

- **Node.js** (LTS version) — download from [nodejs.org](https://nodejs.org)
- **Git** — to clone the repo

### Step 1: Clone and install

```bash
git clone https://github.com/SillyBilly627/BullRun.git
cd BullRun
npm install
```

> **School network?** If you get SSL errors during install, run this first:
> ```bash
> npm config set strict-ssl false
> ```

### Step 2: Set up the local database

```bash
npm run setup
```

This automatically creates the SQLite database and runs all migration files (tables, stocks, cosmetics). It takes about 10 seconds.

> **What this does:** The setup script starts the dev server briefly to create the database file, finds its exact path, runs all SQL migrations into it, then stops the server. This avoids a known path mismatch issue between Wrangler's migration tool and dev server.

### Step 3: Start the game

```bash
npm run dev
```

Open your browser to **http://localhost:8788** — you'll see the login screen. Create an account and start trading!

### Resetting your local database

If anything goes wrong or you want a fresh start:

```bash
rm -rf .wrangler
npm run setup
npm run dev
```

### Pulling updates from GitHub

```bash
git checkout -- setup.sh
git pull origin main
```

If new migration files were added (check the commit messages), reset the database:

```bash
rm -rf .wrangler
npm run setup
```

Then start the server with `npm run dev`.

---

## Deploying to Cloudflare (Free Tier)

This makes BullRun accessible over the internet at a URL like `bullrun.pages.dev`. Everything runs on Cloudflare's free tier.

### Step 1: Create a Cloudflare account

Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) — it's free.

### Step 2: Install and log in to Wrangler

```bash
npm install -g wrangler
wrangler login
```

This opens your browser — click "Allow" to authorise.

### Step 3: Create the database

```bash
wrangler d1 create bullrun-db
```

This outputs something like:

```
✅ Successfully created DB 'bullrun-db'
database_id = "abc123-def456-..."
```

**Copy that `database_id` value.** Open `wrangler.toml` and replace `YOUR_D1_DATABASE_ID_HERE` with it:

```toml
[[d1_databases]]
binding = "DB"
database_name = "bullrun-db"
database_id = "abc123-def456-..."   # ← paste your real ID here
```

### Step 4: Create the session store

```bash
wrangler kv namespace create SESSION_STORE
```

This outputs something like:

```
✅ Successfully created KV namespace
id = "xyz789..."
```

**Copy that `id` value.** Open `wrangler.toml` and replace `YOUR_KV_NAMESPACE_ID_HERE` with it:

```toml
[[kv_namespaces]]
binding = "SESSION_STORE"
id = "xyz789..."   # ← paste your real ID here
```

### Step 5: Run database migrations (production)

Run each migration file to set up the production database:

```bash
npx wrangler d1 execute bullrun-db --remote --file=./migrations/0001_initial.sql
npx wrangler d1 execute bullrun-db --remote --file=./migrations/0002_watchlist.sql
npx wrangler d1 execute bullrun-db --remote --file=./migrations/0003_lobby_stock_history.sql
npx wrangler d1 execute bullrun-db --remote --file=./migrations/0004_seed_cosmetics.sql
npx wrangler d1 execute bullrun-db --remote --file=./migrations/0005_extended_content.sql
```

Each command should say "Success". If any fail, check that your `database_id` in `wrangler.toml` is correct.

### Step 6: Deploy

```bash
npm run deploy
```

Cloudflare will build and deploy the site. The first time, it creates a new Pages project. When it finishes, you'll get a URL like:

```
✨ Deployment complete! https://bullrun.pages.dev
```

That's your live game — share it with your classmates!

### Updating the live site

After pulling new code or making changes, just run:

```bash
npm run deploy
```

If new migration files were added, run those too (Step 5 commands for the new files only).

---

## Project Structure

```
bullrun/
├── package.json                # Scripts: setup, dev, deploy
├── wrangler.toml               # Cloudflare config (D1 + KV bindings)
├── setup.sh                    # Local database setup script
├── DEVELOPMENT.md              # Full development context for AI sessions
├── migrations/
│   ├── 0001_initial.sql        # Database schema + 35 base stocks
│   ├── 0002_watchlist.sql      # Watchlist table
│   ├── 0003_lobby_stock_history.sql  # Lobby match price history
│   ├── 0004_seed_cosmetics.sql       # Base cosmetic items
│   └── 0005_extended_content.sql     # Extended BP (Lv250) + 35 more stocks
├── functions/
│   └── api/
│       └── [[path]].js         # ALL backend API routes (~2200 lines)
└── public/
    ├── index.html              # Main HTML (single-page app)
    ├── css/
    │   └── style.css           # All styles (~1700 lines)
    └── js/
        ├── api.js              # API communication layer
        ├── auth.js             # Login/signup/session logic
        └── app.js              # All pages, modules, charts (~2700 lines)
```

---

## Troubleshooting

**"wrangler: command not found"**
→ Run `npm install -g wrangler` again, or prefix commands with `npx` (e.g., `npx wrangler pages dev ...`).

**"no such table" errors locally**
→ Your database is missing or outdated. Run `rm -rf .wrangler && npm run setup`.

**SSL errors during `npm install`**
→ School networks with web filtering cause this. Run `npm config set strict-ssl false` first.

**Blank page after deploying**
→ You haven't run the database migrations on production. See Step 5 in the deployment section.

**Prices aren't updating**
→ Prices use lazy evaluation — they only tick when someone loads the market page. Open the market and wait 30 seconds.

**"self-signed certificate" warnings in terminal**
→ These are harmless. Wrangler tries to phone home to Cloudflare for analytics — it doesn't affect the game.

**`setup.sh` causes git pull conflicts**
→ The script gets modified by `chmod`. Always run `git checkout -- setup.sh` before `git pull`.

**Admin panel not showing**
→ Click the BullRun logo in the top nav bar 5 times quickly (within 2 seconds). Enter password `BullRun2026!`.

---

## Credits

Built by Xavier as a Year 12 school project (Western Australia, 2025-2026).
