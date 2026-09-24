/** One candle. `time` is unix seconds, as the providers give it (not shifted for display). */
export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  price: number;
  prevClose: number;
  /** Unix seconds of the last trade we know of. */
  time: number;
  /** The last session's closes, oldest first, for the watchlist sparkline. */
  spark: number[];
}

export interface ChartMeta {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  /** Yahoo's instrumentType: EQUITY, ETF, CRYPTOCURRENCY, INDEX, MUTUALFUND, FUTURE, CURRENCY. */
  kind: string;
  price: number;
  prevClose: number;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  high52?: number;
  low52?: number;
  /** Seconds east of UTC for the exchange; daily bars are dated in exchange time. */
  gmtoffset: number;
}

export interface ChartData {
  meta: ChartMeta;
  bars: Bar[];
  source: "yahoo" | "coinbase";
  fetchedAt: number;
}

export interface SearchHit {
  symbol: string;
  name: string;
  exchange: string;
  kind: string;
}

/** Yahoo spells crypto pairs the way Coinbase names its products: BTC-USD. */
export const isCrypto = (symbol: string) => /^[A-Z0-9]+-(USD|USDT|USDC|EUR|GBP)$/.test(symbol);
