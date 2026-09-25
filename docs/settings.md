# Settings

Everything you set up lives in one file: `~/.finnie/settings.json` (`FINNIE_HOME` moves the
folder). The desktop app reads and writes it through Rust (`settings_read`/`settings_write` in
`src-tauri/src/main.rs`); a browser through the dev server's `/__settings`. So dev, an
installed build, a browser tab and a phone (`docs/phone.md`) all share it. Nothing drawn before it is read:
`main.tsx` loads it, then fills the store and theme, then renders.

Writes are debounced (250 ms), go to `settings.json.tmp` and are renamed over the file, and the
first write of each run first copies the file to `settings.json.bak`. A file that is there but
will not parse stops the app with a message; it is never overwritten.

Since several pages can have the file open, no write replaces the doc: the dev server merges a
written doc with the one on disk and answers with the result, and the shell reads and merges
before it writes. Every page re-reads the file every 15 seconds while it is showing, and when it
comes back into view, and takes in whatever another page added.

## Two halves

- **`doc`: what follows you between machines** (`src/sync/doc.ts`): watchlists, their rows and
  order, names learned from search. A flat map of keys, each holding its newest value with a
  timestamp and the writing device's id. Two copies merge key by key, newest wins, ties broken
  by device id, so machines can edit apart and meet in any order. A deletion is a null value
  that is kept, so a merge cannot resurrect it. Order is a `pos` number per list and per row; a
  moved row takes a pos between its new neighbours.
- **`device`: this machine's own**: its id, the layout, chart panels and their indicators, the
  theme, the open list, sort and refresh interval. A phone keeps its own in its browser's
  localStorage and writes only the doc; the file's device half stays the desktop's.

## Defaults

`src/defaults.ts` lists are planted at time 0 wherever a key has never existed, on every load.
A new default reaches every install; one you deleted has a newer null and stays deleted; any
edit beats a default.

## Moving from localStorage

A Finnie from before the file kept everything in the webview's localStorage. With no file, the
first run builds one from it (`fromLocalStorage`): your lists and rows as edits, and the defaults
it had been given but no longer has as deletions, so they do not come back.
