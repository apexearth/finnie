// Coinbase Exchange's public API: official, keyless, real time. It streams live prices for the
// crypto on your lists, and stands in for Yahoo's candles when Yahoo will not answer.
import { getJson } from "./net";
import { RANGES, type RangeId } from "./ranges";
import type { Bar, ChartData } from "./types";

const REST = "https://api.exchange.coinbase.com";
const FEED = "wss://ws-feed.exchange.coinbase.com";

let products: Promise<Set<string>> | null = null;
/** Product ids Coinbase trades (BTC-USD...). Subscribing to one it does not know fails the lot. */
export function coinbaseProducts(): Promise<Set<string>> {
  products ??= getJson<{ id: string; status: string; trading_disabled?: boolean }[]>(`${REST}/products`)
    .then((ps) => new Set(ps.filter((p) => p.status === "online" && !p.trading_disabled).map((p) => p.id)))
    .catch((e) => {
      products = null;
      throw e;
    });
  return products;
}

const GRANULARITIES = [60, 300, 900, 3600, 21600, 86400];

/** At most 300 candles, the most Coinbase returns in one request: enough to show, not to warm up a long average. */
export async function fetchCoinbaseChart(symbol: string, range: RangeId): Promise<ChartData> {
  const step = RANGES[range].step;
  const g = GRANULARITIES.find((x) => x >= step) ?? 86400;
  // [time, low, high, open, close, volume], newest first.
  const rows = await getJson<[number, number, number, number, number, number][]>(`${REST}/products/${symbol}/candles?granularity=${g}`);
  const bars: Bar[] = rows.map(([time, low, high, open, close, volume]) => ({ time, open, high, low, close, volume })).reverse();
  const last = bars[bars.length - 1];
  const dayAgo = bars.find((b) => b.time >= (last?.time ?? 0) - 86400);
  return {
    meta: {
      symbol,
      name: symbol,
      exchange: "Coinbase",
      currency: symbol.split("-")[1] ?? "",
      kind: "CRYPTOCURRENCY",
      price: last?.close ?? 0,
      prevClose: dayAgo?.open ?? last?.close ?? 0,
      gmtoffset: 0,
    },
    bars,
    source: "coinbase",
    fetchedAt: Date.now(),
  };
}

type Tick = (symbol: string, price: number, time: number) => void;

/** One socket for every live symbol; reconnects on its own and resubscribes on change. */
export class LiveFeed {
  private ws: WebSocket | null = null;
  private want = new Set<string>();
  private retry = 1000;
  private timer: ReturnType<typeof setTimeout> | undefined;
  connected = false;

  constructor(private onTick: Tick, private onState: (connected: boolean) => void) {}

  set(symbols: string[]) {
    const next = new Set(symbols);
    if (next.size === this.want.size && [...next].every((s) => this.want.has(s))) return;
    const old = this.want;
    this.want = next;
    if (!next.size) return this.close();
    if (!this.ws) return this.open();
    if (this.ws.readyState !== WebSocket.OPEN) return;
    const gone = [...old].filter((s) => !next.has(s)), added = [...next].filter((s) => !old.has(s));
    if (gone.length) this.ws.send(JSON.stringify({ type: "unsubscribe", product_ids: gone, channels: ["ticker"] }));
    if (added.length) this.ws.send(JSON.stringify({ type: "subscribe", product_ids: added, channels: ["ticker"] }));
  }

  private open() {
    clearTimeout(this.timer);
    const ws = new WebSocket(FEED);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 1000;
      this.connected = true;
      this.onState(true);
      ws.send(JSON.stringify({ type: "subscribe", product_ids: [...this.want], channels: ["ticker"] }));
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data)) as { type: string; product_id?: string; price?: string; time?: string };
      if (m.type === "ticker" && m.product_id && m.price) {
        this.onTick(m.product_id, Number(m.price), m.time ? Date.parse(m.time) / 1000 : Date.now() / 1000);
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.connected = false;
      this.onState(false);
      if (!this.want.size) return;
      this.timer = setTimeout(() => this.open(), this.retry);
      this.retry = Math.min(this.retry * 2, 60_000);
    };
  }

  close() {
    clearTimeout(this.timer);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    if (this.connected) {
      this.connected = false;
      this.onState(false);
    }
  }
}
