# Data

## Sources

- **Yahoo `v8/finance/chart`**: candles plus a symbol's numbers (name, exchange, day range,
  52-week range). Keyless and the most stable of Yahoo's endpoints.
- **Yahoo `v8/finance/spark`**: today's 5-minute closes and previous close for up to 20 symbols
  per request. Every watchlist, chart and tape quote comes from here in one batch per refresh.
- **Yahoo `v1/finance/search`**: the symbol picker.
- **Coinbase Exchange**: a WebSocket ticker for every crypto symbol on a list or chart that
  Coinbase trades (checked against `/products`), and REST candles when Yahoo fails a crypto chart.

Yahoo's `v7/finance/quote` is avoided on purpose: it needs a cookie and crumb.

Crypto symbols use Yahoo's spelling, `BTC-USD`, which is also Coinbase's product id.

## Default lists

`src/defaults.ts` holds the starting lists (Markets, Sectors, Rates, FX, Commodities, Stocks,
Crypto) and readable names for their symbols, which always win over Yahoo's. How defaults reach
an install, and stay deleted, is in `docs/settings.md`.

Yields (`^IRX`, `^FVX`, `^TNX`, `^TYX`) are quoted in percent, so their moves are shown in basis
points. Currency pairs under 20 show four decimals. Yahoo has no 2-year yield index.

## Freshness

- Quotes: every `refreshSec` (30s–10m, topbar), skipped while the window is hidden and caught up
  when it returns. A symbol newly added to a list or chart is fetched within a second.
- Live crypto prices overwrite the polled price until a newer poll arrives, and move the last
  candle of an open chart.
- Charts refetch on their range's cadence (`src/data/ranges.ts`): every minute on 1D, hourly on 5Y.

## Cache and failure

Every successful chart and the quote set are written to IndexedDB. On start the app paints from
there, then fetches. When a fetch fails the last copy stays up: a chart says "offline · showing
data from N ago", the status bar says quotes failed. A crypto chart Yahoo will not serve falls
back to Coinbase candles (at most 300, so long averages may not warm up) and says "via Coinbase".

## Time

Intraday candles are shown in local time. Daily and longer candles are dated in the exchange's
time zone, so a crypto daily bar never slides onto the previous day.

Every range fetches more history than it shows (1Y fetches 2y), so a 200-bar average is already
drawn at the left edge.
