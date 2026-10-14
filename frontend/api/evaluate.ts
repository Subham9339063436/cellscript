export type WorkbookRequest = {
  formulas?: Record<string, string>;
  values?: Record<string, number>;
};
export type AnalysisToken = { type: string; text: string; column: number };
export type WorkbookResponse = {
  values: Record<string, number>;
  errors: Record<string, string>;
  evaluationOrder: string[];
  tokens: Record<string, AnalysisToken[]>;
  asts: Record<string, string>;
  dependencies: Record<string, string[]>;
};

type TokenType = "number" | "cell" | "function" | "operator" | "lparen" | "rparen" | "comma" | "colon" | "eof";
type Token = { type: TokenType; text: string; number?: number; column: number };
type Node =
  | { kind: "number"; value: number; column: number }
  | { kind: "cell"; cell: string; column: number }
  | { kind: "range"; start: string; end: string; column: number }
  | { kind: "binary"; op: string; left: Node; right: Node; column: number }
  | { kind: "call"; name: string; args: Node[]; column: number };

const FUNCTIONS = new Set(["SUM", "AVG", "AVERAGE", "MAX", "MIN", "COUNT"]);

class FormulaError extends Error {
  constructor(public category: "Lexical" | "Syntax" | "Semantic", public column: number, message: string) {
    super(message);
    this.name = "FormulaError";
  }
}

function normalizeCell(cell: string): string {
  return cell.toUpperCase();
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const whitespace = () => { while (i < source.length && /\s/.test(source[i])) i += 1; };
  whitespace();
  if (source[i] !== "=") throw new FormulaError("Lexical", 1, "Formula must start with '='");
  tokens.push({ type: "operator", text: "=", column: i + 1 });
  i += 1;

  while (i < source.length) {
    whitespace();
    if (i >= source.length) break;
    const start = i;
    const ch = source[i];
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(source[i + 1] ?? ""))) {
      i += 1;
      while (i < source.length && /[0-9]/.test(source[i])) i += 1;
      if (source[i] === ".") {
        i += 1;
        while (i < source.length && /[0-9]/.test(source[i])) i += 1;
      }
      const text = source.slice(start, i);
      const number = Number(text);
      if (!Number.isFinite(number)) throw new FormulaError("Lexical", start + 1, "Invalid numeric literal");
      tokens.push({ type: "number", text, number, column: start + 1 });
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      i += 1;
      while (i < source.length && /[A-Za-z]/.test(source[i])) i += 1;
      const lettersEnd = i;
      while (i < source.length && /[0-9]/.test(source[i])) i += 1;
      const text = source.slice(start, i);
      if (i > lettersEnd) {
        tokens.push({ type: "cell", text: normalizeCell(text), column: start + 1 });
      } else {
        const name = text.toUpperCase();
        if (!FUNCTIONS.has(name)) throw new FormulaError("Lexical", start + 1, "Unknown function name '" + text + "'");
        tokens.push({ type: "function", text: name, column: start + 1 });
      }
      continue;
    }
    if ("+-*/".includes(ch)) tokens.push({ type: "operator", text: ch, column: start + 1 });
    else if (ch === "(") tokens.push({ type: "lparen", text: ch, column: start + 1 });
    else if (ch === ")") tokens.push({ type: "rparen", text: ch, column: start + 1 });
    else if (ch === ",") tokens.push({ type: "comma", text: ch, column: start + 1 });
    else if (ch === ":") tokens.push({ type: "colon", text: ch, column: start + 1 });
    else throw new FormulaError("Lexical", start + 1, "Unexpected character '" + ch + "'");
    i += 1;
  }
  tokens.push({ type: "eof", text: "", column: source.length + 1 });
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}
  private peek(): Token { return this.tokens[this.pos]; }
  private take(): Token { const token = this.peek(); if (this.pos < this.tokens.length - 1) this.pos += 1; return token; }
  private check(type: TokenType): boolean { return this.peek().type === type; }
  private expect(type: TokenType, message: string): Token {
    if (!this.check(type)) throw new FormulaError("Syntax", this.peek().column, "Expected " + message + " but found '" + this.peek().text + "'");
    return this.take();
  }
  parse(): Node {
    this.expect("operator", "'='");
    const ast = this.expr();
    if (!this.check("eof")) throw new FormulaError("Syntax", this.peek().column, "Unexpected trailing input near '" + this.peek().text + "'");
    return ast;
  }
  private expr(): Node {
    let left = this.term();
    while (this.check("operator") && (this.peek().text === "+" || this.peek().text === "-")) {
      const op = this.take();
      left = { kind: "binary", op: op.text, left, right: this.term(), column: op.column };
    }
    return left;
  }
  private term(): Node {
    let left = this.factor();
    while (this.check("operator") && (this.peek().text === "*" || this.peek().text === "/")) {
      const op = this.take();
      left = { kind: "binary", op: op.text, left, right: this.factor(), column: op.column };
    }
    return left;
  }
  private factor(): Node {
    if (this.check("number")) {
      const token = this.take();
      return { kind: "number", value: token.number!, column: token.column };
    }
    if (this.check("cell")) {
      const token = this.take();
      return { kind: "cell", cell: token.text, column: token.column };
    }
    if (this.check("function")) return this.call();
    if (this.check("operator") && this.peek().text === "-") {
      const minus = this.take();
      return { kind: "binary", op: "-", left: { kind: "number", value: 0, column: minus.column }, right: this.factor(), column: minus.column };
    }
    if (this.check("lparen")) {
      this.take();
      const inner = this.expr();
      this.expect("rparen", "')'");
      return inner;
    }
    throw new FormulaError("Syntax", this.peek().column, "Unexpected token '" + this.peek().text + "' in expression");
  }
  private call(): Node {
    const name = this.take();
    this.expect("lparen", "'('");
    const args: Node[] = [];
    if (!this.check("rparen")) {
      args.push(this.arg());
      while (this.check("comma")) { this.take(); args.push(this.arg()); }
    }
    this.expect("rparen", "')'");
    return { kind: "call", name: name.text, args, column: name.column };
  }
  private arg(): Node {
    if (this.check("cell") && this.tokens[this.pos + 1]?.type === "colon") {
      const start = this.take();
      this.take();
      const end = this.expect("cell", "cell reference after ':'");
      return { kind: "range", start: start.text, end: end.text, column: start.column };
    }
    return this.expr();
  }
}

