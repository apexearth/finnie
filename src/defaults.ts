// The lists a new install starts with: a macro dashboard (world markets, sectors, rates,
// currencies, commodities) and a few stocks and coins. Symbols are Yahoo's; each was checked to
// return data. Yahoo has no 2-year Treasury yield index, so the curve starts at the 13-week bill.
import type { Watchlist } from "./store";

const list = (id: string, name: string, symbols: string[]): Watchlist => ({ id, name, items: symbols.map((symbol) => ({ symbol })) });

/**
 * Planted in the settings doc at time 0 wherever a key has never existed (sync/doc.ts `seed`),
 * so a new default reaches every install and a deleted one stays deleted. `since` is only read
 * when moving an old localStorage install into the file: it says which defaults it had been given.
 */
export const DEFAULT_LISTS: (Watchlist & { since: number })[] = [
  { since: 2, ...list("markets", "Markets", ["^GSPC", "^IXIC", "^DJI", "^RUT", "^VIX", "^STOXX50E", "^GDAXI", "^FTSE", "^N225", "^HSI", "000001.SS", "^BSESN", "EFA", "EEM"]) },
  { since: 2, ...list("sectors", "Sectors", ["XLK", "XLC", "XLY", "XLF", "XLI", "XLV", "XLE", "XLB", "XLP", "XLU", "XLRE", "SMH", "KRE"]) },
  { since: 2, ...list("rates", "Rates", ["^IRX", "^FVX", "^TNX", "^TYX", "SGOV", "BIL", "SHY", "IEF", "TLT", "TIP", "LQD", "HYG"]) },
  { since: 2, ...list("fx", "FX", ["DX-Y.NYB", "EURUSD=X", "JPY=X", "GBPUSD=X", "CNY=X", "CHF=X", "AUDUSD=X", "CAD=X", "MXN=X"]) },
  { since: 2, ...list("commodities", "Commodities", ["CL=F", "BZ=F", "NG=F", "RB=F", "HO=F", "GC=F", "SI=F", "HG=F", "ZC=F", "ZW=F"]) },
  { since: 1, ...list("stocks", "Stocks", ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "TSLA"]) },
  { since: 1, ...list("crypto", "Crypto", ["BTC-USD", "ETH-USD", "SOL-USD"]) },
];

/** Names that say what a thing is, where Yahoo's would say "E-Mini..." or nothing at all. */
export const DEFAULT_NAMES: Record<string, string> = {
  SPY: "S&P 500 ETF", QQQ: "Nasdaq-100 ETF", AAPL: "Apple", MSFT: "Microsoft", NVDA: "NVIDIA",
  AMZN: "Amazon", GOOGL: "Alphabet", TSLA: "Tesla", "BTC-USD": "Bitcoin", "ETH-USD": "Ethereum", "SOL-USD": "Solana",

  "^GSPC": "S&P 500", "^IXIC": "Nasdaq Composite", "^DJI": "Dow Jones", "^RUT": "Russell 2000 (small caps)",
  "^VIX": "VIX (S&P volatility)", "^STOXX50E": "Euro Stoxx 50", "^GDAXI": "DAX (Germany)", "^FTSE": "FTSE 100 (UK)",
  "^N225": "Nikkei 225 (Japan)", "^HSI": "Hang Seng (Hong Kong)", "000001.SS": "Shanghai Composite",
  "^BSESN": "Sensex (India)", EFA: "Developed ex-US ETF", EEM: "Emerging markets ETF",

  XLK: "Technology", XLC: "Communication services", XLY: "Consumer discretionary", XLF: "Financials",
  XLI: "Industrials", XLV: "Health care", XLE: "Energy", XLB: "Materials", XLP: "Consumer staples",
  XLU: "Utilities", XLRE: "Real estate", SMH: "Semiconductors", KRE: "Regional banks",

  "^IRX": "13-week T-bill yield (cash rate)", "^FVX": "5-year Treasury yield", "^TNX": "10-year Treasury yield",
  "^TYX": "30-year Treasury yield", SGOV: "0–3 month T-bills ETF", BIL: "1–3 month T-bills ETF",
  SHY: "1–3 year Treasuries ETF", IEF: "7–10 year Treasuries ETF", TLT: "20+ year Treasuries ETF",
  TIP: "Inflation-protected Treasuries ETF", LQD: "Investment-grade corporates ETF", HYG: "High-yield corporates ETF",

  "DX-Y.NYB": "US dollar index (DXY)", "EURUSD=X": "Euro, USD per EUR", "JPY=X": "Yen per USD",
  "GBPUSD=X": "Pound, USD per GBP", "CNY=X": "Yuan per USD", "CHF=X": "Swiss franc per USD",
  "AUDUSD=X": "Aussie, USD per AUD", "CAD=X": "Canadian dollar per USD", "MXN=X": "Peso per USD",

  "CL=F": "WTI crude oil", "BZ=F": "Brent crude oil", "NG=F": "Natural gas", "RB=F": "Gasoline (RBOB)",
  "HO=F": "Heating oil / diesel", "GC=F": "Gold", "SI=F": "Silver", "HG=F": "Copper", "ZC=F": "Corn", "ZW=F": "Wheat",
};

/** Symbols quoted as a yield in percent: their moves read in basis points, not percent of percent. */
export const YIELDS = new Set(["^IRX", "^FVX", "^TNX", "^TYX"]);
