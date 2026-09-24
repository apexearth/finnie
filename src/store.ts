// All app state in one plain module, read through useStore(selector) the way Henry's ws.ts is.
// Watchlists and preferences persist to the settings file (settings.ts); quotes are cached in
// IndexedDB by the poller (data/poll.ts).
import { useSyncExternalStore } from "react";
import type { RangeId } from "./data/ranges";
import type { Quote } from "./data/types";
import { DEFAULT_NAMES } from "./defaults";
import { onSaveResult, saveDevice, saveDoc, settings, type SettingsFile } from "./settings";
import { itemKey, listKey, listsFrom, nameKey, namesFrom, posAt, put, type Doc } from "./sync/doc";

export interface WatchItem {
  symbol: string;
}
export interface Watchlist {
  id: string;
  name: string;
  items: WatchItem[];
}

export type IndicatorKind = "sma" | "ema" | "bb" | "vol" | "rsi" | "macd";
export interface Indicator {
  id: string;
  kind: IndicatorKind;
  /** Length for sma/ema/bb/rsi; macd uses 12/26/9 and volume has none. */
  period: number;
  on: boolean;
}
export type ChartStyle = "candle" | "line" | "area";
export interface ChartSettings {
  symbol: string;
  range: RangeId;
  style: ChartStyle;
  indicators: Indicator[];
}

export type SourceState = "idle" | "ok" | "error";
export type ListSort = "manual" | "chg-desc" | "chg-asc" | "sym";
export interface State {
  lists: Watchlist[];
  listId: string;
  sort: ListSort;
  /** The symbol picker, when open: "open" shows the pick on a chart, "add" puts it on the list. */
  search: null | { mode: "open" | "add" | "new" };
  keys: boolean;
  /** Display names learned from search and charts, so a row can say more than its ticker. */
  names: Record<string, string>;
  quotes: Record<string, Quote>;
  /** Keyed by chart panel id. */
  charts: Record<string, ChartSettings>;
  activeChart: string | null;
  refreshSec: number;
  yahoo: { state: SourceState; lastOk: number; error?: string };
  live: { connected: boolean; symbols: string[] };
  /** The last failed write of the settings file, shown until one succeeds. */
  saveError: string | null;
}

export const REFRESH_CHOICES = [30, 60, 120, 300, 600];
/** The markets at a glance, in the topbar. */
export const TAPE = [
  { symbol: "^GSPC", label: "S&P" },
  { symbol: "^IXIC", label: "NDQ" },
  { symbol: "^VIX", label: "VIX" },
  { symbol: "^TNX", label: "10Y" },
  { symbol: "DX-Y.NYB", label: "DXY" },
  { symbol: "CL=F", label: "OIL" },
  { symbol: "GC=F", label: "GOLD" },
  { symbol: "BTC-USD", label: "BTC" },
];

export const DEFAULT_INDICATORS: Indicator[] = [
  { id: "vol", kind: "vol", period: 0, on: true },
  { id: "sma50", kind: "sma", period: 50, on: true },
  { id: "sma200", kind: "sma", period: 200, on: true },
  { id: "ema21", kind: "ema", period: 21, on: false },
  { id: "bb", kind: "bb", period: 20, on: false },
  { id: "rsi", kind: "rsi", period: 14, on: false },
  { id: "macd", kind: "macd", period: 0, on: false },
];
export const defaultChart = (symbol = "SPY"): ChartSettings => ({ symbol, range: "6M", style: "candle", indicators: DEFAULT_INDICATORS });

// The synced half of the settings file; lists and names in the state are drawn from it.
let doc: Doc = {};
// Default names always win: they are written to be read, Yahoo's are not ("CBOE Interest Rate 10 Year T No").
const namesOf = (d: Doc) => ({ ...namesFrom(d), ...DEFAULT_NAMES });

let state: State = {
  lists: [],
  listId: "",
  sort: "manual",
  search: null,
  keys: false,
  names: DEFAULT_NAMES,
  quotes: {},
  charts: {},
  activeChart: null,
  refreshSec: 60,
  yahoo: { state: "idle", lastOk: 0 },
  live: { connected: false, symbols: [] },
  saveError: null,
};

/** Fills the state from the settings file; main.tsx calls it before the first render. */
export function initStore(f: SettingsFile) {
  doc = f.doc;
  const lists = listsFrom(doc);
  const d = f.device;
  state = {
    ...state,
    lists,
    listId: lists.some((l) => l.id === d.listId) ? d.listId! : (lists[0]?.id ?? ""),
    sort: (d.sort as ListSort | undefined) ?? "manual",
    names: namesOf(doc),
    charts: (d.charts as Record<string, ChartSettings> | undefined) ?? {},
    refreshSec: d.refreshSec ?? 60,
  };
  onSaveResult((error) => error !== state.saveError && setState({ saveError: error }));
}

