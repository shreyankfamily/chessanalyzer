// Stockfish engine wrapper.
//
// We load a SINGLE-THREADED Stockfish build. GitHub Pages cannot send the
// COOP/COEP headers that multi-threaded WASM (SharedArrayBuffer) requires, so
// the threaded builds would fail. The classic stockfish.js (v10) asm.js/wasm
// single-file build runs in a plain Web Worker via importScripts — no special
// headers needed.
//
// Loaded from CDN through a tiny bootstrap worker so it works on a static host.

const STOCKFISH_CDN =
  'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js'

function makeWorker() {
  const bootstrap = `importScripts('${STOCKFISH_CDN}');`
  const blob = new Blob([bootstrap], { type: 'application/javascript' })
  return new Worker(URL.createObjectURL(blob))
}

export class Engine {
  constructor() {
    this.worker = null
    this.ready = false
    this.onInfo = null // (info) => void
    this.onBestMove = null // (bestmove, ponder) => void
    this._depthMap = {}
  }

  start() {
    if (this.worker) return
    this.worker = makeWorker()
    this.worker.onmessage = (e) => this._handleLine(e.data)
    this._send('uci')
    this._send('isready')
    this._send('setoption name MultiPV value 1')
  }

  stop() {
    if (!this.worker) return
    this._send('quit')
    this.worker.terminate()
    this.worker = null
    this.ready = false
  }

  _send(cmd) {
    if (this.worker) this.worker.postMessage(cmd)
  }

  // Start an infinite analysis of a position. movetimeMs limits each search.
  analyze(fen, { depth = 18, movetimeMs = 2500 } = {}) {
    if (!this.worker) this.start()
    this._send('stop')
    this._send('ucinewgame')
    this._send(`position fen ${fen}`)
    if (movetimeMs) this._send(`go depth ${depth} movetime ${movetimeMs}`)
    else this._send(`go depth ${depth}`)
  }

  halt() {
    this._send('stop')
  }

  _handleLine(line) {
    if (typeof line !== 'string') return
    if (line === 'readyok' || line === 'uciok') {
      this.ready = true
      return
    }
    if (line.startsWith('info') && line.includes(' pv ')) {
      const info = parseInfo(line)
      if (info && this.onInfo) this.onInfo(info)
    } else if (line.startsWith('bestmove')) {
      const parts = line.split(/\s+/)
      const best = parts[1]
      const ponder = parts[3]
      if (this.onBestMove) this.onBestMove(best, ponder)
    }
  }
}

function parseInfo(line) {
  const tokens = line.split(/\s+/)
  const info = { depth: null, scoreCp: null, scoreMate: null, pv: [] }
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === 'depth') info.depth = parseInt(tokens[i + 1], 10)
    else if (t === 'score') {
      const kind = tokens[i + 1]
      const val = parseInt(tokens[i + 2], 10)
      if (kind === 'cp') info.scoreCp = val
      else if (kind === 'mate') info.scoreMate = val
    } else if (t === 'pv') {
      info.pv = tokens.slice(i + 1)
      break
    }
  }
  return info
}