type Address = { row: number; col: number };
function parseAddress(value: string): Address {
  let col = 0;
  let i = 0;
  const cell = normalizeCell(value);
  while (i < cell.length && /[A-Z]/.test(cell[i])) {
    col = col * 26 + cell.charCodeAt(i) - 64;
    i += 1;
  }
  const rowText = cell.slice(i);
  if (i === 0 || !/^\d+$/.test(rowText) || Number(rowText) < 1 || !Number.isSafeInteger(col)) {
    throw new FormulaError("Semantic", 1, "Invalid cell reference '" + value + "'");
  }
  return { row: Number(rowText), col };
}
function makeAddress(row: number, col: number): string {
  let letters = "";
  while (col > 0) {
    col -= 1;
    letters = String.fromCharCode(65 + col % 26) + letters;
    col = Math.floor(col / 26);
  }
  return letters + row;
}
function rangeCells(start: string, end: string): string[] {
  const a = parseAddress(start);
  const b = parseAddress(end);
  const rows = Math.abs(a.row - b.row) + 1;
  const cols = Math.abs(a.col - b.col) + 1;
  if (!Number.isSafeInteger(rows * cols) || rows * cols > 100000) {
    throw new FormulaError("Semantic", 1, "Cell range is too large (maximum 100000 cells)");
  }
  const result: string[] = [];
  for (let row = Math.min(a.row, b.row); row <= Math.max(a.row, b.row); row += 1) {
    for (let col = Math.min(a.col, b.col); col <= Math.max(a.col, b.col); col += 1) result.push(makeAddress(row, col));
  }
  return result;
}
function collectDependencies(node: Node, out: Set<string>): void {
  switch (node.kind) {
    case "number": return;
    case "cell": out.add(node.cell); return;
    case "range": for (const cell of rangeCells(node.start, node.end)) out.add(cell); return;
    case "binary": collectDependencies(node.left, out); collectDependencies(node.right, out); return;
    case "call": for (const arg of node.args) collectDependencies(arg, out); return;
  }
}

