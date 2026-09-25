import { useEffect, useLayoutEffect } from "react";
import { refreshQuotes } from "./data/poll";
import { RANGE_IDS } from "./data/ranges";
import { openSymbol, resetLayout } from "./dock";
import { FinnieMark } from "./FinnieMark";
import { Keys } from "./Keys";
import { Layout } from "./Layout";
import { Phone, usePhoneShape } from "./Phone";
import { MOD, isMac } from "./platform";
import { StatusBar } from "./StatusBar";
import { Conn, Market, Tape } from "./Glance";
import { REFRESH_CHOICES, getState, setChart, setState, sortedItems, useStore } from "./store";
import { SymbolSearch } from "./SymbolSearch";
import { ThemeMenu } from "./ThemeMenu";

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

/** The desk's shape or the phone's, by the screen; `?mobile=1` / `?desktop=1` force one. */
export function App() {
  const phone = usePhoneShape();
  // Before anything can be tapped, so openSymbol knows which shape it is serving.
  useLayoutEffect(() => setState({ mobile: phone }), [phone]);
  return phone ? <Phone /> : <Desk />;
}

function Desk() {
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
