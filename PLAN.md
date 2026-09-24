# Plan

Ideas to pick from as it gets used. Nothing here is promised.

## Next: your lists on every device

The settings file and its mergeable doc are done (`docs/settings.md`). What is left:

1. **Sync between desktops over Tailscale.** Each Finnie listens on its tailnet address only,
   serving one exchange: send your doc, get theirs, both `merge`. Paired once with a one-time
   code (Henry's idea, not its handshake: the tailnet already encrypts, and a watchlist is not
   a terminal). Exchange on every edit, on reconnect, and every few minutes.
2. **The phone** opens the page from that same listener over Tailscale, in a phone layout,
   and fetches quotes through that desktop. It keeps nothing of its own, so it needs no sync.

## Likely next

- **Price alerts**: "tell me when X crosses Y" or "moves N% today", as a native notification.
- **A backup stock source**: a free-key provider (Finnhub or Twelve Data) behind the same
  interface, used only when Yahoo fails. Key entered in a settings dialog.
- **Market holidays**: the topbar reads "open" on holidays; derive it from the data instead.
- **Pre/post-market** prices on the watchlist and 1D chart (Yahoo has them: `includePrePost`).
- **Compare**: overlay a second symbol as % change on a chart.

## Maybe

- Watchlist columns you pick (volume, 52w position, vs SMA 200).
- Simple screens over a list: above/below an average, RSI extremes, new 52-week highs.
- Drawing: horizontal lines at a price, saved per symbol.
- Import/export watchlists as a file.

## Ruled out

- Trading or brokerage connections.
- Tick-by-tick stock data: not free, not needed.