function astToText(node: Node, depth = 0): string {
  const pad = "  ".repeat(depth);
  switch (node.kind) {
    case "number": return pad + "Number(" + node.value + ")\\n";
    case "cell": return pad + "CellRef(" + node.cell + ")\\n";
    case "range": return pad + "Range(" + node.start + ":" + node.end + ")\\n";
    case "binary": return pad + "BinaryOp(" + node.op + ")\\n" +
      astToText(node.left, depth + 1) + astToText(node.right, depth + 1);
    case "call": return pad + "FuncCall(" + node.name + ")\\n" +
      node.args.map(arg => astToText(arg, depth + 1)).join("");
  }
}

export function evaluateWorkbook(input: WorkbookRequest): WorkbookResponse {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Request body must be a JSON object");
  const formulaInput = input.formulas ?? {};
  const valueInput = input.values ?? {};
  if (typeof formulaInput !== "object" || formulaInput === null || Array.isArray(formulaInput)) throw new Error("'formulas' must be an object");
  if (typeof valueInput !== "object" || valueInput === null || Array.isArray(valueInput)) throw new Error("'values' must be an object");

  const formulas = new Map<string, string>();
  const inputs = new Map<string, number>();
  for (const [rawCell, rawFormula] of Object.entries(formulaInput)) {
    const cell = normalizeCell(rawCell);
    parseAddress(cell);
    if (typeof rawFormula !== "string") throw new Error("Formula for " + cell + " must be a string");
    formulas.set(cell, rawFormula);
  }
  for (const [rawCell, rawValue] of Object.entries(valueInput)) {
    const cell = normalizeCell(rawCell);
    parseAddress(cell);
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) throw new Error("Value for " + cell + " must be a finite number");
    inputs.set(cell, rawValue);
  }

  const errors: Record<string, string> = {};
  const tokenOutput: Record<string, AnalysisToken[]> = {};
  const astOutput: Record<string, string> = {};
  const dependencyOutput: Record<string, string[]> = {};
  const asts = new Map<string, Node>();
  const deps = new Map<string, Set<string>>();
  for (const [cell, formula] of formulas) {
    if (inputs.has(cell)) { errors[cell] = "Cell cannot contain both a constant value and a formula"; continue; }
    try {
      const tokenList = tokenize(formula);
      tokenOutput[cell] = tokenList.map(token => ({
        type: token.type,
        text: token.type === "eof" ? "EOF" : token.text,
        column: token.column
      }));
      const ast = new Parser(tokenList).parse();
      asts.set(cell, ast);
      astOutput[cell] = astToText(ast).trimEnd();
      const set = new Set<string>();
      collectDependencies(ast, set);
      deps.set(cell, set);
      dependencyOutput[cell] = [...set].sort();
    } catch (error) {
      errors[cell] = error instanceof Error ? error.message : String(error);
    }
  }

  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const evaluationOrder: string[] = [];
  const visit = (cell: string) => {
    const current = state.get(cell) ?? 0;
    if (current === 2) return;
    if (current === 1) {
      const start = stack.lastIndexOf(cell);
      const cycle = [...stack.slice(start), cell].join(" -> ");
      for (const member of stack.slice(start)) errors[member] = "Circular reference detected: " + cycle;
      errors[cell] = "Circular reference detected: " + cycle;
      return;
    }
    state.set(cell, 1);
    stack.push(cell);
    for (const dep of deps.get(cell) ?? []) if (asts.has(dep)) visit(dep);
    stack.pop();
    state.set(cell, 2);
    evaluationOrder.push(cell);
  };
  for (const cell of asts.keys()) visit(cell);

  const values: Record<string, number> = {};
  const evaluating = new Set<string>();
  const getValue = (cellRaw: string): number => {
    const cell = normalizeCell(cellRaw);
    if (errors[cell]) throw new Error(errors[cell]);
    if (inputs.has(cell)) return inputs.get(cell)!;
    if (values[cell] !== undefined) return values[cell];
    const ast = asts.get(cell);
    if (!ast) throw new Error("Referenced cell " + cell + " has no value");
    if (evaluating.has(cell)) throw new Error("Circular reference detected at " + cell);
    evaluating.add(cell);
    try {
      const value = evalNode(ast, cell);
      if (!Number.isFinite(value)) throw new Error("Result is not a finite number");
      values[cell] = value;
      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors[cell] = message.startsWith("Cell ") ? message : "Cell " + cell + ": " + message;
      throw new Error(errors[cell]);
    } finally {
      evaluating.delete(cell);
    }
  };
  const evalNode = (node: Node, owner: string): number => {
    switch (node.kind) {
      case "number": return node.value;
      case "cell": return getValue(node.cell);
      case "range": throw new Error("A cell range is only valid as a function argument");
      case "binary": {
        const a = evalNode(node.left, owner);
        const b = evalNode(node.right, owner);
        switch (node.op) {
          case "+": return a + b;
          case "-": return a - b;
          case "*": return a * b;
          case "/": if (b === 0) throw new Error("Division by zero"); return a / b;
          default: throw new Error("Unknown arithmetic operator");
        }
      }
      case "call": {
        const args: number[] = [];
        for (const arg of node.args) {
          if (arg.kind === "range") {
            for (const cell of rangeCells(arg.start, arg.end)) {
              if (inputs.has(cell) || asts.has(cell)) args.push(getValue(cell));
            }
          } else args.push(evalNode(arg, owner));
        }
        if (node.name === "SUM") return args.reduce((sum, value) => sum + value, 0);
        if (node.name === "COUNT") return args.length;
        if (args.length === 0) throw new Error(node.name + " requires at least one populated numeric argument");
        if (node.name === "AVG" || node.name === "AVERAGE") return args.reduce((sum, value) => sum + value, 0) / args.length;
        if (node.name === "MAX") return Math.max(...args);
        if (node.name === "MIN") return Math.min(...args);
        throw new Error("Unsupported function " + node.name);
      }
    }
  };

  for (const cell of evaluationOrder) {
    if (errors[cell]) continue;
    try { getValue(cell); } catch { /* diagnostic is retained in errors */ }
  }
  return {
    values,
    errors,
    evaluationOrder,
    tokens: tokenOutput,
    asts: astOutput,
    dependencies: dependencyOutput
  };
}

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST, OPTIONS");
    return response.status(405).json({ error: "Use POST /api/evaluate" });
  }

  const contentLength = Number(request.headers["content-length"] || "0");
  if (contentLength > 2 * 1024 * 1024) {
    return response.status(413).json({ error: "Request body is too large (maximum 2 MB)" });
  }

  try {
    const payload = (typeof request.body === "string"
      ? JSON.parse(request.body)
      : request.body) as WorkbookRequest;
    const result = evaluateWorkbook(payload);
    return response.status(200).json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("CellScript evaluation failed:", error);
    const invalidRequest = /Request body|must be an object|must be a string|must be a finite number|must start with|Unknown function|Unexpected character|Expected |Unexpected trailing input|requires at least|Referenced cell|Circular reference|Division by zero|Invalid cell reference|cannot contain both|range is too large/i.test(detail);
    return response.status(invalidRequest ? 400 : 500).json({
      error: invalidRequest ? "Unable to evaluate workbook request" : "Evaluation handler failed",
      detail
    });
  }
}
