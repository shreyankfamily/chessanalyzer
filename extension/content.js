// Runs on ChessTempo and Lichess. Adds a floating button that reads the
// current position from the page DOM and opens it in ChessAnalyzer. Also
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

function injectButton() {
  if (document.getElementById('chessanalyzer-btn')) return
  const btn = document.createElement('button')
  btn.id = 'chessanalyzer-btn'
  btn.textContent = '♟ Analyze in ChessAnalyzer'
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
    if (!fen) {
      btn.textContent = '✕ No position found'
      setTimeout(() => (btn.textContent = '♟ Analyze in ChessAnalyzer'), 1800)
      return
    }
    openInApp(fen)
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
