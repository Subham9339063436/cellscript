# Deploy CellScript to Vercel

This directory is the Vercel project root. It contains the Vite React app plus two Vercel Node.js Functions, so the deployed UI does not call localhost.

## Git integration deployment

1. In Vercel, choose **Add New → Project** and import `Subham9339063436/cellscript`.
2. Select the `phase-2-implementation` branch while the Phase 2 pull request is under review.
3. Set **Root Directory** to `frontend`.
4. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`. Install command: `npm install`.
5. No environment variables are required for the same-origin Vercel API. Deploy.
6. Once deployment finishes, test the website root and `/api/health`. In the UI, edit a formula and ensure values recalculate and formula errors are highlighted.

## Vercel CLI alternative

With Node.js and the Vercel CLI installed and authenticated:

```bash
cd frontend
npm install
npx vercel link
npx vercel deploy
npx vercel deploy --prod
```

The CLI may ask to select a team/scope and confirm the project settings.

## Routes

- `/` — React spreadsheet interface.
- `/api/health` — JSON health check.
- `/api/evaluate` — POST workbook JSON, returns `values`, `errors` and `evaluationOrder`.

## Runtime note

Vercel runs the frontend as Vite-built static assets and runs the same formula-language behavior in TypeScript serverless functions. The C++17 compiler/evaluator remains in the repository for the compiler-design implementation and command-line/API use outside Vercel. The Vercel API does not execute the C++ binary.
