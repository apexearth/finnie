import { useEffect, useState } from "react";
import { refreshQuotes } from "./data/poll";
import { RANGE_IDS } from "./data/ranges";
import { openSymbol, resetLayout } from "./dock";
import { FinnieMark } from "./FinnieMark";
import * as f from "./fmt";
import { Keys } from "./Keys";
import { Layout } from "./Layout";
import { span, usMarket } from "./market";
import { MOD, isMac } from "./platform";
import { StatusBar } from "./StatusBar";
import { REFRESH_CHOICES, TAPE, dayChange, getState, setChart, setState, sortedItems, useStore } from "./store";
import { SymbolSearch } from "./SymbolSearch";
import { ThemeMenu } from "./ThemeMenu";


function useNow(ms: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function Market() {
  const now = useNow(30_000);
  const m = usMarket(new Date(now));
  return (
    <span className={"market" + (m.open ? " open" : "")} title="US stock market, regular hours (holidays not known)">
      <span className="dot" />
      {m.open ? `US open · closes in ${span(m.minutes)}` : `US closed · opens in ${span(m.minutes)}`}
    </span>
  );
}

function Tape() {
  const quotes = useStore((s) => s.quotes);
  return (
    <div className="tape">
      {TAPE.map((t) => {
        const q = quotes[t.symbol], c = dayChange(q);
        return (
          <button key={t.symbol} className="tape-item num" onClick={() => openSymbol(t.symbol)} title={t.symbol}>
            {t.label} <b>{f.quote(t.symbol, q?.price)}</b> <span className={f.tone(c?.pct)}>{f.move(t.symbol, c)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Conn() {
  const y = useStore((s) => s.yahoo);
  const refreshSec = useStore((s) => s.refreshSec);
  const now = useNow(5_000);
  const stale = y.state === "ok" && now - y.lastOk > refreshSec * 3000;
  const cls = y.state === "error" ? "" : stale ? " stale" : y.state === "ok" ? " on" : " stale";
  const title = y.state === "error" ? `data: ${y.error}` : y.lastOk ? `data updated ${f.ago(y.lastOk, now)}` : "connecting";
  return <span className={"conn" + cls} title={title}>●</span>;
}

function RefreshPick() {
  const refreshSec = useStore((s) => s.refreshSec);
  const label = (s: number) => (s < 60 ? `${s}s` : `${s / 60}m`);
  return (
    <select className="topbar-btn" value={refreshSec} title="how often quotes refresh" onChange={(e) => setState({ refreshSec: Number(e.target.value) })}>
      {REFRESH_CHOICES.map((s) => <option key={s} value={s}>every {label(s)}</option>)}
    </select>
  );
}

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

export function App() {
  const search = useStore((s) => s.search);
  const keys = useStore((s) => s.keys);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      const s = getState();
      if (mod && !e.shiftKey && !e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setState({ search: s.search ? null : { mode: "open" } });
        return;
      }
      if (mod && !e.shiftKey && e.key === "/") {
        e.preventDefault();
        setState({ keys: !s.keys });
        return;
      }
      if (mod && e.shiftKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        resetLayout();
        return;
      }
      if (e.key === "Escape" && s.keys) return setState({ keys: false });
      if (mod || e.altKey || e.metaKey || e.ctrlKey || typing(e.target) || s.search || s.keys) return;
      if (e.key === "/") {
        e.preventDefault();
        setState({ search: { mode: "open" } });
      } else if (e.key === "a") {
        e.preventDefault();
        setState({ search: { mode: "add" } });
      } else if (e.key === "r") {
        void refreshQuotes();
      } else if (/^[1-8]$/.test(e.key) && s.activeChart) {
        setChart(s.activeChart, { range: RANGE_IDS[Number(e.key) - 1]! });
      } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !(e.target as HTMLElement)?.closest?.(".tv-lightweight-charts")) {
        // Walk the watchlist, wrapping, from the symbol on the active chart.
        const rows = sortedItems(s);
        if (!rows.length) return;
        e.preventDefault();
        const cur = s.activeChart ? s.charts[s.activeChart]?.symbol : undefined;
        const i = rows.findIndex((r) => r.symbol === cur);
        const next = rows[(i + (e.key === "ArrowUp" ? -1 : 1) + rows.length) % rows.length]!;
        openSymbol(next.symbol);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <div className="app">
      <div className="topbar">
        <FinnieMark />
        <span className="brand">finnie</span>
        <Conn />
        <span className="topbar-sep" />
        <Market />
        <span className="topbar-sep" />
        <Tape />
        <span style={{ flex: 1 }} />
        <button className="topbar-btn" onClick={() => setState({ search: { mode: "new" } })} title="open a symbol in a new chart tab">+ chart</button>
        <RefreshPick />
        <ThemeMenu />
        <button className="topbar-btn" onClick={() => setState({ keys: true })} title={`keyboard shortcuts (${MOD}/)`}>keys</button>
        <button className="topbar-btn" onClick={resetLayout} title="back to watchlist | chart | details">reset layout</button>
      </div>
      <Layout />
      <StatusBar />
      {search && <SymbolSearch mode={search.mode} />}
      {keys && <Keys onClose={() => setState({ keys: false })} />}
    </div>
  );
}
