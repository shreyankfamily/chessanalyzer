# Local Server for Mobile Puzzle Mirroring

This allows you to mirror the puzzle you're solving on your laptop to your mobile device on the same network.

## Setup

1. **Start the server on your laptop:**
   ```bash
   node local-server.js
   ```

   You'll see something like:
   ```
   ╔════════════════════════════════════════════════════════╗
   ║   ChessAnalyzer Local Server                           ║
   ║   On your mobile device, open:                         ║
   ║   → http://192.168.1.100:3000                          ║
   ╚════════════════════════════════════════════════════════╝
   ```

2. **Enable Auto Mode:**
   - Open lichess on your laptop
   - Click the ChessAnalyzer extension popup
   - Click "Auto OFF" to toggle it to "Auto ON" (turns green)

3. **On your mobile device:**
   - Open the URL shown in step 1 (e.g., `http://192.168.1.100:3000`)
   - Bookmark it for easy access
   - It will auto-sync as you solve puzzles on your laptop

## How It Works

- The extension monitors the lichess board for changes
- When you open a new puzzle, it's automatically sent to the local server
- Your mobile page polls the server every second and displays the latest puzzle
- Click "Open in Analyzer" or "Copy FEN" from the mobile page as needed

## Tips

- The mobile page shows when it last synced (e.g., "5s ago")
- Both devices must be on the same WiFi network
- The server runs in the background on your laptop while you play
- You can keep the server running and just start/stop it as needed

## Troubleshooting

If the mobile page shows "✕ Waiting for server...":
1. Make sure the server is running: `node local-server.js`
2. Check that both devices are on the same network
3. Make sure the IP address in the mobile URL is correct (shown when you start the server)
4. On mobile, check that you can reach the URL in your browser
