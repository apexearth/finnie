// Candles for a symbol and range: the cached copy first, then Yahoo, then (for crypto) Coinbase.
// One request in flight per symbol and range, however many panels ask.
import { cacheGet, cachePut } from "./cache";
import { coinbaseProducts, fetchCoinbaseChart } from "./coinbase";
import type { RangeId } from "./ranges";
import { isCrypto, type ChartData } from "./types";
import { fetchChart } from "./yahoo";

const key = (symbol: string, range: RangeId) => `chart:${symbol}:${range}`;
const inflight = new Map<string, Promise<ChartData>>();

export function cachedChart(symbol: string, range: RangeId): Promise<ChartData | undefined> {
  return cacheGet<ChartData>(key(symbol, range));
}

export function loadChart(symbol: string, range: RangeId): Promise<ChartData> {
  const k = key(symbol, range);
  let p = inflight.get(k);
  if (!p) {
    p = (async () => {
      let data: ChartData;
      try {
        data = await fetchChart(symbol, range);
      } catch (e) {
        if (!isCrypto(symbol) || !(await coinbaseProducts().catch(() => new Set<string>())).has(symbol)) throw e;
        data = await fetchCoinbaseChart(symbol, range);
      }
      void cachePut(k, data);
      return data;
    })().finally(() => inflight.delete(k));
    inflight.set(k, p);
  }
  return p;
}
