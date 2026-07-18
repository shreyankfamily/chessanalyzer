# ChessAnalyzer project guidance

Static React/Vite chess-position scanner and analyzer deployed on GitHub Pages.
The scanner, TensorFlow model, and Stockfish engine run entirely in the browser.

## Working rules

- Use `npm run dev` for local development and `npm run build` for production
  verification.
- Keep the Vite base path `/chessanalyzer/` unless the repository is renamed.
- Preserve the browser-only architecture: board images and positions should
  not be uploaded to a server unless the user explicitly requests a new
  service.
- The ChessTempo/Lichess bridge lives in `extension/`. When a site redesign
  breaks detection, update the extraction strategies there and retain the
  screenshot fallback.
- Treat scanner output as editable assistance rather than guaranteed piece
  recognition; clean digital diagrams are the strongest input.

## Verification and delivery

- Run `npm run build` after code or configuration changes.
- Pushes to `main` deploy through `.github/workflows/deploy.yml`.
- Do not use the legacy `npm run deploy` path unless explicitly requested or
  the GitHub Actions deployment is unavailable.

## Optional local history

If `.agents/memory/MEMORY.md` exists locally, it contains migrated historical
context. Consult only relevant entries and validate dated details against the
current code before acting on them.
