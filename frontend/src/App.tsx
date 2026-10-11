import { useEffect, useMemo, useState } from "react";

type AnalysisToken = { type: string; text: string; column: number };
type ApiResult = {
  values: Record<string, number>;
  errors: Record<string, string>;
  evaluationOrder: string[];
  tokens: Record<string, AnalysisToken[]>;
  asts: Record<string, string>;
  dependencies: Record<string, string[]>;
};
type DashboardTab = "spreadsheet" | "lexical" | "ast" | "dependencies" | "evaluation";
type TabDefinition = { id: DashboardTab; number: string; title: string; caption: string };
const TABS: TabDefinition[] = [
  { id: "spreadsheet", number: "01", title: "Spreadsheet", caption: "Edit cells" },
  { id: "lexical", number: "02", title: "Lexical analysis", caption: "Token stream" },
  { id: "ast", number: "03", title: "AST parsing", caption: "Syntax tree" },
  { id: "dependencies", number: "04", title: "Dependencies", caption: "Cell graph" },
  { id: "evaluation", number: "05", title: "Evaluation", caption: "Runtime results" }
];
type Status = "connecting" | "online" | "offline";

const API_BASE = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "" : "http://localhost:8080")).replace(/\/$/, "");
const API_PREFIX = import.meta.env.PROD && !import.meta.env.VITE_API_URL ? "/api" : "";
const COLS = Array.from({ length: 10 }, (_, i) => String.fromCharCode(65 + i));
const ROWS = Array.from({ length: 15 }, (_, i) => i + 1);
const INITIAL: Record<string, string> = {
  A1: "1200", A2: "850", A3: "430", A4: "225",
  B1: "540", B2: "300", B3: "175", B4: "95",
  C1: "=A1+B1", C2: "=A2+B2", C3: "=A3+B3", C4: "=A4+B4",
  D1: "=SUM(A1:B4)", D2: "=AVG(C1:C4)", D3: "=MAX(A1:B4)", D4: "=COUNT(A1:B4)",
  E1: "=D1*0.18", E2: "=D1+E1"
};

function displayNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(value);
}
function initialResult(): ApiResult {
  return { values: {}, errors: {}, evaluationOrder: [], tokens: {}, asts: {}, dependencies: {} };
}

