// Build "open analysis" URLs for external sites from a FEN.

export function lichessUrl(fen) {
  // Lichess analysis board accepts the FEN in the path (spaces -> underscores).
  return `https://lichess.org/analysis/${encodeURIComponent(fen)}`
}

export function chessComUrl(fen) {
  return `https://www.chess.com/analysis?fen=${encodeURIComponent(fen)}&flip=false`
}

export function chessTempoUrl(fen) {
  // ChessTempo board editor / analysis loads a position from the `fen` param.
  return `https://chesstempo.com/board-editor/${encodeURIComponent(fen)}`
}
