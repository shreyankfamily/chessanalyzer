import { useEffect, useRef, useState, useCallback } from 'react'
import { Engine } from './engine.js'
import { getTurn } from './fen.js'

// Hook that owns a Stockfish instance and analyzes `fen` whenever enabled.
export function useEngine(fen, enabled) {
  const engineRef = useRef(null)
  const [info, setInfo] = useState(null) // { depth, scoreCp, scoreMate, pv }
  const [bestMove, setBestMove] = useState(null) // UCI string e.g. 'e2e4'
  const [thinking, setThinking] = useState(false)

  // Lazily create the engine.
  const ensureEngine = useCallback(() => {
    if (!engineRef.current) {
      const eng = new Engine()
      eng.onInfo = (i) => setInfo(i)
      eng.onBestMove = (best) => {
        setBestMove(best && best !== '(none)' ? best : null)
        setThinking(false)
      }
      eng.start()
      engineRef.current = eng
    }
    return engineRef.current
  }, [])

  useEffect(() => {
    if (!enabled) {
      if (engineRef.current) engineRef.current.halt()
      setThinking(false)
      return
    }
    const eng = ensureEngine()
    setInfo(null)
    setBestMove(null)
    setThinking(true)
    eng.analyze(fen, { depth: 20, movetimeMs: 2500 })
  }, [fen, enabled, ensureEngine])

  // Tear down on unmount.
  useEffect(() => () => engineRef.current?.stop(), [])

  // Normalize eval to White's perspective for display.
  const turn = getTurn(fen)
  let evalText = null
  if (info) {
    if (info.scoreMate != null) {
      const m = turn === 'w' ? info.scoreMate : -info.scoreMate
      evalText = `#${m}`
    } else if (info.scoreCp != null) {
      const cp = turn === 'w' ? info.scoreCp : -info.scoreCp
      const v = (cp / 100).toFixed(2)
      evalText = cp > 0 ? `+${v}` : `${v}`
    }
  }

  return { info, bestMove, thinking, evalText, turn }
}
