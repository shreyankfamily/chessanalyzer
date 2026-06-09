// Client-side chess-position recognition. No backend, no API key.
//
// Pipeline:
//   1. Load the image onto a canvas.
//   2. Crop to the board region (caller supplies a square crop rect).
//   3. Slice into an 8x8 grid of cells.
//   4. Classify each cell with a small CNN that is TRAINED IN THE BROWSER on
//      synthetically-rendered pieces (Unicode chess glyphs across several
//      fonts/sizes on light & dark squares). This keeps everything self
//      contained — nothing is downloaded and no API key is needed.
//
// Recognition of arbitrary photos is inherently hard without a large trained
// model, so the output is always loaded into an editable board for correction.

import * as tf from '@tensorflow/tfjs'

export const CLASSES = [
  'empty',
  'P', 'N', 'B', 'R', 'Q', 'K', // white
  'p', 'n', 'b', 'r', 'q', 'k', // black
]

const GLYPHS = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
}
const CELL = 32 // model input size (grayscale)

let modelPromise = null

// ---------- Image helpers ----------

export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

// Crop a square region from the image and return an 8x8 array of grayscale
// Float32 tensors (CELL x CELL), normalized to [0,1].
export function sliceBoard(img, rect) {
  const { x, y, size } = rect
  const cellPx = size / 8
  const canvas = document.createElement('canvas')
  canvas.width = CELL
  canvas.height = CELL
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  const cells = []
  for (let r = 0; r < 8; r++) {
    const rowTensors = []
    for (let c = 0; c < 8; c++) {
      ctx.clearRect(0, 0, CELL, CELL)
      ctx.drawImage(
        img,
        x + c * cellPx, y + r * cellPx, cellPx, cellPx,
        0, 0, CELL, CELL
      )
      const data = ctx.getImageData(0, 0, CELL, CELL).data
      rowTensors.push(toGray(data))
    }
    cells.push(rowTensors)
  }
  return cells // [8][8] Float32Array(CELL*CELL)
}

function toGray(rgba) {
  const out = new Float32Array(CELL * CELL)
  for (let i = 0; i < CELL * CELL; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2]
    out[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  }
  return out
}

// ---------- Synthetic training data ----------

function renderGlyph(pieceChar, opts) {
  const { dark, font, scale, dx, dy } = opts
  const canvas = document.createElement('canvas')
  canvas.width = CELL
  canvas.height = CELL
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  // square background (light or dark wood-ish)
  ctx.fillStyle = dark ? '#b58863' : '#f0d9b5'
  ctx.fillRect(0, 0, CELL, CELL)

  if (pieceChar !== 'empty') {
    const isWhite = pieceChar === pieceChar.toUpperCase()
    const glyph = GLYPHS[pieceChar.toUpperCase()]
    const px = Math.round(CELL * scale)
    ctx.font = `${px}px ${font}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // outline + fill so white & black pieces are both visible on any square
    ctx.lineWidth = 1.5
    if (isWhite) {
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#202020'
    } else {
      ctx.fillStyle = '#202020'
      ctx.strokeStyle = '#000000'
    }
    const cx = CELL / 2 + dx
    const cy = CELL / 2 + dy
    ctx.fillText(glyph, cx, cy)
    ctx.strokeText(glyph, cx, cy)
  }

  const data = ctx.getImageData(0, 0, CELL, CELL).data
  return toGray(data)
}

function buildDataset() {
  const fonts = ['serif', 'sans-serif', '"Arial Unicode MS"']
  const scales = [0.7, 0.8, 0.9]
  const jitters = [0, -1, 1]
  const xs = []
  const ys = []
  CLASSES.forEach((cls, idx) => {
    const variants = cls === 'empty' ? [null] : fonts
    for (const font of variants) {
      for (const scale of scales) {
        for (const dx of jitters) {
          for (const dy of jitters) {
            for (const dark of [false, true]) {
              const sample = renderGlyph(cls, {
                dark, font: font || 'serif', scale, dx, dy,
              })
              xs.push(sample)
              ys.push(idx)
            }
          }
        }
      }
    }
  })
  return { xs, ys }
}

// ---------- Model ----------

function buildModel() {
  const model = tf.sequential()
  model.add(tf.layers.conv2d({
    inputShape: [CELL, CELL, 1], filters: 16, kernelSize: 3, activation: 'relu',
  }))
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }))
  model.add(tf.layers.conv2d({ filters: 32, kernelSize: 3, activation: 'relu' }))
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }))
  model.add(tf.layers.flatten())
  model.add(tf.layers.dense({ units: 64, activation: 'relu' }))
  model.add(tf.layers.dropout({ rate: 0.2 }))
  model.add(tf.layers.dense({ units: CLASSES.length, activation: 'softmax' }))
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'sparseCategoricalCrossentropy',
    metrics: ['accuracy'],
  })
  return model
}

// Train the model once; cached for the session.
export function getModel(onProgress) {
  if (modelPromise) return modelPromise
  modelPromise = (async () => {
    const { xs, ys } = buildDataset()
    const n = xs.length
    const xTensor = tf.tensor4d(
      flatten(xs), [n, CELL, CELL, 1]
    )
    const yTensor = tf.tensor1d(ys, 'int32')
    const model = buildModel()
    await model.fit(xTensor, yTensor, {
      epochs: 12,
      batchSize: 64,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (onProgress) onProgress((epoch + 1) / 12, logs)
        },
      },
    })
    xTensor.dispose()
    yTensor.dispose()
    return model
  })()
  return modelPromise
}

function flatten(arrs) {
  const out = new Float32Array(arrs.length * CELL * CELL)
  arrs.forEach((a, i) => out.set(a, i * CELL * CELL))
  return out
}

// Classify all 64 cells. Returns { board: [8][8] pieceChar|'', confidences }.
export async function classifyBoard(cells, model) {
  const flat = []
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) flat.push(cells[r][c])
  const input = tf.tensor4d(flatten(flat), [64, CELL, CELL, 1])
  const preds = model.predict(input)
  const probs = await preds.array()
  input.dispose()
  preds.dispose()

  const board = []
  const confidences = []
  let k = 0
  for (let r = 0; r < 8; r++) {
    const row = []
    const crow = []
    for (let c = 0; c < 8; c++) {
      const p = probs[k++]
      let best = 0
      for (let i = 1; i < p.length; i++) if (p[i] > p[best]) best = i
      const cls = CLASSES[best]
      row.push(cls === 'empty' ? '' : cls)
      crow.push(p[best])
    }
    board.push(row)
    confidences.push(crow)
  }
  return { board, confidences }
}
