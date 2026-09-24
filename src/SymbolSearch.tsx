// The symbol picker (Ctrl+K), laid out like Henry's file picker. Enter shows the pick on the
// chart; the "+" on a row (or Ctrl+Enter) puts it on the current watchlist instead.
import { useEffect, useRef, useState } from "react";
import { search } from "./data/yahoo";
import type { SearchHit } from "./data/types";
import { openSymbol } from "./dock";
import { activeList, addToList, learnName, setState, useStore } from "./store";

export function SymbolSearch({ mode }: { mode: "open" | "add" | "new" }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const list = useStore((s) => activeList(s));
  const seq = useRef(0);
  const close = () => setState({ search: null });

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setHits([]);
      return;
    }
    const n = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await search(term);
        if (n !== seq.current) return;
        setHits(r);
        setErr(null);
        setSel(0);
      } catch (e) {
        if (n === seq.current) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (n === seq.current) setBusy(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  // What Enter acts on: the highlighted hit, or the text itself as a ticker if nothing matched.
  const typed = q.trim().toUpperCase();
  const rows: SearchHit[] = hits.length ? hits : typed ? [{ symbol: typed, name: "use as typed", exchange: "", kind: "" }] : [];

  const pick = (h: SearchHit, add: boolean, newChart = false) => {
    if (h.name !== "use as typed") learnName(h.symbol, h.name);
    if (add || mode === "add") {
      addToList(h.symbol);
      if (mode === "add") return; // stay open: adding several in a row is the common case
    }
    close();
    openSymbol(h.symbol, { newChart: newChart || mode === "new" });
  };
  const onList = new Set(list.items.map((i) => i.symbol));

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal">
        <h3>{mode === "add" ? `Add to ${list.name}` : mode === "new" ? "Open in a new chart" : "Go to symbol"}</h3>
        <input className="picker-input" autoFocus placeholder="ticker or name: AAPL, bitcoin, s&p 500…" value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(rows.length - 1, s + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            else if (e.key === "Enter" && rows[sel]) {
              e.preventDefault();
              pick(rows[sel]!, e.ctrlKey || e.metaKey, e.shiftKey);
              if (mode === "add") setQ("");
            }
          }} />
        <div className="list">
          {rows.map((h, i) => (
            <div key={h.symbol + i} className={"row" + (i === sel ? " sel" : "")} onMouseEnter={() => setSel(i)} onClick={() => pick(h, false)}>
              <b>{h.symbol}</b>
              <span className="nm">{h.name}</span>
              <span className="ex">{[h.kind, h.exchange].filter(Boolean).join(" · ")}</span>
              <button className={"add" + (onList.has(h.symbol) ? " on" : "")} title={`add to ${list.name}`}
                onClick={(e) => { e.stopPropagation(); if (!onList.has(h.symbol)) { learnName(h.symbol, h.name); addToList(h.symbol); } }}>
                {onList.has(h.symbol) ? "✓" : "+"}
              </button>
            </div>
          ))}
          {!rows.length && <div className="note">{busy ? "searching…" : "Type to search stocks, ETFs, indexes and crypto."}</div>}
          {err && <div className="note down">search failed: {err}</div>}
        </div>
        <div className="foot">
          <span>↑↓ choose · Enter {mode === "add" ? "add" : "open"}{mode !== "add" && " · Shift+Enter new chart"} · Ctrl+Enter add to {list.name}</span>
          <span>{busy ? "…" : ""}</span>
        </div>
      </div>
    </div>
  );
}
