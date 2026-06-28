// Position extraction logic, shared by the content script.
//
// ChessTempo (like most chess sites) keeps the position digitally in the page,
// so we read it straight from the DOM instead of doing any image recognition —
// that's both exact and instant. We try several strategies, most-reliable first.

const FEN_PLACEMENT = /([pnbrqkPNBRQK1-8]+\/){7}[pnbrqkPNBRQK1-8]+/
const FEN_FULL =
  /([pnbrqkPNBRQK1-8]+\/){7}[pnbrqkPNBRQK1-8]+\s+[wb]\s+(-|[KQkqA-Ha-h]+)\s+(-|[a-h][36])(\s+\d+\s+\d+)?/

function looksLikeFen(s) {
  if (!s) return false
  const ranks = s.split(' ')[0].split('/')
  if (ranks.length !== 8) return false
  return FEN_PLACEMENT.test(s)
}

// 1) Known ChessTempo globals (these change over time; harmless if absent).
function fromGlobals() {
  const candidates = [
    window.fen,
    window.currentFen,
    window.problemFen,
    window.ctBoard && window.ctBoard.fen,
    window.board && typeof window.board.fen === 'function' && window.board.fen(),
  ]
  for (const c of candidates) if (looksLikeFen(c)) return normalize(c)
  return null
}

// 2) Any input / textarea / data-attribute that holds a FEN (copy-FEN fields,
//    share boxes, board-editor inputs are common on these sites).
function fromFields() {
  const els = document.querySelectorAll('input, textarea, [data-fen], [data-position], [fen]')
  for (const el of els) {
    const v = el.value || el.getAttribute('data-fen') || el.getAttribute('data-position') || el.getAttribute('fen') || ''
    if (looksLikeFen(v.trim())) return normalize(v.trim())
  }
  return null
}

// 3) Any FEN-looking substring anywhere in inline scripts / page text.
function fromText() {
  const scripts = document.querySelectorAll('script:not([src])')
  for (const s of scripts) {
    const m = s.textContent.match(FEN_FULL) || s.textContent.match(FEN_PLACEMENT)
    if (m && looksLikeFen(m[0])) return normalize(m[0])
  }
  const bodyMatch = document.body.innerText.match(FEN_FULL)
  if (bodyMatch && looksLikeFen(bodyMatch[0])) return normalize(bodyMatch[0])
  return null
}

// 4) Reconstruct from rendered piece elements. ChessTempo themes vary, so we
//    look for elements whose class names encode a piece + a square (e.g.
//    "wp"/"bn" plus an algebraic square, or background-image piece sprites).
function fromBoardDom() {
  // Find squares: elements carrying an algebraic-square identifier.
  const squareEls = document.querySelectorAll(
    '[data-square], [class*="square-"], [id^="sq_"], [data-key]'
  )
  if (squareEls.length < 32) return null

  const grid = {} // 'e4' -> pieceChar
  squareEls.forEach((el) => {
    const sq = squareOf(el)
    if (!sq) return
    const piece = pieceOf(el) || pieceOf(el.querySelector('*'))
    if (piece) grid[sq] = piece
  })
  if (Object.keys(grid).length === 0) return null
  return normalize(gridToFen(grid))
}

// 4b) Lichess (and other chessground-based sites) render pieces with CSS
//     transforms instead of per-square classes, so we map each piece's pixel
//     offset back to a board square. Orientation is read from the wrapper.
function fromChessground() {
  const board = document.querySelector('cg-board')
  if (!board) return null
  const pieces = board.querySelectorAll('piece')
  if (pieces.length < 2) return null

  const size = board.getBoundingClientRect().width || board.offsetWidth
  if (!size) return null
  const sq = size / 8

  const wrap = board.closest('.cg-wrap') || board.parentElement
  const blackOrientation =
    (wrap && wrap.className && /orientation-black/.test(wrap.className)) || false

  const grid = {}
  pieces.forEach((p) => {
    const piece = pieceOf(p)
    if (!piece) return
    const t = p.style.transform || ''
    const m = t.match(/translate(?:3d)?\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px/)
    if (!m) return
    let col = Math.round(parseFloat(m[1]) / sq) // 0..7 from left edge
    let row = Math.round(parseFloat(m[2]) / sq) // 0..7 from top edge
    if (col < 0 || col > 7 || row < 0 || row > 7) return
    const file = blackOrientation ? 7 - col : col
    const rank = blackOrientation ? row : 7 - row
    grid['abcdefgh'[file] + (rank + 1)] = piece
  })
  if (Object.keys(grid).length === 0) return null
  return normalize(gridToFen(grid))
}