export default function App() {
  const [drafts, setDrafts] = useState<Record<string, string>>(INITIAL);
  const [selected, setSelected] = useState("D1");
  const [result, setResult] = useState<ApiResult>(initialResult);
  const [status, setStatus] = useState<Status>("connecting");
  const [lastCalculated, setLastCalculated] = useState<Date | null>(null);

  const formulasAndValues = useMemo(() => {
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
          body: JSON.stringify(formulasAndValues),
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
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [formulasAndValues]);

  useEffect(() => {
    let cancelled = false;
    fetch(API_BASE + API_PREFIX + "/health")
      .then(r => { if (!r.ok) throw new Error("offline"); return r.json(); })
      .then(() => { if (!cancelled) setStatus("online"); })
      .catch(() => { if (!cancelled) setStatus("offline"); });
    return () => { cancelled = true; };
  }, []);

  function updateSelected(value: string) {
    setDrafts(previous => ({ ...previous, [selected]: value }));
  }
  function clearSheet() {
    setDrafts({});
    setResult(initialResult());
  }
  function loadSample() {
    setDrafts(INITIAL);
    setSelected("D1");
  }
  function cellValue(cell: string): { label: string; isError: boolean; tooltip?: string } {
    if (result.errors[cell]) return { label: "#ERROR", isError: true, tooltip: result.errors[cell] };
    if (formulasAndValues.formulas[cell]) {
      return result.values[cell] === undefined
        ? { label: "…", isError: false }
        : { label: displayNumber(result.values[cell]), isError: false };
    }
    if (formulasAndValues.values[cell] !== undefined) {
      return { label: displayNumber(formulasAndValues.values[cell]), isError: false };
    }
    return { label: "", isError: false };
  }

  const selectedFormula = drafts[selected] ?? "";
  const selectedValue = cellValue(selected);
  const errorCount = Object.keys(result.errors).length;
  const formulaCells = Object.keys(formulasAndValues.formulas).sort();
  const selectedTokens = result.tokens?.[selected] ?? [];
  const selectedDependencies = result.dependencies?.[selected] ?? [];
  const selectedAst = result.asts?.[selected];
  const activeTabInfo = TABS.find(tab => tab.id === activeTab) ?? TABS[0];
  const validFormulaCount = Object.keys(result.asts ?? {}).length;
  const tokenCount = selectedTokens.filter(token => token.type !== "EOF" && token.type !== "EndOfInput").length;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="CellScript home">
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span>cellscript<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-right">
          <span className="phase-tag">COMPILER DESIGN · PHASE 2</span>
          <span className={"connection " + status}><i />{status === "online" ? "Engine connected" : status === "connecting" ? "Connecting…" : "Engine offline"}</span>
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow"><span /> SPREADSHEET FORMULA COMPILER</div>
        <h1>Think in cells.<br /><em>Compute with clarity.</em></h1>
        <p>A live formula workspace powered by a C++ compiler, dependency graph analysis, and a topological evaluation engine.</p>
        <div className="hero-pills">
          <span><b>01</b> Lexical analysis</span><span><b>02</b> AST parsing</span>
          <span><b>03</b> Dependency resolution</span><span><b>04</b> Evaluation</span>
        </div>
      </section>

      <nav className="stage-tabs" aria-label="Compiler dashboard tabs">
        {TABS.map(tab => (
          <button
            type="button"
            key={tab.id}
            className={"stage-tab " + (activeTab === tab.id ? "active" : "")}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            <span className="stage-tab-number">{tab.number}</span>
            <span className="stage-tab-copy"><strong>{tab.title}</strong><small>{tab.caption}</small></span>
            {activeTab === tab.id && <span className="stage-tab-active">ACTIVE</span>}
          </button>
        ))}
      </nav>

      <section className="workspace">
        <div className="workbar">
          <div className="workbar-title"><span className="sheet-icon">▦</span><div><strong>Untitled workbook</strong><small>Single-sheet formula workspace</small></div></div>
          <div className="workbar-actions">
            <button className="button button-quiet" onClick={clearSheet}>Clear sheet</button>
            <button className="button button-primary" onClick={loadSample}>↻ Load sample</button>
          </div>
        </div>

        <div className="formula-toolbar">
          <div className="name-box">{selected}</div>
          <div className="fx-label">ƒx</div>
          <input aria-label={"Formula for " + selected} value={selectedFormula}
            onChange={e => updateSelected(e.target.value)}
            placeholder="Enter a number or a formula starting with =" />
          <div className="formula-result">{selectedValue.isError ? "!" : selectedValue.label}</div>
        </div>

        <div className="sheet-scroll">
          <table className="sheet-grid" aria-label="Spreadsheet cells">
            <thead><tr><th className="corner" />
              {COLS.map(col => <th key={col} className={selected.startsWith(col) ? "selected-col" : ""}>{col}</th>)}
            </tr></thead>
            <tbody>{ROWS.map(row => <tr key={row}>
              <th className="row-number">{row}</th>
              {COLS.map(col => {
                const cell = col + row;
                const info = cellValue(cell);
                const isSelected = cell === selected;
                const formula = (drafts[cell] ?? "").trim().startsWith("=");
                return <td key={cell} className={[
                  isSelected ? "selected-cell" : "",
                  info.isError ? "error-cell" : "",
                  formula ? "formula-cell" : "",
                  drafts[cell] && !formula && formulasAndValues.values[cell] !== undefined ? "input-cell" : ""
                ].filter(Boolean).join(" ")}>
                  <button title={info.tooltip || (drafts[cell] ? (formula ? drafts[cell] : "Value: " + drafts[cell]) : cell)}
                    onClick={() => setSelected(cell)} aria-label={cell + (info.label ? ": " + info.label : "")}>
                    {info.label || <span className="empty-cell">·</span>}
                  </button>
                </td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>

        <div className="sheet-footer">
          <div className="sheet-tab"><span>▦</span> Sheet1 <i /></div>
          <div className="sheet-footer-meta">
            <span>{Object.keys(drafts).filter(c => (drafts[c] ?? "").trim() !== "").length} populated cells</span>
            <span className="footer-separator">·</span>
            <span>{Object.keys(formulasAndValues.formulas).length} formulas</span>
            {errorCount > 0 && <span className="error-summary">{errorCount} error{errorCount === 1 ? "" : "s"} detected</span>}
            {lastCalculated && <span className="calculated-time">Calculated {lastCalculated.toLocaleTimeString()}</span>}
          </div>
        </div>
      </section>

      {activeTab !== "spreadsheet" && (
        <section className="diagnostics-panel" aria-live="polite">
          <header className="diagnostics-header">
            <div>
              <div className="panel-eyebrow">COMPILER WORKBENCH / {activeTabInfo.number}</div>
              <h2>{activeTabInfo.title}</h2>
              <p>{activeTabInfo.caption} for the currently selected formula cell.</p>
            </div>
            <label className="cell-picker">
              <span>INSPECT CELL</span>
              <select value={selected} onChange={event => setSelected(event.target.value)}>
                {(Object.keys(drafts).length ? Object.keys(drafts).sort() : [selected]).map(cell => (
                  <option value={cell} key={cell}>{cell}</option>
                ))}
              </select>
            </label>
          </header>

          {activeTab === "lexical" && (
            <div className="diagnostic-body">
              <div className="diagnostic-metrics">
                <div><span>Source formula</span><strong className="metric-formula">{drafts[selected] || "—"}</strong></div>
                <div><span>Tokens emitted</span><strong>{tokenCount}</strong></div>
                <div><span>Lexer status</span><strong className={result.errors[selected] && !result.tokens?.[selected] ? "metric-error" : "metric-good"}>{result.errors[selected] && !result.tokens?.[selected] ? "Error" : selectedTokens.length ? "Complete" : "Waiting"}</strong></div>
              </div>
              {result.errors[selected] && !result.tokens?.[selected] ? (
                <div className="diagnostic-alert"><strong>Lexical / syntax diagnostic</strong><p>{result.errors[selected]}</p><small>Check the formula prefix, function name and characters, then edit the cell in the formula bar.</small></div>
              ) : selectedTokens.length ? (
                <div className="data-table-wrap">
                  <table className="diagnostic-table">
                    <thead><tr><th>#</th><th>Token type</th><th>Lexeme</th><th>Column</th><th>Status</th></tr></thead>
                    <tbody>{selectedTokens.map((token, index) => (
                      <tr key={selected + "-" + index}>
                        <td className="mono muted-cell">{String(index + 1).padStart(2, "0")}</td>
                        <td><span className="token-badge">{token.type}</span></td>
                        <td className="mono token-lexeme">{token.text || "∅"}</td>
                        <td className="mono muted-cell">{token.column}</td>
                        <td><span className="status-dot status-dot-good" /> emitted</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <div className="empty-diagnostic"><span>∅</span><strong>No formula to tokenize</strong><p>Select a cell with a formula beginning with <code>=</code>, or enter one in the formula bar.</p></div>}
            </div>
          )}

          {activeTab === "ast" && (
            <div className="diagnostic-body">
              <div className="diagnostic-section-heading"><div><span className="section-marker">AST</span><strong>Abstract syntax tree</strong></div><span>{selectedAst ? "PARSE SUCCESS" : "NO TREE"}</span></div>
              {selectedAst ? (
                <div className="ast-workspace">
                  <div className="ast-source"><span>INPUT FORMULA</span><code>{drafts[selected] || "—"}</code></div>
                  <pre className="ast-tree">{selectedAst}</pre>
                  <div className="ast-footnote"><span className="status-dot status-dot-good" /> Recursive-descent parser produced a syntax tree for {selected}.</div>
                </div>
              ) : (
                <div className="diagnostic-alert"><strong>AST not available</strong><p>{result.errors[selected] || "This cell has no formula yet."}</p><small>Correct the formula to generate its abstract syntax tree.</small></div>
              )}
            </div>
          )}

          {activeTab === "dependencies" && (
            <div className="diagnostic-body">
              <div className="diagnostic-metrics">
                <div><span>Formula cells</span><strong>{formulaCells.length}</strong></div>
                <div><span>Selected dependencies</span><strong>{selectedDependencies.length}</strong></div>
                <div><span>Cycle / error report</span><strong className={errorCount ? "metric-error" : "metric-good"}>{errorCount ? errorCount + " issue(s)" : "Clear"}</strong></div>
              </div>
              {formulaCells.length ? (
                <div className="dependency-list">
                  {formulaCells.map(cell => {
                    const dependencies = result.dependencies?.[cell] ?? [];
                    return (
                      <article className={"dependency-row " + (cell === selected ? "dependency-row-selected" : "")} key={cell}>
                        <button className="dependency-source" onClick={() => setSelected(cell)} title={"Inspect " + cell}>
                          <span className="dep-kind">FORMULA</span><strong>{cell}</strong><code>{drafts[cell]}</code>
                          {result.errors[cell] && <span className="dep-error">ERROR</span>}
                          {!result.errors[cell] && result.values[cell] !== undefined && <span className="dep-value">{displayNumber(result.values[cell])}</span>}
                        </button>
                        <div className="dependency-arrow"><span>depends on</span><b>→</b></div>
                        <div className="dependency-targets">
                          {dependencies.length ? dependencies.map(dep => {
                            const isFormula = Boolean(formulasAndValues.formulas[dep]);
                            const hasValue = formulasAndValues.values[dep] !== undefined || result.values[dep] !== undefined;
                            return <button key={cell + "-" + dep} type="button"
                              className={"dependency-chip " + (isFormula ? "dep-formula" : hasValue ? "dep-input" : "dep-blank")}
                              onClick={() => { setSelected(dep); }}
                              title={isFormula ? "Formula dependency" : hasValue ? "Input value" : "Blank cell in referenced range"}>
                              {dep}<small>{isFormula ? "ƒx" : hasValue ? "IN" : "BLANK"}</small>
                            </button>;
                          }) : <span className="no-dependencies">No cell dependencies</span>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : <div className="empty-diagnostic"><span>↗</span><strong>No dependency graph yet</strong><p>Add a formula such as <code>=A1+B1</code> to see its references here.</p></div>}
              <p className="diagnostic-note">Range references are expanded into individual cell addresses. Blank cells appear as BLANK, and formula cells are marked ƒx.</p>
            </div>
          )}

          {activeTab === "evaluation" && (
            <div className="diagnostic-body">
              <div className="diagnostic-metrics">
                <div><span>Evaluation order</span><strong>{result.evaluationOrder.length}</strong></div>
                <div><span>Calculated formulas</span><strong>{Object.keys(result.values).length}</strong></div>
                <div><span>Errors</span><strong className={errorCount ? "metric-error" : "metric-good"}>{errorCount}</strong></div>
              </div>
              {result.evaluationOrder.length ? (
                <div className="data-table-wrap">
                  <table className="diagnostic-table">
                    <thead><tr><th>Order</th><th>Cell</th><th>Formula</th><th>Computed value</th><th>Result</th></tr></thead>
                    <tbody>{result.evaluationOrder.map((cell, index) => (
                      <tr key={cell} className={cell === selected ? "evaluation-selected" : ""}>
                        <td className="mono muted-cell">{String(index + 1).padStart(2, "0")}</td>
                        <td><button className="cell-link" onClick={() => setSelected(cell)}>{cell}</button></td>
                        <td className="mono formula-text">{drafts[cell] || "—"}</td>
                        <td className="mono">{result.values[cell] === undefined ? "—" : displayNumber(result.values[cell])}</td>
                        <td>{result.errors[cell] ? <span className="result-error">ERROR</span> : result.values[cell] !== undefined ? <span className="result-success">SUCCESS</span> : <span className="muted-cell">NO VALUE</span>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <div className="empty-diagnostic"><span>∑</span><strong>No evaluation results yet</strong><p>Enter formulas into the spreadsheet. Results and errors will appear here.</p></div>}
              {errorCount > 0 && <div className="diagnostic-alert"><strong>Cell diagnostics</strong>{Object.entries(result.errors).map(([cell, message]) => <p key={cell}><code>{cell}</code> — {message}</p>)}</div>}
            </div>
          )}
        </section>
      )}

      <section className="bottom-grid">
        <article className="info-panel">
          <div className="panel-eyebrow">COMPILER PIPELINE</div>
          <h2>Under the hood</h2>
          <div className="pipeline-list">
            <button type="button" onClick={() => setActiveTab("lexical")}><span className="step-num">01</span><span><strong>Lex</strong><small>Formula text → token stream</small></span><span className="step-check">↗</span></button>
            <button type="button" onClick={() => setActiveTab("ast")}><span className="step-num">02</span><span><strong>Parse</strong><small>Token stream → AST</small></span><span className="step-check">↗</span></button>
            <button type="button" onClick={() => setActiveTab("dependencies")}><span className="step-num">03</span><span><strong>Analyze</strong><small>Dependencies + cycle checks</small></span><span className="step-check">↗</span></button>
            <button type="button" onClick={() => setActiveTab("evaluation")}><span className="step-num">04</span><span><strong>Evaluate</strong><small>Order → cell values</small></span><span className="step-check">↗</span></button>
          </div>
        </article>
        <article className="info-panel examples-panel">
          <div className="panel-eyebrow">QUICK START</div>
          <h2>Try a formula</h2>
          <p>Select any cell, then type a value or formula into the formula bar.</p>
          <button type="button" className="example-line" onClick={() => { setSelected("D1"); setActiveTab("lexical"); }}><code>=SUM(A1:B4)</code><span>Inspect its tokens →</span></button>
          <button type="button" className="example-line" onClick={() => { setSelected("C1"); setActiveTab("ast"); }}><code>=A1+B1</code><span>Inspect its AST →</span></button>
          <button type="button" className="example-line" onClick={() => setActiveTab("evaluation")}><code>Evaluation order</code><span>Open runtime results →</span></button>
          <div className="help-note">{status === "offline" ? "Start the C++ API with make server to enable live calculations." : "Results recalculate automatically after each edit."}</div>
        </article>
      </section>

      <footer className="page-footer"><span>CELLSCRIPT <b>·</b> BCSE307L COMPILER DESIGN</span><span>C++17 · REACT · DEPENDENCY GRAPH</span></footer>
    </main>
  );
}