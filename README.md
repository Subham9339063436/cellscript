# CellScript — Phase 1

A formula-language compiler for spreadsheet-style expressions, implemented from the Phase 1 specification.

## Phase 1 pipeline

```text
Formula
  ↓
Lexer
  ↓
Token Stream
  ↓
Recursive-Descent Parser
  ↓
AST
```

## Supported grammar

```text
formula   := "=" expr
expr      := term (("+" | "-") term)*
term      := factor (("*" | "/") factor)*
factor    := NUMBER | cellRef | funcCall | "(" expr ")"
funcCall  := FUNCNAME "(" argList ")"
argList   := arg ("," arg)*
arg       := range | expr
range     := cellRef ":" cellRef
cellRef   := LETTER+ DIGIT+
```

Supported functions: `SUM`, `AVG`, `MAX`, `MIN`, `COUNT`.

## Example

```text
=SUM(A1:B3)+C2*2
```

The Phase 1 prototype prints the token stream and the generated AST.

## Build and run

```bash
make
make run
```

Or provide another formula:

```bash
./build/cellscript "=A1+(B1*C1)"
```

## Tests

```bash
make test
```

## Scope

This repository intentionally implements **Phase 1 only**. Symbol-table construction, dependency-graph analysis, cycle detection, topological evaluation, HTTP API, and React UI are planned for later phases according to the project specification.