function squareOf(el) {
  if (!el) return null
  const ds = el.getAttribute && (el.getAttribute('data-square') || el.getAttribute('data-key'))
  if (ds && /^[a-h][1-8]$/.test(ds)) return ds
  const cls = (el.className || '') + ' ' + (el.id || '')
  const m = cls.match(/(?:square-|sq_)?([a-h][1-8])\b/)
  return m ? m[1] : null
}

function pieceOf(el) {
  if (!el) return null
  const cls = (el.className || '').toString()
  // Patterns like "wp", "b-n", "white pawn", "piece-wK"
  let m = cls.match(/\b([wb])[-_]?([pnbrqk])\b/i)
  if (m) return colorPiece(m[1], m[2])
  m = cls.match(/\b(white|black)\s+(pawn|knight|bishop|rook|queen|king)\b/i)
  if (m) {
    const letter = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }[m[2].toLowerCase()]
    return colorPiece(m[1][0], letter)
  }
  // Sprite background images named like "wP.png"
  const bg = el.style && el.style.backgroundImage
  if (bg) {
    const b = bg.match(/([wb])([PNBRQK])\.(?:png|svg|gif)/)
    if (b) return colorPiece(b[1], b[2])
  }
  return null
}

function colorPiece(color, letter) {
  const l = letter.toLowerCase()
  return color.toLowerCase() === 'w' ? l.toUpperCase() : l
}

function gridToFen(grid) {
  const ranks = []
  for (let r = 8; r >= 1; r--) {
    let row = ''
    let empty = 0
    for (let f = 0; f < 8; f++) {
      const sq = 'abcdefgh'[f] + r
      const p = grid[sq]
      if (p) {
        if (empty) { row += empty; empty = 0 }
        row += p
      } else empty++
    }
    if (empty) row += empty
    ranks.push(row)
  }
  return ranks.join('/')
}

// Detect whose turn it is from the board orientation or page content
function detectTurn() {
  // In lichess puzzles, the board orientation usually matches whose turn it is
  // If board is flipped (orientation-black), it's black to move
  const wrap = document.querySelector('.cg-wrap')
  if (wrap && wrap.className) {
    if (/orientation-black/.test(wrap.className)) {
      return 'b'  // Board is flipped, so black to move
    } else {
      return 'w'  // Board is normal, so white to move
    }
  }

  // Fallback: look for text indicators
  const bodyText = (document.body.innerText || '').toLowerCase()
  if (/black.*move|find.*best.*move.*black/.test(bodyText)) {
    return 'b'
  }
  if (/white.*move|find.*best.*move.*white/.test(bodyText)) {
    return 'w'
  }

  return null
}

// Ensure a complete, legal-ish FEN (add side/castling/ep/clocks if missing).
function normalize(s) {
  const parts = s.trim().split(/\s+/)
  const placement = parts[0]
  // Try to get turn from existing FEN first, then detect from page, then default to white
  let turn = parts[1] && /^[wb]$/.test(parts[1]) ? parts[1] : (detectTurn() || 'w')
  const castle = parts[2] || '-'
  const ep = parts[3] || '-'
  const half = parts[4] || '0'
  const full = parts[5] || '1'
  return `${placement} ${turn} ${castle} ${ep} ${half} ${full}`
}

function extractFen() {
  return fromGlobals() || fromFields() || fromText() || fromChessground() || fromBoardDom() || null
}

// Expose for the content script / popup messaging.
if (typeof window !== 'undefined') window.__chessAnalyzerExtract = extractFen
