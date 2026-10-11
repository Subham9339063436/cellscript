# CellScript Phase 2 — Implementation and Design Notes

## 1. Symbol table
Each formula cell is represented by a `CellEntry` containing its source formula, AST, dependency set, cached value and error text. Numeric input cells are provided separately.

## 2. Dependency extraction
The compiler traverses each AST. Cell-reference nodes add the referenced address; ranges expand to the addresses inside their rectangular bounds. Formula cells in those ranges become graph dependencies. Empty cells in aggregate ranges remain blank rather than generating missing-reference errors.

## 3. Cycle detection and evaluation order
Depth-first search tracks each formula cell as unseen, visiting or complete. Reaching a visiting node identifies a back edge, and the evaluator reports the circular path. Cells are appended to the evaluation order after their formula dependencies, so the resulting order is dependency-first.

## 4. AST evaluator
The evaluator handles numeric constants, references, unary minus (represented by the parser as zero minus the operand), arithmetic operations and function calls. Division by zero is reported as a cell error. Non-finite numeric results are rejected.

## 5. Built-in functions
- `SUM`: sum populated numeric arguments; an empty input gives zero.
- `AVG`: average populated numeric arguments; requires at least one value.
- `MAX` / `MIN`: largest/smallest populated numeric argument; requires at least one value.
- `COUNT`: count populated numeric values. Empty cells in ranges are ignored.

Ranges are capped at 100,000 cells to avoid unbounded expansion. Ranges may be written with either endpoint order.

## 6. HTTP API
The native API server listens on port 8080 by default. It serves `GET /health` and `POST /evaluate` and accepts JSON of this shape:

```json
{
  "formulas": { "A1": "=10", "B1": "=A1*2" },
  "values": { "C1": 4 }
}
```

The response includes `values`, `errors`, and `evaluationOrder`. The frontend sends the full workbook after an edit and renders returned values and errors. The server uses a small POSIX socket implementation and a purpose-built parser for the expected JSON request shape. It is intended for local development and trusted networks, not direct public-internet exposure.

## 7. Frontend
The React/Vite interface shows a 10-column by 15-row grid, a formula bar, selected-cell highlighting, error indicators, sample values/formulas, and automatic recalculation through the API. Numeric entries are sent as input values; formula strings beginning with `=` are sent through the compiler.

## 8. Testing
Run `make test` for Phase 1 lexer/parser regression tests, C++ evaluator tests and HTTP health/evaluation tests. Coverage includes forward references, aggregate functions, blank range cells, cycles, missing direct references, division by zero, numeric input cells and JSON API evaluation. GitHub Actions also builds the frontend bundle.
