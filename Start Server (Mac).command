#!/bin/bash
# ============================================================
# BullRun — Start Server (Mac)
# Double-click this file to start the game server.
# ============================================================

cd "$(dirname "$0")"
clear

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║         🐂  B U L L R U N  🐂        ║"
echo "  ║      Stock Market Simulator          ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

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
    echo "  📦 First time setup — installing dependencies..."
    echo ""
    npm install
    echo ""
fi

# Check if database exists
if [ ! -d ".wrangler" ]; then
    echo "  🗄️  No database found — running first-time setup..."
    echo ""
    npm run setup
    echo ""
fi

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
