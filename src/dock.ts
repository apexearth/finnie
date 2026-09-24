// The dockable workspace, as in Henry: watchlist | chart | details by default, every panel
// draggable into tabs, splits or floating windows. Layout is saved per machine (settings.ts). Charts are
// panels too, so there can be several; the one last focused is the one the watchlist drives.
import type { DockviewApi, DockviewTheme, SerializedDockview } from "dockview-react";
import { saveDevice, settings } from "./settings";
import { chartSettings, dropChart, getState, setChart, setState } from "./store";


export const CHART_PREFIX = "chart:";
export const isChartPanel = (id: string) => id.startsWith(CHART_PREFIX);

export const finnieTheme: DockviewTheme = {
  name: "finnie",
  className: "dockview-theme-finnie",
  colorScheme: "dark",
  dndOverlayMounting: "absolute",
  dndPanelOverlay: "group",
};

let api: DockviewApi | null = null;
export const getDockApi = () => api;

export function initDock(a: DockviewApi) {
  api = a;
  let restored = false;
  try {
    const saved = settings().device.layout as SerializedDockview | undefined;
    if (saved) {
      a.fromJSON(saved);
      restored = a.panels.length > 0;
    }
  } catch {
    a.clear();
  }
  if (!restored) buildDefault(a);
  // Settings for charts the layout no longer has are dropped.
  const live = new Set(a.panels.map((p) => p.id));
  for (const id of Object.keys(getState().charts)) if (!live.has(id)) dropChart(id);
  const first = a.panels.find((p) => isChartPanel(p.id));
  setState({ activeChart: first?.id ?? null });

  a.onDidLayoutChange(() => saveDevice({ layout: a.toJSON() }));
  a.onDidActivePanelChange(({ panel: p }) => {
    if (p && isChartPanel(p.id) && getState().activeChart !== p.id) setState({ activeChart: p.id });
  });
  a.onDidRemovePanel((p) => {
    if (!isChartPanel(p.id)) return;
    dropChart(p.id);
    if (getState().activeChart === null) {
      const next = a.panels.find((x) => isChartPanel(x.id));
      if (next) setState({ activeChart: next.id });
    }
  });
}

function buildDefault(a: DockviewApi) {
  a.clear();
  const chart = CHART_PREFIX + "main";
  if (!getState().charts[chart]) setChart(chart, {});
  a.addPanel({ id: chart, component: "chart", title: chartSettings(chart).symbol });
  a.addPanel({ id: "watchlist", component: "watchlist", title: "Watchlist", position: { referencePanel: chart, direction: "left" }, initialWidth: 330 });
  a.addPanel({ id: "details", component: "details", title: "Details", position: { referencePanel: chart, direction: "right" }, initialWidth: 270 });
}

export function resetLayout() {
  if (!api) return;
  saveDevice({ layout: undefined });
  buildDefault(api);
  setState({ activeChart: CHART_PREFIX + "main" });
}

/** Show a symbol: in the active chart, or in a new chart panel beside it. */
export function openSymbol(symbol: string, opts: { newChart?: boolean } = {}) {
  const a = api;
  const s = getState();
  const active = s.activeChart && a?.getPanel(s.activeChart) ? s.activeChart : a?.panels.find((p) => isChartPanel(p.id))?.id;
  if (!a) return;
  if (opts.newChart || !active) {
    const id = CHART_PREFIX + Date.now().toString(36);
    const base = active ? chartSettings(active) : undefined;
    setChart(id, { ...(base ?? {}), symbol });
    a.addPanel({
      id, component: "chart", title: symbol,
      position: active ? { referencePanel: active, direction: "within" } : undefined,
    });
    setState({ activeChart: id });
    return;
  }
  setChart(active, { symbol });
  a.getPanel(active)?.api.setActive();
  setState({ activeChart: active });
}

export function focusPanel(id: string) {
  api?.getPanel(id)?.api.setActive();
}
