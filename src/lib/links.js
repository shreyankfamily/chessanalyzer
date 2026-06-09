// Build "open analysis" URLs for external sites from a FEN.

export function lichessUrl(fen) {
  // Lichess wants the FEN in the path with spaces as underscores and the
  // rank slashes kept literal (NOT percent-encoded).
  return `https://lichess.org/analysis/${fen.trim().replace(/ /g, '_')}`
}

export function chessComUrl(fen) {
  return `https://www.chess.com/analysis?fen=${encodeURIComponent(fen)}&flip=false`
}

export function chessTempoUrl(fen) {
  // ChessTempo board editor / analysis loads a position from the `fen` param.
  return `https://chesstempo.com/board-editor/${encodeURIComponent(fen)}`
}
