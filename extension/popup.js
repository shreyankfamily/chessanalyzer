const fenEl = document.getElementById('fen')
const errEl = document.getElementById('err')
let currentFen = null

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function detect() {
  const tab = await activeTab()
  if (!tab || !/chesstempo\.com/.test(tab.url || '')) {
    fenEl.textContent = ''
    errEl.textContent = 'Open a ChessTempo board first.'
    return
  }
  chrome.tabs.sendMessage(tab.id, { type: 'GET_FEN' }, (resp) => {
    if (chrome.runtime.lastError) {
      errEl.textContent = 'Reload the ChessTempo tab, then reopen.'
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

document.getElementById('open').addEventListener('click', async () => {
  const tab = await activeTab()
  chrome.tabs.sendMessage(tab.id, { type: 'OPEN_IN_APP' }, () => {})
  window.close()
})

document.getElementById('copy').addEventListener('click', async () => {
  if (currentFen) {
    await navigator.clipboard.writeText(currentFen)
    document.getElementById('copy').textContent = 'Copied!'
  }
})

detect()
