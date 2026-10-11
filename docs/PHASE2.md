# CellScript Phase 2 — Implementation Notes

## Symbol table
Each formula cell is recorded with its source formula, AST, extracted dependency set, optional cached value and error status. Numeric input values may be supplied separately.

## Dependency analysis
The AST is traversed recursively. Cell-reference nodes add one dependency; range nodes expand to the cells in the rectangular range. This allows formula evaluation to respect dependencies rather than entry order.

## Cycle detection
Depth-first search marks cells unseen, visiting or complete. Encountering a visiting node identifies a circular dependency; the error includes a cycle chain.

## Evaluation
Formula dependencies are visited before their consumers. The AST evaluator handles arithmetic, unary minus, references, ranges within aggregate functions, and SUM, AVG, MAX, MIN and COUNT.

## Error handling
The engine reports lexical and syntax failures, missing cell references, cycles, division by zero, invalid cell addresses, excessive ranges and non-finite results. Blank cells in aggregate ranges contribute zero; COUNT counts the cells in the selected rectangle.

## Current boundary
This phase adds the C++ evaluation core and CLI demo. HTTP API and React grid integration remain future work and are not claimed as complete.
