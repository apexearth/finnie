// Keeps quotes fresh: one batched Yahoo request per refresh for every symbol on a list or a
// chart, plus Coinbase's live feed for the crypto among them. Charts fetch their own candles
// (data/charts.ts); this is only the per-symbol numbers.
import { getState, setState, wantedSymbols } from "../store";
import { cacheGet, cachePut } from "./cache";
import { coinbaseProducts, LiveFeed } from "./coinbase";
import type { Quote } from "./types";
import { isCrypto } from "./types";
import { fetchQuotes } from "./yahoo";

type TickFn = (symbol: string, price: number, time: number) => void;
const tickListeners = new Set<TickFn>();
/** Live trades, for charts that want to move their last candle. */
export function onTick(fn: TickFn) {
  tickListeners.add(fn);
  return () => void tickListeners.delete(fn);
}

// Ticks arrive many times a second; the store is told at most twice a second.
let pending: Record<string, { price: number; time: number }> = {};
let flushTimer: ReturnType<typeof setTimeout> | undefined;
function flushTicks() {
  flushTimer = undefined;
  const ticks = pending;
  pending = {};
  setState((s) => {
    const quotes = { ...s.quotes };
    for (const [sym, t] of Object.entries(ticks)) {
      const q = quotes[sym];
      if (q) quotes[sym] = { ...q, price: t.price, time: t.time };
    }
    return { quotes };
  });
}

const feed = new LiveFeed(
  (symbol, price, time) => {
    pending[symbol] = { price, time };
    flushTimer ??= setTimeout(flushTicks, 500);
    tickListeners.forEach((f) => f(symbol, price, time));
  },
  (connected) => setState((s) => ({ live: { ...s.live, connected } })),
);

async function syncLive() {
  const crypto = wantedSymbols().filter(isCrypto);
  let live: string[] = [];
  try {
    const known = await coinbaseProducts();
    live = crypto.filter((s) => known.has(s));
  } catch {
    // Coinbase unreachable: the poll still covers crypto, just not live.
  }
  feed.set(live);
  if (live.join() !== getState().live.symbols.join()) setState((s) => ({ live: { ...s.live, symbols: live } }));
}

let inflight = false;
export async function refreshQuotes() {
  if (inflight) return;
  inflight = true;
  try {
    const symbols = wantedSymbols();
    const got = symbols.length ? await fetchQuotes(symbols) : [];
    const quotes: Record<string, Quote> = { ...getState().quotes };
    for (const q of got) {
      // A live price newer than the poll's stays; the poll still brings the day's line.
      const cur = quotes[q.symbol];
      quotes[q.symbol] = cur && cur.time > q.time ? { ...q, price: cur.price, time: cur.time } : q;
    }
    setState({ quotes, yahoo: { state: "ok", lastOk: Date.now() } });
    void cachePut("quotes", quotes);
  } catch (e) {
    setState((s) => ({ yahoo: { ...s.yahoo, state: "error", error: e instanceof Error ? e.message : String(e) } }));
  } finally {
    inflight = false;
  }
}

let timer: ReturnType<typeof setInterval> | undefined;
let lastWanted = "";
function schedule() {
  clearInterval(timer);
  timer = setInterval(() => {
    if (document.visibilityState === "visible") void refreshQuotes();
  }, getState().refreshSec * 1000);
}

export async function startPolling() {
  const cached = await cacheGet<Record<string, Quote>>("quotes");
  if (cached) setState((s) => ({ quotes: { ...cached, ...s.quotes } }));
  void refreshQuotes();
  void syncLive();
  schedule();
  // A new symbol on a list or chart gets its quote now rather than at the next tick.
  let lastRefresh = getState().refreshSec;
  lastWanted = wantedSymbols().join();
  const check = () => {
    const s = getState();
    if (s.refreshSec !== lastRefresh) {
      lastRefresh = s.refreshSec;
      schedule();
    }
    const w = wantedSymbols(s).join();
    if (w !== lastWanted) {
      const added = w.split(",").some((x) => x && !s.quotes[x]);
      lastWanted = w;
      if (added) void refreshQuotes();
      void syncLive();
    }
  };
  setInterval(check, 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - getState().yahoo.lastOk > getState().refreshSec * 1000) void refreshQuotes();
  });
}
