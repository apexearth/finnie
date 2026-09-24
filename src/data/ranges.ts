// What each range button fetches and how much of it is shown. Every range fetches more history
// than it shows, so a 200-bar moving average is already warmed up at the left edge.
export type RangeId = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y" | "MAX";

export interface RangeSpec {
  /** Yahoo `range` and `interval`. */
  range: string;
  interval: string;
  /** Candle width in seconds. */
  step: number;
  /** Seconds of history on screen, or a rule for the ranges that are not a fixed length. */
  view: number | "session" | "sessions5" | "ytd" | "all";
  /** How often an open chart re-fetches, in seconds. Daily candles barely move. */
  refresh: number;
}

const DAY = 86400;
export const RANGES: Record<RangeId, RangeSpec> = {
  "1D": { range: "5d", interval: "5m", step: 300, view: "session", refresh: 60 },
  "5D": { range: "1mo", interval: "15m", step: 900, view: "sessions5", refresh: 120 },
  "1M": { range: "6mo", interval: "60m", step: 3600, view: 31 * DAY, refresh: 300 },
  "6M": { range: "2y", interval: "1d", step: DAY, view: 183 * DAY, refresh: 600 },
  YTD: { range: "2y", interval: "1d", step: DAY, view: "ytd", refresh: 600 },
  "1Y": { range: "2y", interval: "1d", step: DAY, view: 365 * DAY, refresh: 600 },
  "5Y": { range: "10y", interval: "1wk", step: 7 * DAY, view: 5 * 365 * DAY, refresh: 3600 },
  MAX: { range: "max", interval: "1mo", step: 30 * DAY, view: "all", refresh: 3600 },
};
export const RANGE_IDS = Object.keys(RANGES) as RangeId[];
export const isIntraday = (r: RangeId) => RANGES[r].step < DAY;

/** First bar time (unix seconds) the range shows, given the bar times fetched. */
export function viewStart(r: RangeId, times: number[], crypto: boolean, now = Date.now() / 1000): number {
  const spec = RANGES[r], last = times[times.length - 1] ?? 0, first = times[0] ?? 0;
  if (typeof spec.view === "number") return Math.max(first, last - spec.view);
  if (spec.view === "all") return first;
  if (spec.view === "ytd") return Math.max(first, Date.UTC(new Date(now * 1000).getUTCFullYear(), 0, 1) / 1000);
  const sessions = spec.view === "session" ? 1 : 5;
  // Crypto never closes: a "session" is a day of clock time.
  if (crypto) return Math.max(first, last - sessions * DAY);
  // A session is a run of bars without an overnight gap; count back that many gaps.
  let seen = 0;
  for (let i = times.length - 1; i > 0; i--) {
    if (times[i]! - times[i - 1]! > 4 * 3600 && ++seen === sessions) return times[i]!;
  }
  return first;
}
