// Yahoo Finance's public (unofficial, keyless) endpoints: chart for candles and a symbol's
// numbers, spark for many symbols' day in one request, search for the symbol picker. The quote
// endpoint is left alone on purpose: it wants a cookie and crumb, these do not.
import { getJson } from "./net";
import { RANGES, type RangeId } from "./ranges";
import type { Bar, ChartData, Quote, SearchHit } from "./types";

const BASE = "https://query1.finance.yahoo.com";
const enc = encodeURIComponent;

interface YMeta {
  symbol: string;
  currency?: string;
  exchangeName?: string;
  fullExchangeName?: string;
  instrumentType?: string;
  longName?: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketTime?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  gmtoffset?: number;
}
interface YChart {
  chart: {
    result: {
      meta: YMeta;
      timestamp?: number[];
      indicators: { quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }[] };
    }[] | null;
    error: { code: string; description: string } | null;
  };
}

export async function fetchChart(symbol: string, range: RangeId): Promise<ChartData> {
  const spec = RANGES[range];
  const url = `${BASE}/v8/finance/chart/${enc(symbol)}?range=${spec.range}&interval=${spec.interval}&includePrePost=false&events=div%2Csplits`;
  const j = await getJson<YChart>(url);
  const r = j.chart.result?.[0];
  if (!r) throw new Error(j.chart.error?.description ?? `no data for ${symbol}`);
  const m = r.meta, q = r.indicators.quote[0];
  const bars: Bar[] = [];
  const ts = r.timestamp ?? [];
  for (let i = 0; i < ts.length; i++) {
    const o = q?.open[i], h = q?.high[i], l = q?.low[i], c = q?.close[i];
    // Yahoo pads halts and holidays with nulls; they are not candles.
    if (o == null || h == null || l == null || c == null) continue;
    bars.push({ time: ts[i]!, open: o, high: h, low: l, close: c, volume: q?.volume[i] ?? 0 });
  }
  // Daily and longer bars can arrive twice for the same day (the live bar plus the settled one).
  if (spec.step >= 86400) dedupeByDay(bars, m.gmtoffset ?? 0);
  const price = m.regularMarketPrice ?? bars[bars.length - 1]?.close ?? 0;
  return {
    meta: {
      symbol: m.symbol,
      name: m.longName ?? m.shortName ?? m.symbol,
      exchange: m.fullExchangeName ?? m.exchangeName ?? "",
      currency: m.currency ?? "",
      kind: m.instrumentType ?? "",
      price,
      // chartPreviousClose is the close before the *chart* starts, which is yesterday's only on
      // a one-day chart. The watchlist's spark quote is the better source and wins where it exists.
      prevClose: m.previousClose ?? (spec.step >= 86400 ? bars[bars.length - 2]?.close : undefined) ?? m.chartPreviousClose ?? price,
      dayHigh: m.regularMarketDayHigh,
      dayLow: m.regularMarketDayLow,
      volume: m.regularMarketVolume,
      high52: m.fiftyTwoWeekHigh,
      low52: m.fiftyTwoWeekLow,
      gmtoffset: m.gmtoffset ?? 0,
    },
    bars,
    source: "yahoo",
    fetchedAt: Date.now(),
  };
}

function dedupeByDay(bars: Bar[], gmtoffset: number) {
  const day = (t: number) => Math.floor((t + gmtoffset) / 86400);
  for (let i = bars.length - 1; i > 0; i--) {
    if (day(bars[i]!.time) === day(bars[i - 1]!.time)) bars.splice(i - 1, 1);
  }
}

interface YSpark {
  symbol?: string;
  timestamp?: number[];
  close?: (number | null)[];
  previousClose?: number | null;
  chartPreviousClose?: number | null;
}

/** Today for many symbols at once: last price, previous close, and the day's line. */
export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  const out: Quote[] = [];
  // Yahoo caps spark at 20 symbols a request.
  for (let i = 0; i < symbols.length; i += 20) {
    const chunk = symbols.slice(i, i + 20);
    const j = await getJson<Record<string, YSpark> & { spark?: { result?: { symbol: string; response: YChart["chart"]["result"] }[] } }>(
      `${BASE}/v8/finance/spark?symbols=${chunk.map(enc).join(",")}&range=1d&interval=5m`,
    );
    for (const sym of chunk) {
      const s = j[sym];
      if (!s?.close) continue;
      const closes = s.close.filter((c): c is number => c != null);
      const price = closes[closes.length - 1];
      if (price == null) continue;
      out.push({
        symbol: sym,
        price,
        prevClose: s.previousClose ?? s.chartPreviousClose ?? closes[0] ?? price,
        time: s.timestamp?.[s.timestamp.length - 1] ?? 0,
        spark: closes,
      });
    }
  }
  return out;
}

interface YSearch {
  quotes?: { symbol: string; shortname?: string; longname?: string; exchDisp?: string; exchange?: string; typeDisp?: string; quoteType?: string; isYahooFinance?: boolean }[];
}

export async function search(q: string): Promise<SearchHit[]> {
  const j = await getJson<YSearch>(`${BASE}/v1/finance/search?q=${enc(q)}&quotesCount=12&newsCount=0&listsCount=0`);
  return (j.quotes ?? [])
    .filter((x) => x.isYahooFinance !== false && x.symbol)
    .map((x) => ({
      symbol: x.symbol,
      name: x.longname ?? x.shortname ?? x.symbol,
      exchange: x.exchDisp ?? x.exchange ?? "",
      kind: x.typeDisp ?? x.quoteType ?? "",
    }));
}