/** A new doc, from an edit here or (later) a merge with another machine. */
export function commitDoc(next: Doc) {
  doc = next;
  saveDoc(doc);
  setState((s) => {
    const lists = listsFrom(doc);
    return { lists, names: namesOf(doc), listId: lists.some((l) => l.id === s.listId) ? s.listId : (lists[0]?.id ?? "") };
  });
}
const edit = (key: string, v: unknown) => commitDoc(put(doc, key, v, settings().device.id));

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
export const getState = () => state;
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}

// This machine's preferences, saved to the device half of the settings file as they change.
const DEVICE_KEYS = ["listId", "sort", "charts", "refreshSec"] as const;
export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  const dev = DEVICE_KEYS.filter((k) => k in p);
  if (dev.length) saveDevice(Object.fromEntries(dev.map((k) => [k, state[k]])));
  listeners.forEach((f) => f());
}

// Watchlists. Every edit is one key in the doc (sync/doc.ts), so it can meet other machines' edits.
export const activeList = (s: State = state) => s.lists.find((l) => l.id === s.listId) ?? s.lists[0]!;
const listOf = (id: string) => state.lists.find((l) => l.id === id);
const listVal = (id: string) => doc[listKey(id)]?.v as { name: string; pos: number } | null | undefined;

export function addToList(symbol: string, listId = state.listId) {
  const l = listOf(listId);
  if (!l || l.items.some((i) => i.symbol === symbol)) return;
  const keys = l.items.map((i) => itemKey(listId, i.symbol));
  edit(itemKey(listId, symbol), { pos: posAt(doc, keys, keys.length) });
}
export function removeFromList(symbol: string, listId = state.listId) {
  edit(itemKey(listId, symbol), null);
}
/** `to` is the index among the other rows, as Array.splice would put it. */
export function moveInList(listId: string, from: number, to: number) {
  const l = listOf(listId), it = l?.items[from];
  if (!l || !it) return;
  const others = l.items.filter((_, i) => i !== from).map((i) => itemKey(listId, i.symbol));
  edit(itemKey(listId, it.symbol), { pos: posAt(doc, others, to) });
}
export function newList(name: string) {
  const id = "l" + Date.now().toString(36);
  const keys = state.lists.map((l) => listKey(l.id));
  edit(listKey(id), { name, pos: posAt(doc, keys, keys.length) });
  setState({ listId: id });
}
export function renameList(id: string, name: string) {
  const v = listVal(id);
  if (v) edit(listKey(id), { ...v, name });
}
export function deleteList(id: string) {
  if (state.lists.length > 1) edit(listKey(id), null);
}
export function learnName(symbol: string, name: string) {
  if (name && name !== symbol && !(symbol in DEFAULT_NAMES) && state.names[symbol] !== name) edit(nameKey(symbol), name);
}

// Charts.
export function chartSettings(id: string): ChartSettings {
  return state.charts[id] ?? defaultChart();
}
export function setChart(id: string, patch: Partial<ChartSettings>) {
  setState((s) => ({ charts: { ...s.charts, [id]: { ...(s.charts[id] ?? defaultChart()), ...patch } } }));
}
export function dropChart(id: string) {
  setState((s) => {
    const { [id]: _, ...charts } = s.charts;
    return { charts, activeChart: s.activeChart === id ? null : s.activeChart };
  });
}

/** The active list's rows in the order they are drawn. */
export function sortedItems(s: State = state): WatchItem[] {
  const items = activeList(s).items;
  if (s.sort === "manual") return items;
  const chg = (sym: string) => dayChange(s.quotes[sym])?.pct ?? -Infinity;
  const out = [...items];
  if (s.sort === "sym") out.sort((a, b) => a.symbol.localeCompare(b.symbol));
  else out.sort((a, b) => (s.sort === "chg-desc" ? chg(b.symbol) - chg(a.symbol) : chg(a.symbol) - chg(b.symbol)));
  return out;
}

/** Every symbol something on screen could want a quote for. */
export function wantedSymbols(s: State = state): string[] {
  const set = new Set<string>();
  for (const l of s.lists) for (const i of l.items) set.add(i.symbol);
  for (const c of Object.values(s.charts)) set.add(c.symbol);
  for (const t of TAPE) set.add(t.symbol);
  return [...set];
}

/** Day change for a symbol, from its quote. */
export function dayChange(q: Quote | undefined): { abs: number; pct: number } | null {
  if (!q || !q.prevClose) return null;
  return { abs: q.price - q.prevClose, pct: (q.price / q.prevClose - 1) * 100 };
}
