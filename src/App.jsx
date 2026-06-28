import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { START_FEN, EMPTY_FEN, withTurn, getTurn } from './lib/fen.js'
import { lichessUrl, chessComUrl, chessTempoUrl } from './lib/links.js'
import { useEngine } from './lib/useEngine.js'
import { pvToSan } from './lib/pv.js'
import { explainBestMove, gradeMove } from './lib/explain.js'

// Code-split: TensorFlow.js (~1.4MB) only loads when the user opens the scanner.
const ScanModal = lazy(() => import('./components/ScanModal.jsx'))

function isLegalFen(fen) {
  try {
    new Chess(fen)
    return true
  } catch {
    return false
  }
}

export default function App() {
  const [fen, setFen] = useState(START_FEN)
  const [orientation, setOrientation] = useState('white')
  const [engineOn, setEngineOn] = useState(true)
  const [showScan, setShowScan] = useState(false)
  const [scanImage, setScanImage] = useState(null) // dataURL from extension
  const [moveFrom, setMoveFrom] = useState('') // click-to-move source square
  const [optionSquares, setOptionSquares] = useState({}) // highlight styles
  const [lastPlayed, setLastPlayed] = useState(null) // snapshot at move time
  const [moveGrade, setMoveGrade] = useState(null) // { label, text }
  const [fenInput, setFenInput] = useState(START_FEN)
  const [pgnInput, setPgnInput] = useState('')
  const [boardWidth, setBoardWidth] = useState(360)
  const [moveHistory, setMoveHistory] = useState([START_FEN]) // track all positions
  const [moveIndex, setMoveIndex] = useState(0) // current position in history

  // Load a position passed by the ChessTempo extension via ?fen=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const qf = params.get('fen')
    if (qf) {
      const decoded = decodeURIComponent(qf)
      setFen(decoded)
      setFenInput(decoded)
      setMoveHistory([decoded])
      setMoveIndex(0)
      // Auto-flip board based on whose turn it is
      const turn = getTurn(decoded)
      setOrientation(turn === 'w' ? 'white' : 'black')
    }
  }, [])

  // The ChessTempo extension hands over a page screenshot via postMessage
  // (its bridge content script forwards it once the app has loaded).
  useEffect(() => {
    function onMsg(e) {
      if (e.source !== window) return
      if (e.data?.type === 'CHESSANALYZER_SCAN_IMAGE' && e.data.dataUrl) {
        setScanImage(e.data.dataUrl)
        setShowScan(true)
      } else if (e.data?.type === 'CHESSANALYZER_AUTO_UPDATE' && e.data.fen) {
        // Auto-update from extension when page changes
        const newFen = e.data.fen
        setFen(newFen)
        setFenInput(newFen)
        setMoveFrom('')
        setOptionSquares({})
        setLastPlayed(null)
        setMoveGrade(null)
        setMoveHistory([newFen])
        setMoveIndex(0)
        // Auto-flip board based on whose turn it is
        const moveTurn = getTurn(newFen)
        setOrientation(moveTurn === 'w' ? 'white' : 'black')
      }
    }
    window.addEventListener('message', onMsg)
    // Signal the bridge that the app is ready to receive an image.
    window.postMessage({ type: 'CHESSANALYZER_READY' }, '*')
    return () => window.removeEventListener('message', onMsg)
  }, [])

  useEffect(() => {
    const fit = () => setBoardWidth(Math.min(window.innerWidth - 32, 480))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  const legal = useMemo(() => isLegalFen(fen), [fen])
  const { bestMove, thinking, evalText, info } = useEngine(
    fen,
    engineOn && legal
  )

  const turn = getTurn(fen)

  const bestArrow = useMemo(() => {
    if (!bestMove || bestMove.length < 4) return []
    return [[bestMove.slice(0, 2), bestMove.slice(2, 4), 'rgb(0, 128, 0)']]
  }, [bestMove])

  const pvText = useMemo(() => {
    if (!info?.pv?.length || !legal) return ''
    return pvToSan(fen, info.pv)
  }, [info, fen, legal])

  // Why is the engine's recommended move best? Wait for a stable depth so we
  // don't flash a misleading shallow eval.
  const bestExplanation = useMemo(() => {
    if (!bestMove || !legal || !info) return ''
    const settled = info.scoreMate != null || (info.depth ?? 0) >= 10
    if (!settled) return ''
    return explainBestMove(fen, bestMove, { cp: info.scoreCp, mate: info.scoreMate })
  }, [fen, bestMove, info, legal])

  // Grade the move the player just made, once the engine has evaluated the
  // resulting position to a stable depth.
  useEffect(() => {
    if (!engineOn || !lastPlayed) return
    if (fen !== lastPlayed.afterFen) return // info must be for the new position
    if (!lastPlayed.beforeScore || !info) return
    const settled = info.scoreMate != null || (info.depth ?? 0) >= 12
    if (!settled) return
    setMoveGrade(
      gradeMove({
        beforeFen: lastPlayed.beforeFen,
        afterFen: lastPlayed.afterFen,
        playedUci: lastPlayed.playedUci,
        playedSan: lastPlayed.playedSan,
        bestUci: lastPlayed.bestUci,
        beforeScore: lastPlayed.beforeScore,
        afterScore: { cp: info.scoreCp, mate: info.scoreMate },
        afterPv: info.pv,
        moverTurn: lastPlayed.moverTurn,
      })
    )
  }, [info, fen, lastPlayed, engineOn])

  // Shared by drag-and-drop and click-to-move.
  function tryMove(from, to) {
    if (!legal) return false
    const game = new Chess(fen)
    try {
      const move = game.move({ from, to, promotion: 'q' })
      if (!move) return false
      const nf = game.fen()
      // Snapshot the engine's read of THIS position so we can grade the move
      // once the engine evaluates the resulting one.
      setLastPlayed({
        beforeFen: fen,
        afterFen: nf,
        playedUci: from + to + (move.promotion || ''),
        playedSan: move.san,
        bestUci: bestMove,
        beforeScore: info ? { cp: info.scoreCp, mate: info.scoreMate } : null,
        moverTurn: turn,
      })
      setMoveGrade(null)
      // Update move history
      const newHistory = moveHistory.slice(0, moveIndex + 1)
      newHistory.push(nf)
      setMoveHistory(newHistory)
      setMoveIndex(newHistory.length - 1)
      setFen(nf)
      setFenInput(nf)
      return true
    } catch {
      return false
    }
  }

  function onPieceDrop(from, to) {
    const ok = tryMove(from, to)
    if (ok) clearSelection()
    return ok
  }

  function clearSelection() {
    setMoveFrom('')
    setOptionSquares({})
  }

  // Highlight a clicked piece and its legal destination squares.
  function getMoveOptions(square) {
    if (!legal) return false
    const game = new Chess(fen)
    let moves = []
    try {
      moves = game.moves({ square, verbose: true })
    } catch {
      moves = []
    }
    if (!moves.length) {
      setOptionSquares({})
      return false
    }
    const squares = {}
    for (const m of moves) {
      squares[m.to] = {
        background:
          'radial-gradient(circle, rgba(0,0,0,0.25) 24%, transparent 26%)',
        borderRadius: '50%',
      }
    }
    squares[square] = { background: 'rgba(255, 235, 59, 0.5)' }
    setOptionSquares(squares)
    return true
  }

  // Tap source square, then tap destination.
  function onSquareClick(square) {
    if (!legal) return
    if (!moveFrom) {
      if (getMoveOptions(square)) setMoveFrom(square)
      return
    }
    if (tryMove(moveFrom, square)) {
      clearSelection()
      return
    }
    // The move was illegal — treat the click as selecting a new source.
    if (getMoveOptions(square)) setMoveFrom(square)
    else clearSelection()
  }

  function applyFen(newFen) {
    setFen(newFen)
    setFenInput(newFen)
    setMoveFrom('')
    setOptionSquares({})
    setLastPlayed(null)
    setMoveGrade(null)
    // Reset move history when a new position is loaded
    setMoveHistory([newFen])
    setMoveIndex(0)
  }

  function applyPlacement(placement) {
    const full = `${placement} ${turn} - - 0 1`
    applyFen(full)
    setShowScan(false)
  }

  function loadFenInput() {
    const v = fenInput.trim()
    if (!v) return
    applyFen(v)
  }

  function loadPgn() {
    const game = new Chess()
    try {
      game.loadPgn(pgnInput)
      const nf = game.fen()
      applyFen(nf)
    } catch {
      alert('Could not parse that PGN.')
    }
  }

  function toggleTurn() {
    const nf = withTurn(fen, turn === 'w' ? 'b' : 'w')
    applyFen(nf)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>ChessAnalyzer</h1>
        <p>Scan, analyze &amp; open positions anywhere</p>
      </header>

      <div className="content">
        {/* Board */}
        <div className="panel">
          <div className="row between" style={{ marginBottom: 10 }}>
            <span className="turn-pill">{turn === 'w' ? 'White' : 'Black'} to move</span>
            {!legal && <span className="error">Illegal position — fix to analyze</span>}
          </div>
          <div style={{ margin: '0 auto', width: boardWidth }}>
            <Chessboard
              position={fen}
              boardOrientation={orientation}
              boardWidth={boardWidth}
              onPieceDrop={onPieceDrop}
              onSquareClick={onSquareClick}
              customSquareStyles={optionSquares}
              customArrows={engineOn ? bestArrow : []}
              arePiecesDraggable={legal}
            />
          </div>
          <div className="toolbar" style={{ marginTop: 10 }}>
            <button className="icon-btn" title="Back" onClick={() => {
              if (moveIndex > 0) {
                const newIndex = moveIndex - 1
                setMoveIndex(newIndex)
                setFen(moveHistory[newIndex])
                setFenInput(moveHistory[newIndex])
                setMoveFrom('')
                setOptionSquares({})
              }
            }} disabled={moveIndex === 0}>◀</button>
            <button className="icon-btn" title="Forward" onClick={() => {
              if (moveIndex < moveHistory.length - 1) {
                const newIndex = moveIndex + 1
                setMoveIndex(newIndex)
                setFen(moveHistory[newIndex])
                setFenInput(moveHistory[newIndex])
                setMoveFrom('')
                setOptionSquares({})
              }
            }} disabled={moveIndex === moveHistory.length - 1}>▶</button>
            <button className="icon-btn" title="Flip board" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>⇅</button>
            <button className="icon-btn" title="Swap side to move" onClick={toggleTurn}>♟⇄</button>
            <button className="icon-btn" title="Starting position" onClick={() => applyFen(START_FEN)}>⟲</button>
            <button className="icon-btn" title="Clear board" onClick={() => applyFen(EMPTY_FEN)}>▢</button>
          </div>
        </div>

        {/* Scan */}
        <button className="btn primary block" onClick={() => { setScanImage(null); setShowScan(true) }}>
          📷 Scan a board image
        </button>

        {/* Engine */}
        <div className="panel">
          <div className="row between">
            <div className="engine-toggle">
              <label className="switch">
                <input type="checkbox" checked={engineOn} onChange={(e) => setEngineOn(e.target.checked)} />
                <span className="slider" />
              </label>
              <div>
                <div style={{ fontWeight: 600 }}>Stockfish</div>
                <div className="muted">in your browser</div>
              </div>
            </div>
            <div className="eval-bar">
              {engineOn ? (evalText ?? (thinking ? '…' : '')) : ''}
            </div>
          </div>
          {engineOn && (
            <div style={{ marginTop: 10 }}>
              <div className="bestmove">
                {bestMove ? (
                  <>Best move: <strong>{bestMove.slice(0, 2)}→{bestMove.slice(2, 4)}</strong>{info?.depth ? ` (depth ${info.depth})` : ''}</>
                ) : (
                  <span className="muted">{thinking ? 'Thinking…' : 'No move'}</span>
                )}
              </div>
              {bestExplanation && (
                <div className="explain" style={{ marginTop: 6 }}>{bestExplanation}</div>
              )}
              {pvText && <div className="eval-line" style={{ marginTop: 6 }}>{pvText}</div>}
            </div>
          )}

          {engineOn && lastPlayed && (
            <div className={`grade grade-${(moveGrade?.label || 'pending').toLowerCase()}`} style={{ marginTop: 12 }}>
              {moveGrade ? (
                <><span className="grade-label">{moveGrade.label}</span> {moveGrade.text}</>
              ) : (
                <span className="muted">Evaluating your move…</span>
              )}
            </div>
          )}
        </div>

        {/* Open in */}
        <div className="panel">
          <h2>Open analysis in</h2>
          <div className="links">
            <a className="link-btn" href={lichessUrl(fen)} target="_blank" rel="noreferrer">Lichess<small>analysis</small></a>
            <a className="link-btn" href={chessComUrl(fen)} target="_blank" rel="noreferrer">Chess.com<small>analysis</small></a>
            <a className="link-btn" href={chessTempoUrl(fen)} target="_blank" rel="noreferrer">ChessTempo<small>board editor</small></a>
          </div>
        </div>

        {/* FEN / PGN */}
        <div className="panel">
          <h2>FEN</h2>
          <textarea rows={2} value={fenInput} onChange={(e) => setFenInput(e.target.value)} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn ghost sm" onClick={loadFenInput}>Set FEN</button>
            <button className="btn outline sm" onClick={() => navigator.clipboard?.writeText(fen)}>Copy FEN</button>
          </div>

          <h2 style={{ marginTop: 16 }}>PGN</h2>
          <textarea rows={3} value={pgnInput} onChange={(e) => setPgnInput(e.target.value)} placeholder="Paste PGN to load final position…" />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn ghost sm" onClick={loadPgn}>Set PGN</button>
          </div>
        </div>

        <p className="muted center" style={{ paddingBottom: 24 }}>
          Runs fully in your browser · No data leaves your device
        </p>
      </div>

      {showScan && (
        <Suspense fallback={<div className="modal-backdrop"><div className="modal center"><span className="spinner" style={{ borderColor: '#3b82f6', borderTopColor: 'transparent' }} /> Loading scanner…</div></div>}>
          <ScanModal
            initialImage={scanImage}
            onClose={() => { setShowScan(false); setScanImage(null) }}
            onApply={applyPlacement}
          />
        </Suspense>
      )}
    </div>
  )
}
