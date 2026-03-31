# BullRun — Stock Market Simulation Game

A multiplayer stock market simulator where players trade simulated stocks, compete on leaderboards, and learn the basics of stock trading.

## What's Included (Phase 1)

- **Authentication** — signup and login with hashed passwords
- **Open Market** — browse, search, buy and sell 35 stocks (mix of real names + fictional companies)
- **Portfolio** — track your holdings, profit/loss, and net worth
- **Leaderboards** — weekly money, all-time best, and level rankings
- **Player Profiles** — view any player's stats and holdings
- **XP & Leveling** — earn XP from profitable trades
- **Educational Tips** — trading tips shown after each buy/sell
- **Announcements** — admin can post announcements for all players

---

## How to Set Up (Step by Step)

### Prerequisites

You need:
1. A **Cloudflare account** (free) — sign up at [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Node.js** installed on your computer — download from [nodejs.org](https://nodejs.org) (get the LTS version)

### Step 1: Install Wrangler (Cloudflare's CLI tool)

Open your terminal (Terminal on Mac) and run:

```bash
npm install -g wrangler
```

Then log in to your Cloudflare account:

```bash
wrangler login
```

This will open your browser — click "Allow" to authorise Wrangler.

### Step 2: Open the project

Navigate into the bullrun folder in your terminal:

```bash
cd path/to/bullrun
```

Install the project dependencies:

```bash
npm install
```

### Step 3: Create the database and KV store

Run these commands one by one:

**Create the D1 database:**
```bash
wrangler d1 create bullrun-db
```

This will output something like:
```
database_id = "abc123-def456-..."
```

**Copy that `database_id` value** and paste it into `wrangler.toml` where it says `YOUR_D1_DATABASE_ID_HERE`.

**Create the KV namespace:**
```bash
wrangler kv namespace create SESSION_STORE
```

This will output something like:
```
id = "xyz789..."
```

**Copy that `id` value** and paste it into `wrangler.toml` where it says `YOUR_KV_NAMESPACE_ID_HERE`.

### Step 4: Set up the local database

Run the setup script — this automatically creates the database and loads all tables and stocks:

```bash
npm run setup
```

> **Why a setup script?** Wrangler's migration tool (`d1 execute`) and the dev server (`pages dev`) store the local database in slightly different paths. The setup script handles this by starting the server briefly to create the database file, then runs the SQL migration directly into it. This avoids the "no such table" errors.

**For production (after deploying to Cloudflare):**
```bash
npm run db:migrate:remote
```

### Step 5: Test locally

Start the local development server:

```bash
npm run dev
```

Open your browser and go to: **http://localhost:8788**

You should see the BullRun login screen. Create an account and start trading!

### Step 6: Deploy to Cloudflare

When you're ready to go live:

```bash
npm run deploy
```

Then run the database migration on production:

```bash
npm run db:migrate:remote
```

Cloudflare will give you a URL like `bullrun.pages.dev` — that's your live game!

---

## Project Structure

```
bullrun/
├── package.json              # Project config and scripts
├── wrangler.toml             # Cloudflare configuration
├── migrations/
│   └── 0001_initial.sql      # Database tables and seed data
├── functions/
│   └── api/
│       └── [[path]].js       # Backend API (all routes)
└── public/
    ├── index.html            # Main HTML page
    ├── css/
    │   └── style.css         # All styles
    └── js/
        ├── api.js            # API communication layer
        ├── auth.js           # Login/signup logic
        └── app.js            # Main app (pages, navigation)
```

---

## How It Works

- **Frontend:** Vanilla HTML, CSS, JavaScript — no frameworks
- **Backend:** Cloudflare Pages Functions (serverless JavaScript)
- **Database:** Cloudflare D1 (SQLite)
- **Sessions:** Cloudflare KV (key-value store)
- **Passwords:** Hashed with PBKDF2 (100,000 iterations + unique salt)
- **Auth:** Bearer token in HTTP headers

---

## Upcoming Phases

- **Phase 2:** Stock price engine with random walk + player pressure, candlestick charts
- **Phase 3:** Closed lobbies, global chat, full leveling system
- **Phase 4:** Cosmetics, battle pass, crate spins, admin panel

---

## Troubleshooting

**"wrangler: command not found"**
→ Run `npm install -g wrangler` again, or use `npx wrangler` instead.

**Login doesn't work locally**
→ Make sure you ran `npm run db:migrate:local` first.

**Blank page after deploy**
→ Make sure you ran `npm run db:migrate:remote` to set up the production database.

**"D1_ERROR: no such table"**
→ The migration hasn't been run. Run the appropriate migrate command.
