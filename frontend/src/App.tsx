import { useEffect, useMemo, useState } from "react";

type ApiResult = {
  values: Record<string, number>;
  errors: Record<string, string>;
  evaluationOrder: string[];
};
type Status = "connecting" | "online" | "offline";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/$/, "");
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
  return { values: {}, errors: {}, evaluationOrder: [] };
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
        const response = await fetch(API_URL + "/evaluate", {
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
    fetch(API_URL + "/health")
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

      <section className="bottom-grid">
        <article className="info-panel">
          <div className="panel-eyebrow">COMPILER PIPELINE</div>
          <h2>Under the hood</h2>
          <div className="pipeline-list">
            <div><span className="step-num">01</span><span><strong>Parse</strong><small>Formula text → AST</small></span><span className="step-check">✓</span></div>
            <div><span className="step-num">02</span><span><strong>Analyze</strong><small>Symbol table + cycle detection</small></span><span className="step-check">✓</span></div>
            <div><span className="step-num">03</span><span><strong>Order</strong><small>Dependency-aware evaluation</small></span><span className="step-check">✓</span></div>
          </div>
        </article>
        <article className="info-panel examples-panel">
          <div className="panel-eyebrow">QUICK START</div>
          <h2>Try a formula</h2>
          <p>Select any cell, then type a value or formula into the formula bar.</p>
          <div className="example-line"><code>=SUM(A1:B4)</code><span>Sum a cell range</span></div>
          <div className="example-line"><code>=AVG(C1:C4)</code><span>Calculate an average</span></div>
          <div className="example-line"><code>=A1+B1*2</code><span>Arithmetic precedence</span></div>
          <div className="help-note">{status === "offline" ? "Start the C++ API with make server to enable live calculations." : "Results recalculate automatically after each edit."}</div>
        </article>
      </section>

      <footer className="page-footer"><span>CELLSCRIPT <b>·</b> BCSE307L COMPILER DESIGN</span><span>C++17 · REACT · DEPENDENCY GRAPH</span></footer>
    </main>
  );
}