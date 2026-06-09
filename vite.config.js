import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Repo is served at https://<user>.github.io/chessanalyzer/
export default defineConfig({
  base: '/chessanalyzer/',
  plugins: [react()],
})
