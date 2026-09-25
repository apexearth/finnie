// The phone's shape of the same page, as in Henry: one panel filling the screen, picked from a
// bar under the thumb. The panels are the desk's own. A phone reaches this page over Tailscale
// from a desktop running Finnie, whose dev server fetches its quotes and holds its lists.
import { useEffect, useState } from "react";
import { Conn, Market, Tape } from "./Glance";
import { CHART_PREFIX } from "./dock";
import { FinnieMark } from "./FinnieMark";
import { ChartPanel } from "./panels/Chart";
import { Details } from "./panels/Details";
import { Watchlist } from "./panels/Watchlist";
import { getState, setChart, setState, useStore, type State } from "./store";
import { SymbolSearch } from "./SymbolSearch";
import { ThemeMenu } from "./ThemeMenu";

const QUERY = "(max-width: 700px), (pointer: coarse) and (max-width: 1024px)";
const forced = (): boolean | null => {
  const q = new URLSearchParams(location.search);
  return q.has("mobile") ? true : q.has("desktop") ? false : null;
};

export function usePhoneShape(): boolean {
  const [phone, setPhone] = useState(() => forced() ?? matchMedia(QUERY).matches);
  useEffect(() => {
    if (forced() != null) return;
    const m = matchMedia(QUERY);
    const on = () => setPhone(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return phone;
}

const VIEWS: [State["view"], string][] = [["list", "Lists"], ["chart", "Chart"], ["details", "Details"]];

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="7" cy="7" r="4.8" />
      <path d="M10.6 10.6 14 14" strokeLinecap="round" />
    </svg>
  );
}

export function Phone() {
  const view = useStore((s) => s.view);
  const search = useStore((s) => s.search);
  const chartId = useStore((s) => s.activeChart);

  // The chart a phone shows: the one it last had, or a first one.
  useEffect(() => {
    const s = getState();
    if (s.activeChart && s.charts[s.activeChart]) return;
    const id = Object.keys(s.charts)[0] ?? CHART_PREFIX + "main";
    if (!s.charts[id]) setChart(id, {});
    setState({ activeChart: id });
  }, []);

  return (
    <div className="app phone">
      <div className="p-top">
        <FinnieMark />
        <span className="brand">finnie</span>
        <Conn />
        <Market />
        <span style={{ flex: 1 }} />
        <button className="topbar-btn p-icon" onClick={() => setState({ search: { mode: "open" } })} aria-label="search"><SearchIcon /></button>
        <ThemeMenu />
      </div>
      <Tape />
      <div className="p-body">
        {view === "chart" ? (chartId && <ChartPanel key={chartId} id={chartId} />) : view === "details" ? <Details /> : <Watchlist />}
      </div>
      <nav className="p-nav">
        {VIEWS.map(([v, label]) => (
          <button key={v} className={v === view ? "on" : ""} onClick={() => setState({ view: v })}>{label}</button>
        ))}
      </nav>
      {search && <SymbolSearch mode={search.mode} />}
    </div>
  );
}
