#!/bin/bash
# ============================================================
# BullRun — Host on Port 80 (Mac)
# Double-click to start the server on port 80.
# This lets other devices on your network connect by
# going to your Mac's IP address in their browser.
# Requires your Mac password (admin privileges for port 80).
# ============================================================

cd "$(dirname "$0")/.."
clear

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║         🐂  B U L L R U N  🐂        ║"
echo "  ║       Host on Port 80 (Network)      ║"
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

# Get local IP address
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "your-ip")

echo "  ⚠️  Port 80 requires admin privileges."
echo "  You'll be asked for your Mac password below."
echo ""
echo "  💡 If friends still can't connect:"
echo "     System Settings → Network → Firewall → turn OFF"
echo "     (or allow incoming connections when prompted)"
echo ""
echo "  🚀 Starting BullRun on port 80..."
echo ""
echo "  ┌──────────────────────────────────────┐"
echo "  │                                      │"
echo "  │   On this Mac:                       │"
echo "  │   👉  http://localhost                │"
echo "  │                                      │"
echo "  │   Other devices on your network:     │"
echo "  │   👉  http://$LOCAL_IP"
echo "  │                                      │"
echo "  │   Press Ctrl+C to stop the server    │"
echo "  │                                      │"
echo "  └──────────────────────────────────────┘"
echo ""

sudo npx wrangler pages dev ./public --d1 DB --kv SESSION_STORE --port 80 --ip 0.0.0.0
