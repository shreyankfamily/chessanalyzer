# ChessAnalyzer

A static, browser-only chess position scanner & analyzer — a GitHub Pages
clone of the Chessvision.ai workflow, plus a ChessTempo browser-extension
bridge.

**Live app:** `https://shreyankfamily.github.io/chessanalyzer/`

## Features

- **📷 Scan a board image → FEN.** Client-side only. A small CNN is trained in
  your browser (TensorFlow.js) on synthetic piece renders — no API key, no
  server, nothing uploaded. Works best on clean digital diagrams; results drop
  into an editable board so you can fix any misreads.
- **♟ Stockfish engine, in-browser.** Toggle the engine to get the best move
  (drawn as an arrow), evaluation, and principal variation. Uses a
  single-threaded build so it runs on GitHub Pages (no COOP/COEP headers
  needed).
- **Open analysis anywhere.** One tap to load the current position into
  **Lichess**, **Chess.com**, or **ChessTempo**.
- **FEN / PGN** load, edit, and copy. Swap side-to-move, flip, reset, clear.
- **ChessTempo bridge extension.** Reads the *live position from ChessTempo's
  DOM* (exact — no screenshot/vision) and opens it here for analysis.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173/chessanalyzer/
npm run build    # outputs to dist/
```

## Deploy (GitHub Pages)

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and
publishes to Pages. One-time setup in the repo:

**Settings → Pages → Build and deployment → Source = "GitHub Actions".**

The Vite `base` is set to `/chessanalyzer/` in `vite.config.js`; change it if
you rename the repo.

## ChessTempo extension

The `extension/` folder is a Manifest V3 extension (Chrome/Edge/Brave).

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
   select the `extension/` folder.
2. Open any board on chesstempo.com. A floating **"Analyze in ChessAnalyzer"**
   button appears (or use the toolbar popup).
3. It reads the FEN straight from the page and opens it in the app via
   `?fen=...`.

> Note: ChessTempo's markup changes over time. `extension/extract.js` tries
> several strategies (copy-FEN fields, inline-script FEN, board DOM). If a
> redesign breaks detection, the selectors there are where to adjust.

## How the scan works

`src/lib/scan.js`: crop the board → slice into 64 cells → grayscale 32×32 →
classify each with a CNN trained in-browser on Unicode chess glyphs rendered
across several fonts/sizes on light & dark squares. Self-contained and free,
but not as accurate as a large pretrained model — hence the always-editable
correction step.
