import { Chess } from 'chess.js'

// Convert a UCI principal-variation (e.g. ['e2e4','e7e5']) to SAN using a
// starting FEN, so we can show readable moves like "1. e4 e5".
export function pvToSan(fen, pvUci, maxPlies = 8) {
  const game = new Chess()
  try {
    game.load(fen)
  } catch {
    return ''
  }
  const sans = []
  for (let i = 0; i < Math.min(pvUci.length, maxPlies); i++) {
    const uci = pvUci[i]
    const move = {
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    }
    const res = game.move(move)
    if (!res) break
    sans.push(res.san)
  }
  // Number the moves.
  const startTurn = fen.split(' ')[1]
  let moveNo = parseInt(fen.split(' ')[5] || '1', 10)
  let out = ''
  let idx = 0
  if (startTurn === 'b' && sans.length) {
    out += `${moveNo}... ${sans[0]} `
    idx = 1
    moveNo++
  }
  for (; idx < sans.length; idx += 2) {
    out += `${moveNo}. ${sans[idx]} `
    if (sans[idx + 1]) out += `${sans[idx + 1]} `
    moveNo++
  }
  return out.trim()
}
