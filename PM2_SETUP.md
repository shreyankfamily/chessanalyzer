# Auto-Restart Server Setup with PM2

PM2 is a Node.js process manager that automatically restarts your server if it crashes and can even start it on system boot.

## Quick Setup

### 1. Install PM2 (one time only)
```bash
npm install -g pm2
```

### 2. Start the server with auto-restart
```bash
bash START_SERVER.sh
```

Or manually:
```bash
pm2 start ecosystem.config.js
```

## Useful Commands

```bash
# Check server status
pm2 status

# View real-time logs
pm2 logs

# Stop the server
pm2 stop chessanalyzer-server

# Restart the server
pm2 restart chessanalyzer-server

# View server info
pm2 show chessanalyzer-server
```

## Auto-Start on System Boot (Optional)

Make the server start automatically when your computer restarts:

```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save
```

Then, to undo auto-boot:
```bash
pm2 unstartup
```

## Features

- ✅ **Auto-restart on crash** - Server restarts automatically if it crashes
- ✅ **Memory limit** - Restarts if server uses more than 1GB RAM
- ✅ **Graceful shutdown** - 5 second timeout for clean shutdown
- ✅ **Logging** - Logs saved to `server.log` and `server-error.log`
- ✅ **System boot** - Can start automatically on computer restart

## Troubleshooting

**Server won't start:**
```bash
# Clear PM2 cache
pm2 kill
pm2 start ecosystem.config.js
```

**Check what's happening:**
```bash
# View detailed logs
pm2 logs chessanalyzer-server

# View memory usage
pm2 monit
```

**Manual restart:**
```bash
pm2 restart chessanalyzer-server
```
