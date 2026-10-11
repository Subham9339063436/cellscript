# CellScript — Phase 2

CellScript is a spreadsheet formula-language compiler built for BCSE307L Compiler Design. The C++17 core extends the Phase 1 lexer, recursive-descent parser and AST with a symbol table, dependency extraction, circular-reference detection and dependency-aware evaluation. A native HTTP API connects the evaluator to a React/Vite spreadsheet UI.

## Features

- Arithmetic: `+`, `-`, `*`, `/`, parentheses and unary minus
- Cell references such as `A1` and `AA12`
- Rectangular ranges, including reversed ranges
- Built-in functions: `SUM`, `AVG`, `MAX`, `MIN`, `COUNT`
- Formula dependencies are evaluated before their dependants
- Circular-reference detection with a cycle path
- Cell-specific errors for missing references, invalid formulas and division by zero
- Spreadsheet grid with a formula bar, live calculated values, error indicators and sample workbook
- HTTP JSON endpoint so the React frontend uses the same C++ compiler/evaluator

Blank cells in aggregate ranges are ignored. SUM of an empty range is zero, AVG/MAX/MIN require at least one populated numeric value, and COUNT counts populated numeric cells. A direct reference to a missing cell is an error. Range expansion is limited to 100,000 cells.

## Requirements

- C++17 compiler and Make (GCC/Clang; macOS or Linux)
- Python 3 and pytest for regression tests
- Node.js and npm for the React frontend

## Run the C++ compiler and tests

From the repository root:

```bash
make
make run
make eval
make test
```

To inspect the lexer token stream and AST:

```bash
./build/cellscript "=SUM(A1:B3)+C2*2"
```

## Run the complete application

Open two terminals from the repository root.

**Terminal 1 — start the C++ API:**

```bash
make server
```

The API listens on `http://localhost:8080`. Use a different port with `./build/cellscript-api 8081`.

**Terminal 2 — start the React spreadsheet:**

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). To point the UI at another API URL, set `VITE_API_URL` before starting Vite, for example `VITE_API_URL=http://localhost:8081 npm run dev`.

## HTTP API

- `GET /health` returns service status.
- `POST /evaluate` accepts a JSON object with `formulas` (cell-to-formula strings) and `values` (cell-to-number constants).

Example request:

```bash
curl -X POST http://localhost:8080/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"formulas":{"A1":"=10","A2":"=20","B1":"=A1+A2","C1":"=SUM(A1:A2)"},"values":{}}'
```

The response contains `values`, `errors`, and `evaluationOrder` maps/arrays. Cells with errors are returned in the error map, rather than as calculated numeric values.

## Project structure

```text
include/           AST, lexer/parser interfaces and evaluator interface
src/               C++ compiler, evaluator and HTTP API
tests/             Phase 1 regression tests and Phase 2 evaluator tests
frontend/          React + TypeScript + Vite spreadsheet UI
docs/PHASE2.md     Design, algorithms and API notes
```

The API uses a small POSIX socket server with a constrained JSON reader to keep the project self-contained; it does not require a separate HTTP library. Build the server on macOS or Linux.

## Compiler pipeline

```text
Cell formula text → Lexer → Parser → AST
                                      ↓
                     Symbol table + dependencies
                                      ↓
                       DFS circularity analysis
                                      ↓
                       Dependency-first evaluation
                                      ↓
                       HTTP JSON result → React grid
```
