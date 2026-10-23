# CellScript — Spreadsheet Formula Compiler

[![CI](https://github.com/Subham9339063436/cellscript/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Subham9339063436/cellscript/actions/workflows/ci.yml)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-000000?logo=vercel)](https://cellscript.vercel.app)

**Live application:** [https://cellscript.vercel.app](https://cellscript.vercel.app)  
**API health:** [https://cellscript.vercel.app/api/health](https://cellscript.vercel.app/api/health)  
**Repository:** [Subham9339063436/cellscript](https://github.com/Subham9339063436/cellscript)

CellScript is a spreadsheet-style formula compiler and evaluator built for Compiler Design. It combines a C++17 lexer, recursive-descent parser, abstract syntax tree (AST), dependency analysis and evaluator with a React/TypeScript spreadsheet dashboard. The Compiler workbench exposes the stages of formula processing so you can inspect tokens, the visual AST, cell dependencies and computed results.

## Features

### Spreadsheet dashboard
- Excel-inspired grid, formula bar, cell selection and direct cell editing.
- Sample stock-details workbook with calculated profit and summary formulas.
- Live recalculation, formula errors and cell-reference feedback.
- Browser autosave, undo/redo, formula display and grid/view controls.
- CSV export and a simple chart view.

### Compiler workbench
- **Lexical analysis:** token stream, token types and source positions.
- **AST parsing:** graphical node-and-connector tree, with distinct styles for operators, functions, cell references, ranges and numeric literals.
- **Dependency resolution:** formula-to-cell references, including ranges.
- **Evaluation:** calculation order, computed values and cell-specific errors.

### Formula language
Supports numeric literals, cell references (for example `A1` or `AA12`), rectangular ranges, parentheses, unary minus and the arithmetic operators `+`, `-`, `*` and `/`.

Supported functions:
- `SUM(range)`
- `AVG(range)` and `AVERAGE(range)`
- `MAX(range)`
- `MIN(range)`
- `COUNT(range)`

The evaluator resolves dependencies before their dependants and detects circular references. It reports issues such as missing direct references, invalid formulas and division by zero. Blank cells inside aggregate ranges are ignored; `COUNT` counts populated numeric cells. Range expansion is limited to 100,000 cells.

## Live demo and hosted API

The deployed frontend and Vercel API are served from the same origin:

| Route | Purpose |
|---|---|
| [`/`](https://cellscript.vercel.app) | Spreadsheet dashboard |
| [`/api/health`](https://cellscript.vercel.app/api/health) | Health-check endpoint |
| `POST /api/evaluate` | Evaluate a workbook and return values, errors, token streams, AST text and dependencies |
| [`/api/evaluate?diagnostic=1`](https://cellscript.vercel.app/api/evaluate?diagnostic=1) | Browser-accessible smoke test for arithmetic, range functions, AST generation and tokens |

The hosted application does **not** depend on a C++ process running on your laptop. The C++ engine and native HTTP server are available for local development; the Vercel deployment uses serverless API handlers so hosted calculations can run independently.

## Tech stack

- **Compiler / native API:** C++17, Make, POSIX sockets.
- **Spreadsheet UI:** React 18, TypeScript, Vite and CSS.
- **Hosted API:** Vercel serverless functions.
- **Tests / automation:** C++ evaluator tests, Python/pytest API and regression tests, GitHub Actions.

## Run locally

### Requirements
- C++17 compiler and Make (Clang or GCC).
- Python 3 and `pytest`.
- Node.js and npm.

### 1. Clone and build

```bash
git clone https://github.com/Subham9339063436/cellscript.git
cd cellscript

make clean all
```

### 2. Run tests

```bash
python3 -m pip install pytest
make test
```

The test command builds the native evaluator and runs the regression and HTTP API tests.

### 3. Start the local C++ API

In the first terminal, from the repository root:

```bash
make server
```

The native API listens on [`http://localhost:8080`](http://localhost:8080). Keep this terminal running while using the local frontend.

### 4. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (usually [`http://localhost:5173`](http://localhost:5173)). During local development, the frontend calls the C++ API at `http://localhost:8080`. For the public Vercel deployment, requests use the same-origin `/api` routes.

### Optional: inspect a formula using the native compiler

From the repository root:

```bash
./build/cellscript "=SUM(A1:B3)+C2*2"
```

Other useful Make targets:

```bash
make run       # run the compiler example
make eval      # run the evaluator demo
make server    # start the native HTTP API
make test      # run tests
make clean     # remove generated build files
```

## HTTP API (local)

The local C++ API provides `GET /health` and `POST /evaluate`.

Example evaluation request:

```bash
curl -X POST http://localhost:8080/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"formulas":{"A1":"=10+20","B1":"=SUM(A1:A1)"},"values":{}}'
```

The response contains computed `values`, an `errors` map, `evaluationOrder`, token streams, AST representations and dependency lists.

## Production deployment configuration

The Vercel project is configured to build from the `frontend/` directory. This is important because the repository root contains the C++ `Makefile`, while the frontend's `package.json` is located in `frontend/package.json`. For the Git-connected Vercel project use **Root Directory** = `frontend`, **Build Command** = `npm run build`, and **Output Directory** = `dist`. Production frontend requests should use the same-origin `/api/health` and `/api/evaluate` paths; do not configure the production UI to call `localhost:8080`.

## Deploy to Vercel

The GitHub repository keeps the frontend and Vercel functions in `frontend/`. To connect the repository to a new Vercel project, use:

1. Import [the CellScript GitHub repository](https://github.com/Subham9339063436/cellscript).
2. Set **Root Directory** to `frontend`.
3. Select **Vite** as the framework preset.
4. Set the build command to `npm run build` and output directory to `dist`.
5. Deploy, then test `/api/health` and the dashboard's formula evaluation.

The current live deployment is [cellscript.vercel.app](https://cellscript.vercel.app).

## Project structure

```text
include/                 C++ AST, lexer, parser and evaluator interfaces
src/                     C++ compiler, evaluator and native HTTP server
tests/                   C++ evaluator and Python regression/API tests
docs/PHASE2.md            Phase 2 design and implementation notes
frontend/src/             React spreadsheet and compiler workbench
frontend/src/lib/          TypeScript formula evaluator used by the frontend API
frontend/api/              Vercel serverless health and evaluation routes
frontend/vercel.json       Vercel configuration
.github/workflows/ci.yml   Automated build and test workflow
Makefile                  Native build, run, server and test targets
```

## Compiler pipeline

```text
Formula text
    ↓
Lexer ──→ Token stream
    ↓
Recursive-descent parser
    ↓
AST
    ↓
Dependency extraction and circular-reference analysis
    ↓
Dependency-first evaluation
    ↓
Computed values + diagnostics
    ↓
Spreadsheet grid and Compiler workbench
```

## CI

GitHub Actions builds the native compiler/API, runs the C++ and Python tests, and builds the React/Vite frontend. See [the workflow runs](https://github.com/Subham9339063436/cellscript/actions).
