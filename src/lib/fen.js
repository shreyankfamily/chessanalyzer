// FEN helpers.

export const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
export const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1'

// Build a placement-only FEN string (the first field) from an 8x8 array.
// board[0] = rank 8 (top), board[7] = rank 1 (bottom). Each cell is a piece
// char (e.g. 'P','n') or '' / null for empty.
export function boardToPlacement(board) {
  return board
    .map((row) => {
      let out = ''
      let empty = 0
      for (const cell of row) {
        if (!cell) {
          empty++
        } else {
          if (empty) {
            out += empty
            empty = 0
          }
          out += cell
        }
      }
      if (empty) out += empty
      return out
    })
    .join('/')
}

// Compose a full FEN from a placement + options.
export function composeFen(
  placement,
  { turn = 'w', castling = '-', ep = '-', half = 0, full = 1 } = {}
) {
  return `${placement} ${turn} ${castling} ${ep} ${half} ${full}`
}

// Swap the side-to-move field of a full FEN.
export function withTurn(fen, turn) {
  const parts = fen.split(' ')
  parts[1] = turn
  return parts.join(' ')
}

export function getTurn(fen) {
  return fen.split(' ')[1] || 'w'
}

// Validate placement has exactly 8 ranks of 8 files.
export function isValidPlacement(placement) {
  const ranks = placement.split('/')
  if (ranks.length !== 8) return false
  return ranks.every((r) => {
    let count = 0
    for (const ch of r) {
      if (/\d/.test(ch)) count += parseInt(ch, 10)
      else if (/[prnbqkPRNBQK]/.test(ch)) count += 1
      else return false
    }
    return count === 8
  })
}
