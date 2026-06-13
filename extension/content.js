// Runs on ChessTempo, Chess.com and Lichess. Adds a floating button that reads
// the current position from the page DOM and opens it in ChessAnalyzer. Also
// answers FEN requests from the popup.

// Set this to your deployed app once it's live.
const APP_URL = 'https://shreyankfamily.github.io/chessanalyzer/'

function getFen() {
  try {
    return window.__chessAnalyzerExtract ? window.__chessAnalyzerExtract() : null
  } catch (e) {
    console.warn('[ChessAnalyzer] extract failed', e)
    return null
  }
}

function openInApp(fen) {
  const url = `${APP_URL}?fen=${encodeURIComponent(fen)}`
  window.open(url, '_blank', 'noopener')
}

const LABEL = '♟ Analyze in ChessAnalyzer'

// chess.com's analysis board (and some others) draw onto a <canvas>, so there
// are no piece elements to read. Find the board canvas — the largest roughly
// square one — so we can hand its pixels to the screenshot scanner.
function findBoardCanvas() {
  let best = null
  let bestArea = 0
  for (const c of document.querySelectorAll('canvas')) {
    const r = c.getBoundingClientRect()
    if (r.width < 160 || r.height < 160) continue
    const ratio = r.width / r.height
    if (ratio < 0.85 || ratio > 1.18) continue // must be near-square (a board)
    const area = r.width * r.height
    if (area > bestArea) { best = c; bestArea = area }
  }
  return best
}

// Fallback when no FEN is in the DOM: capture the board canvas and route it
// through the app's screenshot-recognition scanner (same handoff the popup's
// screenshot button uses — stash the image, open the app in ?scan=ext mode).
// Returns false if there's no readable canvas (e.g. none found, blank, or the
// canvas is cross-origin tainted so its pixels can't be read here).
function tryCanvasFallback() {
  const canvas = findBoardCanvas()
  if (!canvas) return false
  let dataUrl
  try {
    dataUrl = canvas.toDataURL('image/png')
  } catch (e) {
    // SecurityError: a cross-origin theme/piece image tainted the canvas.
    console.warn('[ChessAnalyzer] cannot read board canvas pixels', e)
    return false
  }
  if (!dataUrl || dataUrl.length < 1000) return false // blank/empty canvas
  // Fire-and-forget the store, then open synchronously to keep the user
  // gesture (avoids popup blocking). The app loads long after the store
  // settles, and the bridge re-checks storage on its READY handshake.
  chrome.storage.local.set({ pendingScreenshot: { dataUrl, ts: Date.now() } })
  window.open(`${APP_URL}?scan=ext`, '_blank', 'noopener')
  return true
}

function injectButton() {
  if (document.getElementById('chessanalyzer-btn')) return
  const btn = document.createElement('button')
  btn.id = 'chessanalyzer-btn'
  btn.textContent = LABEL
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    zIndex: 999999,
    padding: '10px 14px',
    background: '#2a1a6e',
    color: '#fff',
    border: 'none',
    borderRadius: '999px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  })
  btn.addEventListener('click', () => {
    const fen = getFen()
    if (fen) {
      openInApp(fen)
      return
    }
    // No FEN in the DOM — try the canvas (e.g. chess.com analysis board).
    if (tryCanvasFallback()) return
    btn.textContent = '✕ No position found'
    setTimeout(() => (btn.textContent = LABEL), 1800)
  })
  document.body.appendChild(btn)
}

// Let the popup request the FEN.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'GET_FEN') {
    sendResponse({ fen: getFen() })
  } else if (msg?.type === 'OPEN_IN_APP') {
    const fen = getFen()
    if (fen) openInApp(fen)
    sendResponse({ fen })
  }
  return true
})

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectButton)
} else {
  injectButton()
}
