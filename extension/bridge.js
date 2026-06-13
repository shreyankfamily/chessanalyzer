// Runs on the ChessAnalyzer app page. When the popup captured a ChessTempo
// screenshot, it stashed it in chrome.storage.local and opened this app. We
// hand that image to the page (which runs the scan pipeline). The page and a
// content script share the DOM, so we relay via window.postMessage.

const MAX_AGE_MS = 60_000

async function getPending() {
  const { pendingScreenshot } = await chrome.storage.local.get('pendingScreenshot')
  if (!pendingScreenshot) return null
  if (Date.now() - pendingScreenshot.ts > MAX_AGE_MS) {
    await chrome.storage.local.remove('pendingScreenshot')
    return null
  }
  return pendingScreenshot.dataUrl
}

function send(dataUrl) {
  window.postMessage({ type: 'CHESSANALYZER_SCAN_IMAGE', dataUrl }, '*')
}

let delivered = false
async function deliver() {
  if (delivered) return
  const dataUrl = await getPending()
  if (!dataUrl) return
  delivered = true
  send(dataUrl)
  await chrome.storage.local.remove('pendingScreenshot')
}

// Two orderings to cover: (a) the app mounts after us — it posts READY and we
// answer; (b) we load after the app — we deliver immediately on init.
window.addEventListener('message', (e) => {
  if (e.source === window && e.data?.type === 'CHESSANALYZER_READY') deliver()
})
deliver()
