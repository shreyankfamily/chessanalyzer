module.exports = {
  apps: [
    {
      name: 'chessanalyzer-server',
      script: './local-server.js',
      instances: 1,
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      // Auto restart on crash
      autorestart: true,
      max_memory_restart: '1G',
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000,
      // NO LOGGING - send to /dev/null to avoid filling disk
      output: '/dev/null',
      error: '/dev/null',
      // Keep process alive even if it crashes
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
}
