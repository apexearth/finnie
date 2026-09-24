// Number formatting. Prices get as many decimals as their size needs: 4,321.50, 12.34, 0.004512.
import { YIELDS } from "./defaults";

/** Decimals for a price of this size. A currency pair under 20 (EUR/USD, not USD/JPY) gets 4, as FX is quoted. */
export function decimals(x: number, symbol?: string): number {
  const a = Math.abs(x);
  if (symbol?.endsWith("=X") && a < 20) return 4;
  if (a >= 1) return 2;
  if (a >= 0.01) return 4;
  if (a === 0) return 2;
  return Math.min(10, 2 - Math.floor(Math.log10(a)) + 2);
}

/** `ref` is the price the decimals are chosen for, when x is a difference of prices. */
export function price(x: number | undefined | null, symbol?: string, ref = x): string {
  if (x == null || !Number.isFinite(x)) return "—";
  const d = decimals(ref ?? x, symbol);
  return x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function pct(x: number | undefined | null, sign = true): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return (sign && x > 0 ? "+" : "") + x.toFixed(2) + "%";
}

export function signed(x: number | undefined | null, symbol?: string, ref?: number): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return (x > 0 ? "+" : x < 0 ? "-" : "") + price(Math.abs(x), symbol, ref ?? Math.abs(x));
}

/** 1.2K, 34.5M, 2.1B. */
export function compact(x: number | undefined | null): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return x.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
}

/** A day's move as it is spoken of: yields in basis points, everything else in percent. */
export function move(symbol: string, chg: { abs: number; pct: number } | null | undefined): string {
  if (!chg) return "—";
  if (YIELDS.has(symbol)) {
    const bp = chg.abs * 100;
    return (bp > 0 ? "+" : "") + bp.toFixed(1) + "bp";
  }
  return pct(chg.pct);
}
export const isYield = (symbol: string) => YIELDS.has(symbol);
/** The move from `from` to `to`: basis points for a yield, percent for anything else. */
export function change(symbol: string, from: number | undefined, to: number | undefined): string {
  if (from == null || to == null || !from) return "—";
  return move(symbol, { abs: to - from, pct: (to / from - 1) * 100 });
}
/** The day's move for a header: "+1.23 (+0.45%)", or just "+14.6bp" for a yield. */
export function day(symbol: string, chg: { abs: number; pct: number } | null | undefined, last?: number): string {
  return isYield(symbol) ? move(symbol, chg) : `${signed(chg?.abs, symbol, last)} (${move(symbol, chg)})`;
}
/** A last price, with a yield's percent sign. */
export function quote(symbol: string, x: number | undefined | null): string {
  return price(x, symbol) + (YIELDS.has(symbol) && x != null ? "%" : "");
}

export const tone = (x: number | undefined | null) => (x == null || x === 0 || !Number.isFinite(x) ? "" : x > 0 ? "up" : "down");

export function ago(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
