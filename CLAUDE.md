# Finnie

A personal stocks and crypto app: watchlists, charts with moving averages and a few
indicators, a details panel. Tauri 2 shell around a React page; Henry's look (sibling repo
`../henry`). `README.md` covers running and building.

## Documents

- `PLAN.md` is what is ahead: open items and what is ruled out. Nothing finished lives there.
- `docs/data.md` is where the numbers come from and how they stay fresh. Read it before touching `src/data`.
- `docs/settings.md` is the settings file and the synced doc. Read it before touching `src/settings.ts`, `src/sync` or list edits in the store.
- `changelog/<YYYY-MM-DD>.md` is what shipped that day, one line per change.

When work ships: delete its item from `PLAN.md`, add a line to today's changelog, and edit the
doc sentence that is now wrong. Edit, never append.

## Shape

- `src/data`: providers (`yahoo.ts`, `coinbase.ts`), the poller for quotes (`poll.ts`), chart
  loading with cache and fallback (`charts.ts`), IndexedDB cache, and `net.ts`, the one door to
  the network.
- `src/store.ts`: all app state, plain module + `useStore(selector)`. Selectors must return
  stable references (never build arrays in them; compute in the component). List edits go
  through the doc (`edit` / `commitDoc`), never by assigning `lists`.
- `src/settings.ts` + `src/sync/doc.ts`: the settings file and its mergeable half.
- `src/panels`: Watchlist, Chart, Details, IndicatorMenu. `src/dock.ts` owns the dockview layout.
- `src-tauri`: the window and `http_get`, which exists only because the APIs refuse CORS.
  Allowed hosts are listed twice, in `main.rs` and `src/data/hosts.ts`; keep them equal.

## Working here

- `bun run dev` is `tauri dev`: Vite plus the native window on it, hot-reloading; edits under
  `src-tauri` rebuild and relaunch the window. The user may have it running: never kill it by
  pattern, and test on another port with a scratch settings folder
  (`FINNIE_HOME=<scratch> bunx vite --port <free>`). **Never write `~/.finnie`**: it is the
  user's real lists, and a hot reload in their window already runs whatever you just saved.
- `bun run web` serves just the page at http://127.0.0.1:5178, with a dev proxy standing in for
  `http_get`, so the whole app works in a browser tab.
- `bun run build` (zero TS errors) and `bun test test/` must pass before you're done.
- Runs on Windows and macOS: no platform assumptions in the page; Rust stays cross-platform.
- Be polite to Yahoo: batch (spark takes 20 symbols), cache, and never poll faster than 30s.

## Style

Be concise. Plain TypeScript, no state libraries, comments only for non-obvious decisions.
Colors come from CSS variables set by `theme.ts`; up is `--up`, down is `--down`.
