# CellScript — Phase 2

A spreadsheet formula-language compiler in C++17. Phase 2 extends the lexical analyser, recursive-descent parser and AST with a symbol table, dependency extraction, circular-reference detection, dependency-respecting evaluation and spreadsheet aggregate functions.

## Pipeline

```text
Cell definitions → Lexer → Parser → AST
                              ↓
                 Symbol table + dependencies
                              ↓
                  DFS cycle detection
                              ↓
                    Ordered evaluation
                              ↓
                   Values and cell errors
```

## Supported features
- Arithmetic operators `+`, `-`, `*`, `/`, parentheses and unary minus
- Cell references such as `A1` and `AA12`
- Rectangular ranges (including reversed ranges)
- `SUM`, `AVG`, `MAX`, `MIN`, `COUNT`
- Forward references, missing-reference checks and cycle detection
- Division-by-zero and parser/lexer errors
- Range safety limit of 100,000 cells

Blank cells within aggregate ranges contribute zero; COUNT counts cells in a range. Direct references to missing cells are errors.

## Build and test

Requires a C++17 compiler, Make, Python 3 and pytest for tests.

```bash
make
make run
make eval
make test
```

Run the original tokeniser/parser demo with:
```bash
./build/cellscript "=SUM(A1:B3)+C2*2"
```

Run a sample worksheet through the new evaluator with `make eval`.

## Scope
Phase 2 currently focuses on the C++ symbol table, semantic dependency analysis and evaluation engine. The HTTP API and React grid are not yet implemented.
