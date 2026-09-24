# Finnie

Watchlists and charts for stocks and crypto on your desktop (Windows and macOS), from free public
data. No account and no API keys.

- **Watchlists**: several lists, drag to reorder, sort by day change, a sparkline of the day under each row.
- **Charts**: candles, line or area; 1D to MAX; SMA/EMA (as many as you like), Bollinger bands,
  volume, RSI and MACD. Open as many chart tabs as you want and arrange them like Henry's panels.
- **Details**: day and 52-week range, returns over 1W–1Y, distance from the 50/200-day averages,
  RSI, and which lists a symbol is on.
- **Fresh enough**: quotes refresh every 30s–10m (you choose); crypto on Coinbase streams live.

## Run

Needs [Bun](https://bun.sh) 1.4+ and, for the native app, [Rust](https://rustup.rs).

```sh
bun install
bun run dev      # the desktop app, live: page edits hot-reload, src-tauri edits rebuild and relaunch
bun run web      # or just the page, in a browser at http://127.0.0.1:5178
bun run bundle   # installer for this OS, in src-tauri/target/release/bundle
bun run shortcut # Windows: a "Finnie (dev)" Start Menu entry that runs `bun run dev` with no console
```

Pin the shortcut from Start (right-click → Pin to taskbar). Clicking it while Finnie is open
brings the window forward; closing the window stops the dev servers. Output goes to `dev.log`.

A macOS build has to be made on a Mac. Unsigned, it needs right-click → Open the first time.

## Keys

`Ctrl/⌘+K` or `/` go to symbol · `a` add to list · `↑↓` walk the list · `1`–`8` chart range ·
`r` refresh · `Ctrl/⌘+/` all of them.

## Data

Yahoo Finance's public chart, spark and search endpoints for everything, and Coinbase's public
API for live crypto and as a fallback for crypto candles. See `docs/data.md`.

Personal use. Not affiliated with Yahoo or Coinbase; their data, their terms.
