const APP_URL = 'https://shreyankfamily.github.io/chessanalyzer/'
const fenEl = document.getElementById('fen')
const errEl = document.getElementById('err')
const autoBtn = document.getElementById('auto')
let currentFen = null

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

const SUPPORTED = /(?:chesstempo\.com|lichess\.org)/

async function detect() {
  const tab = await activeTab()
  if (!tab || !SUPPORTED.test(tab.url || '')) {
    fenEl.textContent = ''
    errEl.textContent = 'Open a ChessTempo or Lichess board first.'
    return
  }
  chrome.tabs.sendMessage(tab.id, { type: 'GET_FEN' }, (resp) => {
    if (chrome.runtime.lastError) {
      errEl.textContent = 'Reload the chess tab, then reopen.'
      return
    }
    if (resp?.fen) {
      currentFen = resp.fen
      fenEl.textContent = resp.fen
    } else {
      fenEl.textContent = ''
      errEl.textContent = 'No position detected on this page.'
    }
  })
}

async function updateAutoButtonState() {
  const { autoModeEnabled } = await chrome.storage.local.get('autoModeEnabled')
  if (autoModeEnabled) {
    autoBtn.classList.add('active')
    autoBtn.textContent = '⏸'
  } else {
    autoBtn.classList.remove('active')
    autoBtn.textContent = '▶'
  }
}

document.getElementById('open').addEventListener('click', async () => {
  const tab = await activeTab()
  chrome.tabs.sendMessage(tab.id, { type: 'OPEN_IN_APP' }, () => {})
  window.close()
})

autoBtn.addEventListener('click', async () => {
  const { autoModeEnabled } = await chrome.storage.local.get('autoModeEnabled')
  const newState = !autoModeEnabled
  await chrome.storage.local.set({ autoModeEnabled: newState })
  updateAutoButtonState()
})

document.getElementById('shot').addEventListener('click', async () => {
  errEl.textContent = ''
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' })
    await chrome.storage.local.set({ pendingScreenshot: { dataUrl, ts: Date.now() } })
    await chrome.tabs.create({ url: `${APP_URL}?scan=ext` })
    window.close()
  } catch (e) {
    errEl.textContent = 'Screenshot failed: ' + e.message
  }
})

document.getElementById('copy').addEventListener('click', async () => {
  if (currentFen) {
    await navigator.clipboard.writeText(currentFen)
    document.getElementById('copy').textContent = 'Copied!'
  }
})

detect()
updateAutoButtonState()
