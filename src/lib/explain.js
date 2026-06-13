import { Chess } from 'chess.js'

// Rule-based, engine-data-driven move explanations. No LLM, no network.
// We turn Stockfish's eval + the concrete move (captures, checks, mate,
// castling, promotion) and the centipawn-loss-vs-best into a short sentence.

const NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
const MATE_CP = 100000

// A score is { cp, mate } from the perspective of the side to move at that node.
// Collapse to a single signed centipawn number (mate = very large).
function toCp(score) {
  if (!score) return 0
  if (score.mate != null) {
    return score.mate > 0 ? MATE_CP - score.mate * 100 : -MATE_CP - score.mate * 100
  }
  return score.cp ?? 0
}

// Format a score from White's perspective, like the eval bar.
function fmtWhite(score, turn) {
  if (!score) return ''
  if (score.mate != null) {
    const m = turn === 'w' ? score.mate : -score.mate
    return `#${m}`
  }
  const cp = turn === 'w' ? score.cp : -score.cp
  const v = (cp / 100).toFixed(2)
  return cp > 0 ? `+${v}` : `${v}`
}

function sanOf(fen, uci) {
  if (!uci || uci.length < 4) return null
  const g = new Chess(fen)
  try {
    const mv = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    return mv?.san ?? null
  } catch {
    return null
  }
}

function moveOf(fen, uci) {
  const g = new Chess(fen)
  try {
    const mv = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    return mv ? { mv, after: g } : null
  } catch {
    return null
  }
}

// Word picture of where the eval stands, phrased to follow "leaving ___".
function standing(score, turn) {
  if (score?.mate != null) {
    const m = turn === 'w' ? score.mate : -score.mate
    const side = m > 0 ? 'White' : 'Black'
    return `${side} with a forced mate`
  }
  const whiteCp = turn === 'w' ? (score?.cp ?? 0) : -(score?.cp ?? 0)
  const side = whiteCp >= 0 ? 'White' : 'Black'
  const a = Math.abs(whiteCp)
  if (a < 40) return 'the game roughly equal'
  if (a < 120) return `a slight edge for ${side}`
  if (a < 300) return `${side} clearly better`
  if (a < 600) return `${side} with a winning advantage`
  return `${side} completely winning`
}

// Explain why the engine's recommended move is best.
export function explainBestMove(fen, bestUci, score) {
  const res = moveOf(fen, bestUci)
  if (!res) return ''
  const { mv, after } = res

  if (after.isCheckmate()) return `${mv.san} is checkmate — game over.`

  let motif = ''
  if (mv.flags.includes('k') || mv.flags.includes('q')) {
    motif = 'tucks the king to safety by castling'
  } else if (mv.captured) {
    motif = `captures the ${NAMES[mv.captured]}`
    if (mv.flags.includes('e')) motif = 'captures the pawn en passant'
    if (after.inCheck()) motif += ' with check'
  } else if (mv.flags.includes('p')) {
    motif = `promotes to a ${NAMES[mv.promotion] || 'queen'}`
  } else if (after.inCheck()) {
    motif = 'gives check'
  }

  const turn = fen.split(' ')[1]
  const evalStr = fmtWhite(score, turn)
  const where = standing(score, turn)

  const lead = motif ? `${mv.san} ${motif}` : `${mv.san} is the engine's top choice`
  return `${lead}, leaving ${where} (${evalStr}).`
}

// Grade the move the player actually made, comparing the resulting eval to the
// best the position offered.
//   beforeScore: eval at the position BEFORE the move (side-to-move = the mover)
//   afterScore:  eval at the position AFTER the move (side-to-move = opponent)
//   afterPv:     opponent's expected reply line (UCI[]) in the new position
export function gradeMove({
  beforeFen, afterFen, playedUci, playedSan, bestUci,
  beforeScore, afterScore, afterPv, moverTurn,
}) {
  const playedSanStr = playedSan || sanOf(beforeFen, playedUci) || playedUci
  const bestSan = sanOf(beforeFen, bestUci)
  const isBest = bestUci && playedUci.slice(0, 4) === bestUci.slice(0, 4)

  const beforeMoverCp = toCp(beforeScore)
  const afterMoverCp = -toCp(afterScore) // opponent perspective -> mover perspective
  const loss = Math.max(0, beforeMoverCp - afterMoverCp)

  const hadMate = beforeScore?.mate != null && beforeScore.mate > 0
  const nowGettingMated = afterMoverCp <= -(MATE_CP - 10000)
  const keptMate = afterMoverCp >= MATE_CP - 10000

  // Opponent's reply that punishes a hanging piece, if any.
  let hangNote = ''
  if (afterPv?.length) {
    const reply = moveOf(afterFen, afterPv[0])
    if (reply?.mv?.captured && loss >= 100) {
      hangNote = ` It leaves the ${NAMES[reply.mv.captured]} on ${reply.mv.to} hanging to ${reply.mv.san}.`
    }
  }

  // Best-move praise.
  if (isBest || loss <= 20) {
    if (hadMate && keptMate) {
      return { label: 'Best', text: `${playedSanStr} keeps the forced mate going — the engine's top choice.` }
    }
    const lead = isBest
      ? `${playedSanStr} is the engine's top move`
      : `${playedSanStr} is essentially best (within a fraction of a pawn)`
    return { label: 'Best', text: `${lead}.` }
  }

  // Mate swings dominate the verdict.
  if (nowGettingMated) {
    return {
      label: 'Blunder',
      text: `${playedSanStr} walks into a forced mate. ${bestSan ? `${bestSan} was necessary.` : ''}${hangNote}`.trim(),
    }
  }
  if (hadMate && !keptMate) {
    return {
      label: 'Mistake',
      text: `${playedSanStr} lets the forced mate slip. ${bestSan ? `${bestSan} kept it.` : ''}${hangNote}`.trim(),
    }
  }

  let label
  if (loss <= 60) label = 'Good'
  else if (loss <= 120) label = 'Inaccuracy'
  else if (loss <= 250) label = 'Mistake'
  else label = 'Blunder'

  const lossPawns = (loss / 100).toFixed(loss >= 100 ? 1 : 2)
  if (label === 'Good') {
    return { label, text: `${playedSanStr} is fine, only about ${lossPawns} worse than ${bestSan || 'the top move'}.` }
  }
  const why = bestSan ? ` ${bestSan} was stronger.` : ''
  return {
    label,
    text: `${playedSanStr} gives up about ${lossPawns} pawns of advantage.${why}${hangNote}`,
  }
}
