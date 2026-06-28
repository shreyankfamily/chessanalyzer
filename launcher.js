#!/usr/bin/env node
// Simple launcher that starts the server and keeps it running
// Run once: node launcher.js
// The server will auto-restart if it crashes

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('🚀 ChessAnalyzer Server Launcher')
console.log('='.repeat(50))
console.log('Starting server with auto-restart...\n')

let serverProcess = null
let restartCount = 0
const MAX_RESTARTS = 5

function startServer() {
  console.log(`[${new Date().toLocaleTimeString()}] Starting server...`)

  serverProcess = spawn('node', ['local-server.js'], {
    cwd: __dirname,
    stdio: 'pipe'
  })

  serverProcess.stdout.on('data', (data) => {
    const output = data.toString()
    // Only print the initial startup message
    if (output.includes('ChessAnalyzer Local Server')) {
      console.log(output)
    }
  })

  serverProcess.stderr.on('data', (data) => {
    const error = data.toString()
    if (!error.includes('EADDRINUSE')) {
      console.error(`[ERROR] ${error}`)
    }
  })

  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      restartCount++
      if (restartCount <= MAX_RESTARTS) {
        console.log(`[${new Date().toLocaleTimeString()}] Server crashed (exit code ${code}). Restarting in 2 seconds... (${restartCount}/${MAX_RESTARTS})`)
        setTimeout(startServer, 2000)
      } else {
        console.error('Server crashed too many times. Giving up.')
        process.exit(1)
      }
    }
  })
}

// Handle signals for graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nShutting down...')
  if (serverProcess) serverProcess.kill()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('\nShutting down...')
  if (serverProcess) serverProcess.kill()
  process.exit(0)
})

startServer()
