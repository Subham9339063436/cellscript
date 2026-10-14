# Deploy CellScript to Vercel

**Live application:** https://cellscript.vercel.app  
**API health:** https://cellscript.vercel.app/api/health  
**Evaluation smoke test:** https://cellscript.vercel.app/api/evaluate?diagnostic=1

This directory is the Vercel project root when the repository is imported with Root Directory set to `frontend`. It contains the Vite/React application and two Vercel Node.js Functions. The deployed interface calls same-origin API routes; it must not call the developer's `localhost:8080`.

## Git integration deployment

1. In Vercel, choose **Add New → Project** and import [`Subham9339063436/cellscript`](https://github.com/Subham9339063436/cellscript).
2. For the full Phase 2 application, select the `phase-2-implementation` branch or the merged default branch.
3. Set **Root Directory** to `frontend`.
4. Framework preset: **Vite**.
5. Build command: `npm run build`; output directory: `dist`; install command: `npm install`.
6. Do not set `VITE_API_URL` to localhost for production. The production frontend uses same-origin `/api/health` and `/api/evaluate` routes.
7. Deploy. Verify the health route, then open the evaluation smoke test. Finally, edit a formula in the app and check the Profit column and Compiler workbench.

## Vercel CLI alternative

With Node.js and the Vercel CLI installed and authenticated:

```bash
cd frontend
npm install
npx vercel link
npx vercel deploy
npx vercel deploy --prod
```

The CLI may ask you to select a team/scope and confirm project settings.

## Routes

- `/` — React spreadsheet interface.
- `GET /api/health` — JSON health check. This verifies the health handler only; it does not prove formula evaluation works.
- `POST /api/evaluate` — accepts a workbook JSON object and returns values, cell errors, evaluation order, tokens, ASTs and dependency lists.
- `GET /api/evaluate?diagnostic=1` — smoke test for arithmetic, range functions, AST generation and tokens.

## Runtime architecture

Vercel serves Vite-built static assets and the TypeScript evaluator in serverless functions. The C++17 compiler/evaluator and native socket API remain in the repository for local compiler-design work, command-line use and local API tests. The hosted Vercel API does not launch the C++ binary, and it does not depend on a process running on the developer's computer.

## Troubleshooting

- If the site itself does not load, inspect the Vercel deployment build and domain assignment.
- If `/api/health` succeeds but the UI says **Engine offline**, check `POST /api/evaluate`: health and evaluation are separate functions.
- The frontend displays an **API request failed** diagnostic with the returned HTTP status and response detail.
- If a Git-based deployment fails with `npm install`/directory errors, verify that Vercel's **Root Directory** is `frontend` and that `package.json` exists at that root.
