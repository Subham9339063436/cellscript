import { useEffect, useMemo, useRef, useState } from "react";

type AnalysisToken = { type: string; text: string; column: number };
type ApiResult = {
  values: Record<string, number>;
  errors: Record<string, string>;
  evaluationOrder: string[];
  tokens: Record<string, AnalysisToken[]>;
  asts: Record<string, string>;
  dependencies: Record<string, string[]>;
};
type Status = "connecting" | "online" | "offline";
type RibbonTab = "file" | "home" | "insert" | "formulas" | "data" | "view" | "compiler";
type CompilerStage = "lexical" | "ast" | "dependencies" | "evaluation";

const RIBBON_TABS: { id: RibbonTab; label: string }[] = [
  { id: "file", label: "File" },
  { id: "home", label: "Home" },
  { id: "insert", label: "Insert" },
  { id: "formulas", label: "Formulas" },
  { id: "data", label: "Data" },
  { id: "view", label: "View" },
  { id: "compiler", label: "Compiler" }
];
const COMPILER_STAGES: { id: CompilerStage; label: string; caption: string }[] = [
  { id: "lexical", label: "Lexical analysis", caption: "Token stream" },
  { id: "ast", label: "AST parsing", caption: "Syntax tree" },
  { id: "dependencies", label: "Dependency resolution", caption: "Cell references" },
  { id: "evaluation", label: "Evaluation", caption: "Computed results" }
];
const API_BASE = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "" : "http://localhost:8080")).replace(/\/$/, "");
const API_PREFIX = import.meta.env.PROD && !import.meta.env.VITE_API_URL ? "/api" : "";
const COLUMNS = ["A", "B", "C", "D", "E", "F"] as const;
const FIRST_DATA_ROW = 2;
const LAST_DATA_ROW = 10;
const DISPLAY_ROWS = Array.from({ length: 14 }, (_, i) => i + 1);
const HEADERS: Record<string, string> = {
  A1: "Date", B1: "Open", C1: "Close", D1: "High (+)", E1: "Low (-)", F1: "Profit"
};
const STOCK_VALUES: Record<string, string> = {
  A2: "8/1/2022", B2: "2625.75", C2: "2640.75", D2: "2642.75", E2: "2620.65",
  A3: "8/2/2022", B3: "2640.75", C3: "2638.75", D3: "2640.75", E3: "2638.75",
  A4: "8/3/2022", B4: "2638.75", C4: "2697.65", D4: "2698.25", E4: "2635.65",
  A5: "8/4/2022", B5: "2697.65", C5: "2700.25", D5: "2700.25", E5: "2585.10",
  A6: "8/5/2022", B6: "2700.25", C6: "2730.25", D6: "2732.25", E6: "2700.00",
  A7: "8/6/2022", B7: "2730.25", C7: "2730.25", D7: "2730.25", E7: "2725.67",
  A8: "8/7/2022", B8: "2730.25", C8: "2778.75", D8: "2780.25", E8: "2730.20",
  A9: "8/8/2022", B9: "2778.75", C9: "2800.67", D9: "2802.27", E9: "2770.78",
  A10: "8/9/2022", B10: "2800.67", C10: "2840.80", D10: "2848.78", E10: "2797.78"
};
const SUMMARY_LABELS: Record<number, string> = {
  11: "Average profit:",
  12: "Maximum stock value:",
  13: "Minimum stock value:",
  14: "Trading days:"
};
const SUMMARY_FORMULAS: Record<string, string> = {
  F11: "=AVG(F2:F10)",
  F12: "=MAX(D2:D10)",
  F13: "=MIN(E2:E10)",
  F14: "=COUNT(F2:F10)"
};
function createSample(): Record<string, string> {
  const next: Record<string, string> = { ...HEADERS, ...STOCK_VALUES };
  for (let row = FIRST_DATA_ROW; row <= LAST_DATA_ROW; row += 1) next["F" + row] = "=C" + row + "-B" + row;
  return { ...next, ...SUMMARY_FORMULAS };
}
function createBlankWorkbook(): Record<string, string> {
  return { ...HEADERS, ...SUMMARY_FORMULAS };
}
function initialResult(): ApiResult {
  return { values: {}, errors: {}, evaluationOrder: [], tokens: {}, asts: {}, dependencies: {} };
}
function displayNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
}
function isColumn(cell: string, col: string): boolean {
  return cell.startsWith(col);
}

