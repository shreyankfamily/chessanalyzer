# Auto-Start Server Setup

The server will automatically start and keep running without logging to disk.

## Quick Start

Just run once:
```bash
node launcher.js &
```

The `&` runs it in the background. The server will:
- ✅ Start automatically
- ✅ Auto-restart if it crashes
- ✅ No logging to disk
- ✅ Keep running in background

## Make it Auto-Start on Computer Boot (Mac)

For MacOS, create a launchd daemon that auto-starts the server:

### 1. Create the plist file
```bash
cat > ~/Library/LaunchAgents/com.chessanalyzer.server.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.chessanalyzer.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>~/Projects/chessanalyzer/launcher.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>~/Projects/chessanalyzer</string>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/dev/null</string>
    <key>StandardErrorPath</key>
    <string>/dev/null</string>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF
```

### 2. Load it
```bash
launchctl load ~/Library/LaunchAgents/com.chessanalyzer.server.plist
```

### 3. Check it's running
```bash
launchctl list | grep chessanalyzer
```

### To disable auto-start:
```bash
launchctl unload ~/Library/LaunchAgents/com.chessanalyzer.server.plist
```

## Make it Auto-Start on Computer Boot (Linux)

Create a systemd service:

### 1. Create service file
```bash
sudo tee /etc/systemd/system/chessanalyzer.service > /dev/null << 'EOF'
[Unit]
Description=ChessAnalyzer Local Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/path/to/chessanalyzer
ExecStart=/usr/bin/node /path/to/chessanalyzer/launcher.js
Restart=always
RestartSec=5
StandardOutput=null
StandardError=null

[Install]
WantedBy=default.target
EOF
```

Replace `/path/to/chessanalyzer` with your actual path.

### 2. Enable it
```bash
systemctl --user daemon-reload
systemctl --user enable chessanalyzer
systemctl --user start chessanalyzer
```

### 3. Check status
```bash
systemctl --user status chessanalyzer
```

## Running Without Auto-Boot

If you just want to run it in the background without auto-boot:

```bash
# Start in background
node launcher.js &

# It will keep running even if you close the terminal
# To stop it later, find the process and kill it
ps aux | grep launcher
kill <PID>
```

## Disable Auto-Start on Boot

**Mac:**
```bash
launchctl unload ~/Library/LaunchAgents/com.chessanalyzer.server.plist
```

**Linux:**
```bash
systemctl --user disable chessanalyzer
```

## Troubleshooting

**Server not starting:**
```bash
# Test manually
node launcher.js
# You should see the startup message
```

**Server keeps crashing:**
- Check if port 3000 is in use: `lsof -i :3000`
- Check local-server.js for errors

**Zero disk space:**
- The launcher only logs if there's an error, and sends output to `/dev/null`
- All logging is disabled to save disk space
