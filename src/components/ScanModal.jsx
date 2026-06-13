import { useEffect, useRef, useState } from 'react'
import { fileToImage, sliceBoard, getModel, classifyBoard } from '../lib/scan.js'
import { boardToPlacement } from '../lib/fen.js'
import { Chessboard } from 'react-chessboard'

const DISPLAY_W = 320

export default function ScanModal({ onClose, onApply, initialImage }) {
  const [img, setImg] = useState(null)
  const [rect, setRect] = useState(null) // {x,y,size} in natural px
  const [status, setStatus] = useState('') // '', 'training', 'classifying', 'done'
  const [progress, setProgress] = useState(0)
  const [resultFen, setResultFen] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  function loadImageEl(image) {
    setError('')
    setResultFen(null)
    setStatus('')
    setImg(image)
    const size = Math.min(image.naturalWidth, image.naturalHeight)
    setRect({
      x: Math.round((image.naturalWidth - size) / 2),
      y: Math.round((image.naturalHeight - size) / 2),
      size,
    })
  }

  // Pre-load an image handed over by the browser extension (a ChessTempo
  // screenshot). The user then adjusts the crop box like any uploaded image.
  useEffect(() => {
    if (!initialImage) return
    const image = new Image()
    image.onload = () => loadImageEl(image)
    image.onerror = () => setError('Could not load the screenshot.')
    image.src = initialImage
  }, [initialImage])

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const image = await fileToImage(file)
      loadImageEl(image)
    } catch {
      setError('Could not load that image.')
    }
  }

  const scale = img ? DISPLAY_W / img.naturalWidth : 1
  const dispH = img ? img.naturalHeight * scale : 0

  function update(key, val) {
    setRect((r) => {
      const next = { ...r, [key]: val }
      // keep the square inside the image
      next.size = Math.min(next.size, img.naturalWidth, img.naturalHeight)
      next.x = Math.max(0, Math.min(next.x, img.naturalWidth - next.size))
      next.y = Math.max(0, Math.min(next.y, img.naturalHeight - next.size))
      return next
    })
  }

  async function runScan() {
    if (!img || !rect) return
    setError('')
    try {
      setStatus('training')
      setProgress(0)
      const model = await getModel((p) => setProgress(p))
      setStatus('classifying')
      const cells = sliceBoard(img, rect)
      const { board } = await classifyBoard(cells, model)
      const placement = boardToPlacement(board)
      setResultFen(placement)
      setStatus('done')
    } catch (err) {
      console.error(err)
      setError('Scan failed: ' + err.message)
      setStatus('')
    }
  }

  const previewFen = resultFen ? `${resultFen} w - - 0 1` : null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2 style={{ margin: 0 }}>Scan position</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        {!img && (
          <div className="center" style={{ padding: '24px 0' }}>
            <p className="muted">Upload a photo or screenshot of a chess board.</p>
            <button className="btn primary" onClick={() => fileRef.current.click()}>
              📷 Choose image
            </button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onFile}
        />

        {img && !resultFen && (
          <>
            <p className="muted">Drag the sliders so the box hugs the 8×8 board.</p>
            <div
              style={{
                position: 'relative',
                width: DISPLAY_W,
                height: dispH,
                margin: '0 auto',
                background: '#000',
              }}
            >
              <img
                src={img.src}
                width={DISPLAY_W}
                height={dispH}
                alt="board"
                style={{ display: 'block' }}
              />
              {rect && (
                <div
                  style={{
                    position: 'absolute',
                    left: rect.x * scale,
                    top: rect.y * scale,
                    width: rect.size * scale,
                    height: rect.size * scale,
                    border: '2px solid #3b82f6',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
            <div className="slider-controls">
              <Slider label="X" value={rect.x} max={img.naturalWidth} onChange={(v) => update('x', v)} />
              <Slider label="Y" value={rect.y} max={img.naturalHeight} onChange={(v) => update('y', v)} />
              <Slider label="Size" value={rect.size} max={Math.min(img.naturalWidth, img.naturalHeight)} onChange={(v) => update('size', v)} />
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn outline sm" onClick={() => fileRef.current.click()}>
                Change image
              </button>
              <button className="btn primary block" onClick={runScan} disabled={status === 'training' || status === 'classifying'}>
                {status === 'training' && <><span className="spinner" /> Training model… {Math.round(progress * 100)}%</>}
                {status === 'classifying' && <><span className="spinner" /> Reading board…</>}
                {!status && '🔍 Scan position'}
              </button>
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              First scan trains a small model in your browser (~a few seconds). Recognition is
              best on clean digital diagrams — you can fix any misreads on the next screen.
            </p>
          </>
        )}

        {previewFen && (
          <>
            <p className="muted">Recognized position — review &amp; apply, then correct on the board if needed.</p>
            <div style={{ width: 280, margin: '0 auto' }}>
              <Chessboard position={previewFen} arePiecesDraggable={false} boardWidth={280} />
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn outline sm" onClick={() => { setResultFen(null); setStatus('') }}>
                Re-crop
              </button>
              <button className="btn primary block" onClick={() => onApply(resultFen)}>
                ✓ Use this position
              </button>
            </div>
          </>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}

function Slider({ label, value, max, onChange }) {
  return (
    <label className="slider-row">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
      />
    </label>
  )
}