export default function App() {
  const [drafts, setDrafts] = useState<Record<string, string>>(createSample);
  const [selected, setSelected] = useState("F11");
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [ribbonTab, setRibbonTab] = useState<RibbonTab>("home");
  const [compilerStage, setCompilerStage] = useState<CompilerStage>("lexical");
  const [result, setResult] = useState<ApiResult>(initialResult);
  const [status, setStatus] = useState<Status>("connecting");
  const [lastCalculated, setLastCalculated] = useState<Date | null>(null);
  const [gridlines, setGridlines] = useState(true);
  const [showFormulas, setShowFormulas] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [boldSelection, setBoldSelection] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [workbookName, setWorkbookName] = useState("Stock Details");
  const [recalcCounter, setRecalcCounter] = useState(0);
  const undoStack = useRef<Record<string, string>[]>([]);
  const redoStack = useRef<Record<string, string>[]>([]);

  const workbook = useMemo(() => {
    const formulas: Record<string, string> = {};
    const values: Record<string, number> = {};
    for (const [cell, raw] of Object.entries(drafts)) {
      const text = raw.trim();
      if (text.startsWith("=")) formulas[cell] = text;
      else if (text !== "" && Number.isFinite(Number(text))) values[cell] = Number(text);
    }
    return { formulas, values };
  }, [drafts]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(API_BASE + API_PREFIX + "/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(workbook),
          signal: controller.signal
        });
        if (!response.ok) throw new Error("API returned HTTP " + response.status);
        const payload = await response.json() as ApiResult;
        if (!cancelled) {
          setResult(payload);
          setStatus("online");
          setLastCalculated(new Date());
        }
      } catch {
        if (!cancelled) setStatus("offline");
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [workbook, recalcCounter]);

  useEffect(() => {
    let cancelled = false;
    fetch(API_BASE + API_PREFIX + "/health")
      .then(response => { if (!response.ok) throw new Error("API unavailable"); return response.json(); })
      .then(() => { if (!cancelled) setStatus("online"); })
      .catch(() => { if (!cancelled) setStatus("offline"); });
    return () => { cancelled = true; };
  }, []);

  function commitDrafts(next: Record<string, string>) {
    undoStack.current.push(drafts);
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
    setDrafts(next);
  }
  function updateCell(cell: string, value: string) {
    commitDrafts({ ...drafts, [cell]: value });
  }
  function updateSelected(value: string) {
    updateCell(selected, value);
  }
  function loadSample() {
    commitDrafts(createSample());
    setSelected("F11");
    setWorkbookName("Stock Details");
    setShowChart(false);
  }
  function newWorkbook() {
    if (!window.confirm("Create a new workbook? Unsaved cell entries in this worksheet will be replaced.")) return;
    commitDrafts(createBlankWorkbook());
    setWorkbookName("Untitled workbook");
    setSelected("A2");
    setShowChart(false);
  }
  function clearContents() {
    const next = { ...drafts };
    for (let row = FIRST_DATA_ROW; row <= LAST_DATA_ROW; row += 1) {
      for (const col of COLUMNS) if (col !== "F") delete next[col + row];
      next["F" + row] = "=C" + row + "-B" + row;
    }
    commitDrafts(next);
  }
  function undo() {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(drafts);
    setDrafts(previous);
  }
  function redo() {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(drafts);
    setDrafts(next);
  }
  function exportCsv() {
    const rows: string[][] = [];
    for (const row of DISPLAY_ROWS) {
      const line: string[] = [];
      for (const col of COLUMNS) {
        const address = col + row;
        let value = drafts[address] ?? "";
        if (value.startsWith("=") && result.values[address] !== undefined) value = String(result.values[address]);
        line.push(value);
      }
      rows.push(line);
    }
    const csv = rows.map(row => row.map(value => '"' + value.replace(/"/g, '""') + '"').join(",")).join("\\r\\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = (workbookName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "cellscript") + ".csv";
    anchor.click();
    URL.revokeObjectURL(href);
  }
  function sortByProfit(direction: "asc" | "desc") {
    const sourceRows = Array.from({ length: LAST_DATA_ROW - FIRST_DATA_ROW + 1 }, (_, i) => FIRST_DATA_ROW + i);
    sourceRows.sort((a, b) => {
      const diff = (result.values["F" + a] ?? 0) - (result.values["F" + b] ?? 0);
      return direction === "asc" ? diff : -diff;
    });
    const next = { ...drafts };
    const keys = ["A", "B", "C", "D", "E"];
    sourceRows.forEach((oldRow, index) => {
      const targetRow = FIRST_DATA_ROW + index;
      keys.forEach(col => { next[col + targetRow] = drafts[col + oldRow] ?? ""; });
    });
    commitDrafts(next);
    setSelected("F2");
  }
  function insertFunction(name: "SUM" | "AVERAGE" | "MAX" | "MIN" | "COUNT") {
    const col = isColumn(selected, "F") ? "F" : isColumn(selected, "D") ? "D" : "F";
    // The compiler grammar calls AVERAGE "AVG"; insert the supported name.
    const formulaName = name === "AVERAGE" ? "AVG" : name;
    const formula = formulaName + "(" + col + FIRST_DATA_ROW + ":" + col + LAST_DATA_ROW + ")";
    updateSelected("=" + formula);
    setRibbonTab("home");
  }
  function jumpToCompiler(stage: CompilerStage) {
    setCompilerStage(stage);
    setRibbonTab("compiler");
  }
  function moveSelection(key: string, shiftKey = false) {
    const match = /^([A-F])(\\d+)$/.exec(selected);
    if (!match) return;
    let col = COLUMNS.indexOf(match[1] as typeof COLUMNS[number]);
    let row = Number(match[2]);
    if (key === "ArrowUp") row -= 1;
    if (key === "ArrowDown" || key === "Enter") row += 1;
    if (key === "ArrowLeft") col -= 1;
    if (key === "ArrowRight" || key === "Tab") col += 1;
    if (key === "Tab" && shiftKey) col -= 2;
    row = Math.min(DISPLAY_ROWS.length, Math.max(1, row));
    col = Math.min(COLUMNS.length - 1, Math.max(0, col));
    setSelected(COLUMNS[col] + row);
  }
  function cellValue(cell: string): { label: string; isError: boolean; tooltip?: string; source: string } {
    const source = drafts[cell] ?? "";
    if (result.errors[cell]) return { label: "#ERROR", isError: true, tooltip: result.errors[cell], source };
    if (source.trim().startsWith("=")) {
      if (showFormulas) return { label: source, isError: false, source };
      return { label: result.values[cell] === undefined ? "…" : displayNumber(result.values[cell]), isError: false, source };
    }
    if (workbook.values[cell] !== undefined) return { label: displayNumber(workbook.values[cell]), isError: false, source };
    return { label: source, isError: false, source };
  }
  function renderCell(cell: string) {
    const info = cellValue(cell);
    const formula = info.source.trim().startsWith("=");
    const classes = [
      cell === selected ? "selected-cell" : "",
      info.isError ? "error-cell" : "",
      formula ? "formula-cell" : "",
      workbook.values[cell] !== undefined ? "input-cell" : "",
      boldSelection && cell === selected ? "bold-cell" : ""
    ].filter(Boolean).join(" ");
    return (
      <td key={cell} className={classes}>
        {editingCell === cell ? (
          <input
            autoFocus
            className="cell-edit-input"
            aria-label={"Edit " + cell}
            value={editingValue}
            onChange={event => setEditingValue(event.target.value)}
            onBlur={event => {
              if (event.currentTarget.dataset.cancel !== "true") updateCell(cell, editingValue);
              delete event.currentTarget.dataset.cancel;
              setEditingCell(null);
            }}
            onKeyDown={event => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") { event.currentTarget.dataset.cancel = "true"; event.currentTarget.blur(); }
            }}
          />
        ) : (
          <button
            type="button"
            title={info.tooltip || (info.source ? info.source : cell)}
            aria-label={cell + (info.label ? ": " + info.label : "")}
            onClick={() => setSelected(cell)}
            onDoubleClick={() => { setSelected(cell); setEditingCell(cell); setEditingValue(drafts[cell] ?? ""); }}
            onKeyDown={event => {
              if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Tab"].includes(event.key)) {
                event.preventDefault();
                moveSelection(event.key, event.shiftKey);
              }
              if (event.key === "F2") { event.preventDefault(); setEditingCell(cell); setEditingValue(drafts[cell] ?? ""); }
            }}
          >
            {info.label || <span className="empty-cell">·</span>}
          </button>
        )}
      </td>
    );
  }

  const selectedSource = drafts[selected] ?? "";
  const selectedCellValue = cellValue(selected);
  const errorCount = Object.keys(result.errors).length;
  const formulaCells = Object.keys(workbook.formulas).sort();
  const selectedTokens = result.tokens?.[selected] ?? [];
  const selectedDependencies = result.dependencies?.[selected] ?? [];
  const selectedAst = result.asts?.[selected];
  const tokenCount = selectedTokens.filter(token => !["EOF", "EndOfInput", "eof"].includes(token.type)).length;
  const positives = Array.from({ length: 9 }, (_, i) => result.values["F" + (i + 2)] ?? 0);
  const maxProfit = Math.max(1, ...positives.map(value => Math.abs(value)));
  const averageProfit = result.values.F11;
  const maxStock = result.values.F12;
  const minStock = result.values.F13;
  const tradingDays = result.values.F14;

  function renderCompilerPanel() {
    return (
      <section className="compiler-panel">
        <header className="compiler-panel-head">
          <div>
            <div className="sheet-kicker">CELLSCRIPT / COMPILER WORKBENCH</div>
            <h2>{COMPILER_STAGES.find(stage => stage.id === compilerStage)?.label}</h2>
            <p>Live analysis for cell <strong>{selected}</strong> · <code>{selectedSource || "(empty cell)"}</code></p>
          </div>
          <div className="api-status"><i className={status} />{status === "online" ? "Engine connected" : status === "connecting" ? "Connecting…" : "Engine offline"}</div>
        </header>
        <div className="compiler-stage-tabs">
          {COMPILER_STAGES.map(stage => (
            <button key={stage.id} type="button" className={compilerStage === stage.id ? "selected" : ""} onClick={() => setCompilerStage(stage.id)}>
              <strong>{stage.label}</strong><small>{stage.caption}</small>
            </button>
          ))}
        </div>
        <div className="compiler-panel-body">
          {compilerStage === "lexical" && (
            <>
              <div className="analysis-summary"><span>Token count <strong>{tokenCount}</strong></span><span>Selected cell <strong>{selected}</strong></span><span>Status <strong className={result.errors[selected] ? "error-text" : "success-text"}>{result.errors[selected] ? "Error" : selectedTokens.length ? "Complete" : "No formula"}</strong></span></div>
              {result.errors[selected] && !selectedTokens.length ? <div className="analysis-error">{result.errors[selected]}</div> : selectedTokens.length ? (
                <div className="table-overflow"><table className="analysis-table"><thead><tr><th>#</th><th>Token type</th><th>Lexeme</th><th>Source column</th></tr></thead><tbody>
                  {selectedTokens.map((token, index) => <tr key={selected + index}><td>{String(index + 1).padStart(2, "0")}</td><td><span className="token-type">{token.type}</span></td><td className="analysis-mono">{token.text || "EOF"}</td><td className="analysis-mono">{token.column}</td></tr>)}
                </tbody></table></div>
              ) : <div className="analysis-empty">Select a formula cell or enter a formula such as <code>=C2-B2</code>.</div>}
            </>
          )}
          {compilerStage === "ast" && (
            selectedAst ? <div className="ast-view"><div className="ast-source-line"><span>FORMULA</span><code>{selectedSource}</code></div><pre>{selectedAst}</pre><div className="ast-footer">✓ Recursive-descent parser returned an AST for {selected}.</div></div>
              : <div className={result.errors[selected] ? "analysis-error" : "analysis-empty"}>{result.errors[selected] || "This cell does not currently contain a valid formula."}</div>
          )}
          {compilerStage === "dependencies" && (
            <>
              <div className="analysis-summary"><span>Formula cells <strong>{formulaCells.length}</strong></span><span>Selected references <strong>{selectedDependencies.length}</strong></span><span>Cell errors <strong className={errorCount ? "error-text" : "success-text"}>{errorCount}</strong></span></div>
              {formulaCells.length ? <div className="dependency-table">{formulaCells.map(cell => (
                <div className={"dependency-line " + (selected === cell ? "active" : "")} key={cell}>
                  <button type="button" className="dependency-formula" onClick={() => setSelected(cell)}><small>FORMULA CELL</small><strong>{cell}</strong><code>{drafts[cell]}</code></button>
                  <div className="dependency-connector"><span>depends on</span><b>→</b></div>
                  <div className="dependency-targets">{(result.dependencies[cell] ?? []).length ? result.dependencies[cell].map(dep => (
                    <button type="button" key={cell + dep} onClick={() => setSelected(dep)} className={"dependency-chip " + (workbook.formulas[dep] ? "formula" : workbook.values[dep] !== undefined ? "input" : "blank")}>
                      {dep}<small>{workbook.formulas[dep] ? "ƒx" : workbook.values[dep] !== undefined ? "VALUE" : "BLANK"}</small>
                    </button>
                  )) : <span className="no-dependency">No cell references</span>}</div>
                  {result.errors[cell] && <span className="dependency-error">{result.errors[cell]}</span>}
                </div>
              ))}</div> : <div className="analysis-empty">No formulas to analyze yet.</div>}
            </>
          )}
          {compilerStage === "evaluation" && (
            <>
              <div className="analysis-summary"><span>Evaluation order <strong>{result.evaluationOrder.length}</strong></span><span>Computed values <strong>{Object.keys(result.values).length}</strong></span><span>Errors <strong className={errorCount ? "error-text" : "success-text"}>{errorCount}</strong></span></div>
              {result.evaluationOrder.length ? <div className="table-overflow"><table className="analysis-table"><thead><tr><th>#</th><th>Cell</th><th>Formula</th><th>Computed value</th><th>Result</th></tr></thead><tbody>
                {result.evaluationOrder.map((cell, index) => <tr key={cell} className={cell === selected ? "row-selected" : ""}><td>{String(index + 1).padStart(2, "0")}</td><td><button type="button" className="link-cell" onClick={() => setSelected(cell)}>{cell}</button></td><td className="analysis-mono">{drafts[cell] || "—"}</td><td className="analysis-mono">{result.values[cell] === undefined ? "—" : displayNumber(result.values[cell])}</td><td>{result.errors[cell] ? <span className="error-text">ERROR</span> : result.values[cell] !== undefined ? <span className="success-text">SUCCESS</span> : "NO VALUE"}</td></tr>)}
              </tbody></table></div> : <div className="analysis-empty">Enter formulas into the worksheet to populate evaluation output.</div>}
              {errorCount > 0 && <div className="error-list"><strong>Cell diagnostics</strong>{Object.entries(result.errors).map(([cell, message]) => <p key={cell}><code>{cell}</code> — {message}</p>)}</div>}
            </>
          )}
        </div>
      </section>
    );
  }

  function renderRibbon() {
    if (ribbonTab === "file") return (
      <div className="ribbon-groups">
        <section className="ribbon-group"><div className="ribbon-actions"><button type="button" className="ribbon-action primary" onClick={newWorkbook}><b>＋</b><span>New workbook</span></button><button type="button" className="ribbon-action" onClick={loadSample}><b>▤</b><span>Open stock sample</span></button></div><small>Workbook</small></section>
        <section className="ribbon-group"><div className="ribbon-actions"><button type="button" className="ribbon-action" onClick={exportCsv}><b>⇩</b><span>Export CSV</span></button></div><small>Export</small></section>
        <section className="ribbon-group ribbon-group-note"><strong>{workbookName}</strong><span>{Object.keys(drafts).filter(key => drafts[key] !== "").length} populated cells · {formulaCells.length} formulas</span></section>
      </div>
    );
    if (ribbonTab === "home") return (
      <div className="ribbon-groups">
        <section className="ribbon-group"><div className="ribbon-actions"><button type="button" className="ribbon-action" disabled={!undoStack.current.length} onClick={undo}><b>↶</b><span>Undo</span></button><button type="button" className="ribbon-action" disabled={!redoStack.current.length} onClick={redo}><b>↷</b><span>Redo</span></button></div><small>History</small></section>
        <section className="ribbon-group"><div className="ribbon-actions"><button type="button" className="ribbon-action" onClick={() => setBoldSelection(value => !value)}><b className="bold-glyph">B</b><span>Bold selected</span></button><button type="button" className="ribbon-action" onClick={clearContents}><b>⌫</b><span>Clear data cells</span></button></div><small>Editing</small></section>
        <section className="ribbon-group ribbon-group-note"><strong>Selected cell: {selected}</strong><span>Click to select · double-click a cell to edit it directly</span></section>
      </div>
    );
    if (ribbonTab === "insert") return (
      <div className="ribbon-groups">
        <section className="ribbon-group"><div className="ribbon-actions"><button type="button" className={"ribbon-action " + (showChart ? "active-action" : "")} onClick={() => setShowChart(value => !value)}><b>▥</b><span>{showChart ? "Hide profit chart" : "Insert profit chart"}</span></button></div><small>Chart</small></section>
        <section className="ribbon-group"><div className="ribbon-actions"><button type="button" className="ribbon-action" onClick={() => { setSelected("F11"); setRibbonTab("formulas"); }}><b>ƒx</b><span>Summary formulas</span></button></div><small>Functions</small></section>
      </div>
    );
    if (ribbonTab === "formulas") return (
      <div className="ribbon-groups">
        <section className="ribbon-group wide-ribbon-group"><div className="ribbon-actions function-actions">
          {(["SUM", "AVERAGE", "MAX", "MIN", "COUNT"] as const).map(name => <button type="button" key={name} className="ribbon-action function-action" onClick={() => insertFunction(name)}><b>ƒx</b><span>{name}</span></button>)}
        </div><small>Insert function into {selected}</small></section>
        <section className="ribbon-group"><div className="ribbon-actions"><button type="button" className="ribbon-action" onClick={() => jumpToCompiler("lexical")}><b>≡</b><span>Inspect formula</span></button></div><small>Formula analysis</small></section>
      </div>
    );
    if (ribbonTab === "data") return (
      <div className="ribbon-groups">
        <section className="ribbon-group"><div className="ribbon-actions"><button type="button" className="ribbon-action" onClick={() => sortByProfit("asc")}><b>↑↓</b><span>Profit ascending</span></button><button type="button" className="ribbon-action" onClick={() => sortByProfit("desc")}><b>↓↑</b><span>Profit descending</span></button></div><small>Sort rows</small></section>
        <section className="ribbon-group"><div className="ribbon-actions"><button type="button" className="ribbon-action" onClick={() => setRecalcCounter(value => value + 1)}><b>⟳</b><span>Recalculate workbook</span></button></div><small>Calculation</small></section>
        <section className="ribbon-group"><div className="ribbon-actions"><button type="button" className="ribbon-action" onClick={() => jumpToCompiler("dependencies")}><b>⌘</b><span>View dependencies</span></button></div><small>Relationships</small></section>
      </div>
    );
    if (ribbonTab === "view") return (
      <div className="ribbon-groups">
        <section className="ribbon-group"><div className="ribbon-actions"><button type="button" className={"ribbon-action " + (gridlines ? "active-action" : "")} onClick={() => setGridlines(value => !value)}><b>▦</b><span>{gridlines ? "Hide gridlines" : "Show gridlines"}</span></button><button type="button" className={"ribbon-action " + (showFormulas ? "active-action" : "")} onClick={() => setShowFormulas(value => !value)}><b>ƒx</b><span>{showFormulas ? "Show values" : "Show formulas"}</span></button></div><small>Display</small></section>
        <section className="ribbon-group"><div className="ribbon-actions zoom-actions"><button type="button" className="ribbon-action" onClick={() => setZoom(value => Math.max(75, value - 10))}><b>−</b><span>Zoom out</span></button><strong>{zoom}%</strong><button type="button" className="ribbon-action" onClick={() => setZoom(value => Math.min(125, value + 10))}><b>＋</b><span>Zoom in</span></button></div><small>Zoom</small></section>
      </div>
    );
    return (
      <div className="ribbon-groups compiler-ribbon-groups">
        <section className="ribbon-group wide-ribbon-group"><div className="ribbon-actions compiler-shortcuts">
          {COMPILER_STAGES.map(stage => <button type="button" key={stage.id} className={"ribbon-action " + (compilerStage === stage.id ? "active-action" : "")} onClick={() => setCompilerStage(stage.id)}><b>{stage.id === "lexical" ? "≡" : stage.id === "ast" ? "⑂" : stage.id === "dependencies" ? "↗" : "Σ"}</b><span>{stage.label}</span></button>)}
        </div><small>Compiler pipeline</small></section>
        <section className="ribbon-group ribbon-group-note"><strong>Formula under inspection: {selected}</strong><span>Change the selected cell to refresh each stage.</span></section>
      </div>
    );
  }

  return (
    <main className="excel-app">
      <header className="app-topbar">
        <a className="app-brand" href="#" aria-label="CellScript home"><span className="brand-grid"><i /><i /><i /><i /></span><span>CellScript</span></a>
        <div className="topbar-file"><span className="file-icon">▤</span><span>{workbookName}</span><button type="button" title="Rename workbook" onClick={() => { const name = window.prompt("Workbook name", workbookName); if (name?.trim()) setWorkbookName(name.trim()); }}>⌄</button><span className="saved-label">Saved locally in this session</span></div>
        <div className="topbar-end"><span className={"engine-status " + status}><i />{status === "online" ? "Engine ready" : status === "connecting" ? "Connecting" : "Engine offline"}</span><button type="button" className="topbar-share" onClick={exportCsv}>Export ↓</button></div>
      </header>

      <section className="ribbon-shell">
        <nav className="ribbon-tabs" aria-label="Workbook ribbon">
          {RIBBON_TABS.map(tab => <button key={tab.id} type="button" className={ribbonTab === tab.id ? "active" : ""} onClick={() => setRibbonTab(tab.id)}>{tab.label}</button>)}
        </nav>
        <div className="ribbon-content">{renderRibbon()}</div>
      </section>

      <section className="formula-area">
        <div className="cell-name-box" title="Selected cell">{selected}</div>
        <span className="formula-divider" />
        <span className="fx-symbol">ƒx</span>
        <input aria-label={"Formula or value for " + selected} value={selectedSource} onChange={event => updateSelected(event.target.value)} onKeyDown={event => { if (event.key === "Enter") moveSelection("Enter"); if (event.key === "Escape") event.currentTarget.blur(); }} placeholder="Type a value or a formula beginning with =" />
        <div className="formula-value">{selectedCellValue.isError ? "#ERROR" : selectedCellValue.label || " "}</div>
      </section>

      <section className="sheet-frame" aria-label="Spreadsheet workbook">
        <div className="sheet-scroll">
          <table className={"excel-grid " + (gridlines ? "with-gridlines" : "without-gridlines")} style={{ zoom: zoom / 100 }} aria-label="Stock details spreadsheet">
            <colgroup><col className="row-header-col" />{COLUMNS.map(col => <col key={col} className={"column-" + col.toLowerCase()} />)}</colgroup>
            <thead><tr><th className="select-all-cell">◢</th>{COLUMNS.map(col => <th key={col} className={isColumn(selected, col) ? "selected-column-heading" : ""}>{col}</th>)}</tr></thead>
            <tbody>
              {DISPLAY_ROWS.map(row => (
                <tr key={row} className={row === 1 ? "header-row" : row >= 11 ? "summary-row" : ""}>
                  <th className={"row-header " + (selected.endsWith(String(row)) ? "selected-row-heading" : "")}>{row}</th>
                  {row >= 11 ? (
                    <>
                      {["A", "B", "C"].map(col => renderCell(col + row))}
                      <td colSpan={2} className={"summary-label-cell " + (selected === "E" + row ? "selected-cell" : "")}><button type="button" onClick={() => setSelected("E" + row)}>{SUMMARY_LABELS[row]}</button></td>
                      {renderCell("F" + row)}
                    </>
                  ) : COLUMNS.map(col => {
                    const address = col + row;
                    if (row === 1) {
                      return <td key={address} className={"column-title " + (selected === address ? "selected-cell" : "")}><button type="button" onClick={() => setSelected(address)}>{drafts[address] ?? ""}</button></td>;
                    }
                    return renderCell(address);
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="sheet-statusbar">
          <div className="sheet-tabs"><button type="button" className="sheet-tab-plus" title="New workbook" onClick={newWorkbook}>＋</button><button type="button" className="sheet-menu" title="Workbook actions" onClick={() => setRibbonTab("file")}>☰</button><button type="button" className="sheet-tab active" onClick={() => setRibbonTab("home")}>Stock Details <span /></button><button type="button" className={"sheet-tab " + (ribbonTab === "compiler" ? "active" : "")} onClick={() => jumpToCompiler(compilerStage)}>Compiler Output <span /></button></div>
          <div className="sheet-status-right"><span>{Object.keys(drafts).filter(cell => drafts[cell] !== "").length} populated cells</span><span>•</span><span>{formulaCells.length} formulas</span>{errorCount > 0 && <span className="sheet-errors">{errorCount} errors</span>}{lastCalculated && <span>Calculated {lastCalculated.toLocaleTimeString()}</span>}</div>
        </footer>
      </section>

      {showChart && (
        <section className="profit-chart">
          <header><div><div className="sheet-kicker">INSERTED CHART</div><h2>Daily profit overview</h2><p>Derived from the current computed values in column F.</p></div><button type="button" onClick={() => setShowChart(false)}>Hide chart ×</button></header>
          <div className="profit-bars">{positives.map((value, index) => <div className="profit-bar-column" key={index}><strong>{displayNumber(value)}</strong><div className="profit-bar-track"><span className={value < 0 ? "negative" : ""} style={{ height: Math.max(5, Math.abs(value) / maxProfit * 100) + "%" }} /></div><small>{drafts["A" + (index + 2)] || "Day " + (index + 1)}</small></div>)}</div>
        </section>
      )}

      {ribbonTab === "compiler" && renderCompilerPanel()}

      <section className="workbook-footer">
        <div><span className="footer-brand-mark">▦</span><strong>CELLSCRIPT</strong><span>SPREADSHEET FORMULA COMPILER</span></div>
        <div className="footer-metrics"><span>Average profit <strong>{averageProfit === undefined ? "—" : displayNumber(averageProfit)}</strong></span><span>Max high <strong>{maxStock === undefined ? "—" : displayNumber(maxStock)}</strong></span><span>Min low <strong>{minStock === undefined ? "—" : displayNumber(minStock)}</strong></span><span>Rows counted <strong>{tradingDays === undefined ? "—" : displayNumber(tradingDays)}</strong></span></div>
      </section>
    </main>
  );
}
