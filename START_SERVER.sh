#!/bin/bash
# Start the ChessAnalyzer local server with PM2 auto-restart

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "PM2 not found. Installing globally..."
    npm install -g pm2
fi

echo "Starting ChessAnalyzer server with PM2..."
pm2 start ecosystem.config.js

echo ""
echo "✓ Server started with auto-restart enabled"
echo ""
echo "Useful commands:"
echo "  pm2 status              - Check server status"
echo "  pm2 logs                - View server logs"
echo "  pm2 stop chessanalyzer-server  - Stop server"
echo "  pm2 restart chessanalyzer-server - Restart server"
echo ""
echo "To make server start on boot:"
echo "  pm2 startup"
echo "  pm2 save"
echo ""
