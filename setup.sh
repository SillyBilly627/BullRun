#!/bin/bash
# ============================================================
# BullRun — Local Development Setup Script
# ============================================================
# This script sets up the local database correctly.
# It handles the path mismatch between wrangler's migration
# tool and the dev server by:
# 1. Starting the dev server briefly to create the DB file
# 2. Finding where it put the database
# 3. Running the migration SQL directly into that file
# ============================================================

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   BullRun — Local Setup              ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Step 1: Clean any old database
echo "→ Cleaning old database files..."
rm -rf .wrangler

# Step 2: Start the dev server in the background
echo "→ Starting dev server to initialise database..."
npx wrangler pages dev ./public --d1 DB --kv SESSION_STORE --port 8788 &
SERVER_PID=$!

# Wait for the server to start
sleep 5

# Step 3: Hit the server to force it to create the DB file
# We use the announcements endpoint because it queries the database
# without needing authentication, which forces D1 to create the sqlite file
echo "→ Triggering database creation..."
curl -s -o /dev/null http://localhost:8788/api/announcements 2>/dev/null
curl -s -o /dev/null -X POST -H "Content-Type: application/json" -d '{"username":"_setup_","password":"Setup1"}' http://localhost:8788/api/auth/signup 2>/dev/null

# Wait a moment for the file to be written
sleep 3

# Step 4: Find the SQLite database file (with retries)
DB_FILE=""
for attempt in 1 2 3 4 5; do
  DB_FILE=$(find .wrangler -name "*.sqlite" 2>/dev/null | head -1)
  if [ -n "$DB_FILE" ]; then
    break
  fi
  echo "  Waiting for database file (attempt $attempt)..."
  sleep 2
done

if [ -z "$DB_FILE" ]; then
  echo "✘ Could not find the database file. Something went wrong."
  kill $SERVER_PID 2>/dev/null
  exit 1
fi

echo "→ Found database at: $DB_FILE"

# Step 5: Stop the server
echo "→ Stopping dev server..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
sleep 1

# Step 6: Run the migration SQL directly into the database
echo "→ Running database migrations..."
for migration in migrations/*.sql; do
  echo "  Running $migration..."
  sqlite3 "$DB_FILE" < "$migration"
done

if [ $? -eq 0 ]; then
  echo ""
  echo "  ✅ Setup complete!"
  echo ""
  echo "  Run 'npm run dev' to start the server."
  echo "  Then open http://localhost:8788 in your browser."
  echo ""
else
  echo ""
  echo "  ✘ Migration failed. Check the error above."
  echo ""
  exit 1
fi
