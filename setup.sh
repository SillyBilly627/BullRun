#!/bin/bash
# ============================================================
# BullRun — Local Development Setup Script
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
npx wrangler pages dev ./public --d1 DB --kv SESSION_STORE --port 8788 > /tmp/bullrun_setup.log 2>&1 &
SERVER_PID=$!

echo "  Waiting for server to boot..."
sleep 8

# Step 3: Hit the server to force D1 to create the DB file on disk
echo "→ Triggering database creation..."
curl -s -o /dev/null http://localhost:8788/api/announcements 2>/dev/null
curl -s -o /dev/null http://localhost:8788/api/config/chat-status 2>/dev/null
sleep 3

# Step 4: Find the D1 database file — MUST be in the d1 directory, not kv
echo "→ Searching for database file..."
DB_FILE=""
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  # First: look specifically in d1 directory (the correct location)
  while IFS= read -r f; do
    if [ -f "$f" ]; then
      # Check if it's a SQLite file
      if head -c 16 "$f" 2>/dev/null | grep -q "SQLite format 3"; then
        DB_FILE="$f"
        break
      fi
      if file "$f" 2>/dev/null | grep -qi "sqlite"; then
        DB_FILE="$f"
        break
      fi
    fi
  done < <(find .wrangler -path "*/d1/*" -type f 2>/dev/null)

  # Fallback: if no d1 file found, look for any sqlite file NOT in kv directory
  if [ -z "$DB_FILE" ]; then
    while IFS= read -r f; do
      # Skip files in kv directories
      if echo "$f" | grep -q "/kv/"; then
        continue
      fi
      if [ -f "$f" ] && head -c 16 "$f" 2>/dev/null | grep -q "SQLite format 3"; then
        DB_FILE="$f"
        break
      fi
    done < <(find .wrangler -type f 2>/dev/null)
  fi

  if [ -n "$DB_FILE" ]; then
    break
  fi
  echo "  Searching... (attempt $attempt)"
  sleep 2
done

# Step 5: Stop the dev server
echo "→ Stopping dev server..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
sleep 1

if [ -z "$DB_FILE" ]; then
  echo ""
  echo "  ✘ Could not find the D1 database file."
  echo "  All files found in .wrangler:"
  find .wrangler -type f 2>/dev/null
  echo ""
  echo "  Looking for SQLite files:"
  find .wrangler -type f -exec sh -c 'head -c 16 "{}" 2>/dev/null | grep -q "SQLite format 3" && echo "  SQLite: {}"' \;
  echo ""
  echo "  Try: rm -rf .wrangler node_modules && npm install && npm run setup"
  exit 1
fi

echo "→ Found D1 database at: $DB_FILE"

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
