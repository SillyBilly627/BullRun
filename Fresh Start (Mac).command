#!/bin/bash
# ============================================================
# BullRun — Fresh Start (Mac)
# Double-click this file to wipe the database and start fresh.
# All player accounts, trades, and progress will be deleted.
# ============================================================

cd "$(dirname "$0")"
clear

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║         🐂  B U L L R U N  🐂        ║"
echo "  ║          ⚠️  FRESH START  ⚠️          ║"
echo "  ╚══════════════════════════════════════╝"
echo ""
echo "  This will DELETE all data:"
echo "    • All player accounts"
echo "    • All trades and portfolios"
echo "    • All chat messages"
echo "    • All stock price history"
echo ""
read -p "  Are you sure? (y/n): " confirm
echo ""

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "  Cancelled. Nothing was deleted."
    echo ""
    read -p "  Press Enter to close..."
    exit 0
fi

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "  ❌ Node.js is not installed."
    echo "  Download it from https://nodejs.org (LTS version)"
    echo ""
    read -p "  Press Enter to close..."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "  📦 Installing dependencies..."
    echo ""
    npm install
    echo ""
fi

echo "  🗑️  Deleting old database..."
rm -rf .wrangler
echo "  ✅ Old data deleted."
echo ""

echo "  🗄️  Creating fresh database..."
echo ""
npm run setup
echo ""

echo "  🚀 Starting BullRun server..."
echo ""
echo "  ┌──────────────────────────────────────┐"
echo "  │                                      │"
echo "  │   Open your browser and go to:       │"
echo "  │   👉  http://localhost:8788           │"
echo "  │                                      │"
echo "  │   Press Ctrl+C to stop the server    │"
echo "  │                                      │"
echo "  └──────────────────────────────────────┘"
echo ""

npm run dev
