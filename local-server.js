#!/usr/bin/env node
// Simple local server to sync puzzles across devices on the same network
// Run: node local-server.js
// Then open http://192.168.x.x:3000 on your mobile device

import http from 'http'
import { parse } from 'url'
import { networkInterfaces } from 'os'

let latestPuzzle = {
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  orientation: 'white',
}

const server = http.createServer((req, res) => {
  const parsedUrl = parse(req.url, true)
  const pathname = parsedUrl.pathname

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // API endpoint: receive puzzle updates from extension
  if (pathname === '/api/puzzle' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => {
      body += chunk.toString()
    })
    req.on('end', () => {
      try {
        const data = JSON.parse(body)
        latestPuzzle = {
          fen: data.fen || latestPuzzle.fen,
          orientation: data.orientation || latestPuzzle.orientation,
        }
        console.log(`[${new Date().toLocaleTimeString()}] Puzzle updated:`, latestPuzzle.fen.split(' ')[0])
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.writeHead(400)
        res.end('Invalid JSON')
      }
    })
    return
  }

  // API endpoint: get latest puzzle
  if (pathname === '/api/puzzle' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(latestPuzzle))
    return
  }

  // Serve the mirror page
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ChessAnalyzer - Puzzle Mirror</title>
  <style>
    body {
      font-family: -apple-system, system-ui, sans-serif;
      margin: 0;
      padding: 16px;
      background: #f3f4f6;
      text-align: center;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    h1 { color: #2a1a6e; margin: 0 0 8px; }
    .status {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 20px;
    }
    .status.connected { color: #16a34a; }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background: #2a1a6e;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin: 0 8px 20px 0;
      text-decoration: none;
    }
    .btn:hover { background: #3a25a0; }
    .btn.secondary {
      background: #eef2ff;
      color: #2a1a6e;
    }
    .btn.secondary:hover { background: #e0e7ff; }
    .fen-display {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
      font-family: monospace;
      font-size: 12px;
      word-break: break-all;
      text-align: left;
      max-height: 100px;
      overflow-y: auto;
    }
    .last-update {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 16px;
    }
    #analyzerFrame {
      display: none;
      width: 100%;
      height: 900px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      margin-top: 20px;
      background: white;
    }
    #analyzerFrame.show {
      display: block;
    }
    .close-btn {
      background: #ef4444;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      margin-top: 10px;
      width: 100%;
    }
    .close-btn:hover { background: #dc2626; }
    .close-btn.hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>♟ ChessAnalyzer</h1>
    <p style="color: #6b7280; margin: 0 0 20px;">Puzzle Mirror</p>

    <div class="status" id="status">Connecting...</div>
    <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px;" id="turnDisplay">Loading...</div>

    <button class="btn" id="analyzerBtn" onclick="toggleAnalyzer()">📊 Open in Analyzer</button>
    <button class="btn secondary" onclick="copyFen()">📋 Copy FEN</button>

    <div class="fen-display" id="fenDisplay">Waiting for puzzle...</div>

    <iframe id="analyzerFrame"></iframe>
    <button class="close-btn hidden" id="closeBtn" onclick="closeAnalyzer()">Close Analyzer</button>

    <div class="last-update" id="updateSection">
      <p style="margin: 0 0 8px;">⚡ Auto-syncing from your laptop</p>
      <p style="margin: 0;">Last update: <span id="lastUpdate">never</span></p>
    </div>
  </div>

  <script>
    const ANALYZER_URL = 'https://shreyankfamily.github.io/chessanalyzer/'
    let currentFen = null
    let previousFen = null
    let lastUpdateTime = null
    let analyzerOpen = false

    function getTurnFromFen(fen) {
      const parts = fen.split(' ')
      return parts[1] === 'b' ? 'black' : 'white'
    }

    function toggleAnalyzer() {
      if (!currentFen) {
        alert('No puzzle loaded yet')
        return
      }
      analyzerOpen = !analyzerOpen
      const frame = document.getElementById('analyzerFrame')
      const closeBtn = document.getElementById('closeBtn')
      const analyzerBtn = document.getElementById('analyzerBtn')
      const updateSection = document.getElementById('updateSection')

      if (analyzerOpen) {
        const analyzerUrl = ANALYZER_URL + '?fen=' + encodeURIComponent(currentFen)
        frame.src = analyzerUrl
        frame.classList.add('show')
        closeBtn.classList.remove('hidden')
        updateSection.style.display = 'none'
        analyzerBtn.textContent = '📊 Analyzer Open'
      } else {
        closeAnalyzer()
      }
    }

    function closeAnalyzer() {
      analyzerOpen = false
      const frame = document.getElementById('analyzerFrame')
      const closeBtn = document.getElementById('closeBtn')
      const analyzerBtn = document.getElementById('analyzerBtn')
      const updateSection = document.getElementById('updateSection')
      frame.classList.remove('show')
      closeBtn.classList.add('hidden')
      updateSection.style.display = 'block'
      analyzerBtn.textContent = '📊 Open in Analyzer'
    }

    async function fetchPuzzle() {
      try {
        const response = await fetch('/api/puzzle')
        const data = await response.json()
        const fen = data.fen

        // Only update if FEN changed
        if (fen === currentFen) {
          return
        }

        currentFen = fen

        const fenDisplay = document.getElementById('fenDisplay')
        fenDisplay.textContent = fen

        const turn = getTurnFromFen(fen)
        const turnDisplay = document.getElementById('turnDisplay')
        turnDisplay.textContent = turn === 'white' ? '♔ White to move' : '♚ Black to move'
        turnDisplay.style.color = turn === 'white' ? '#2a1a6e' : '#1f2937'

        // Update analyzer iframe if it's open
        if (analyzerOpen) {
          const analyzerUrl = ANALYZER_URL + '?fen=' + encodeURIComponent(fen)
          document.getElementById('analyzerFrame').src = analyzerUrl
        }

        const status = document.getElementById('status')
        status.textContent = '✓ Connected'
        status.classList.add('connected')

        lastUpdateTime = new Date()
        updateLastUpdateTime()
      } catch (error) {
        const status = document.getElementById('status')
        status.textContent = '✕ Waiting for server...'
        status.classList.remove('connected')
      }
    }

    function updateLastUpdateTime() {
      if (!lastUpdateTime) return
      const now = new Date()
      const diff = Math.floor((now - lastUpdateTime) / 1000)
      if (diff < 60) {
        document.getElementById('lastUpdate').textContent = diff + 's ago'
      } else {
        document.getElementById('lastUpdate').textContent = Math.floor(diff / 60) + 'm ago'
      }
    }

    function copyFen() {
      if (!currentFen) {
        alert('No puzzle loaded yet')
        return
      }
      navigator.clipboard.writeText(currentFen).then(() => {
        const btn = event.target
        const originalText = btn.textContent
        btn.textContent = '✓ Copied!'
        setTimeout(() => {
          btn.textContent = originalText
        }, 2000)
      })
    }

    // Poll for updates every second
    fetchPuzzle()
    setInterval(fetchPuzzle, 1000)
    setInterval(updateLastUpdateTime, 1000)
  </script>
</body>
</html>`)
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

const PORT = 3000
server.listen(PORT, () => {
  const ipAddress = getLocalIpAddress()
  console.log(`
╔════════════════════════════════════════════════════════╗
║   ChessAnalyzer Local Server                           ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║   On your mobile device, open:                         ║
║   → http://${ipAddress}:${PORT}                         ║
║                                                        ║
║   Bookmark this URL and refresh to see latest puzzle   ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
`)
})

function getLocalIpAddress() {
  const interfaces = networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return 'localhost'
}
