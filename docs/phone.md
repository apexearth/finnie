# Finnie on a phone

The phone runs nothing of its own. It opens the page from a desktop that is running
`bun run dev` (or `bun run web`), over Tailscale, and that desktop's dev server does everything
a browser cannot: fetching Yahoo through `/__get`, and holding the lists in `/__settings`.

- **Reaching it.** The dev server listens on every address, port 5178, but answers only loopback
  and the tailnet (`100.64.0.0/10`, `fd7a:115c:a1e0::/48`); anything else, such as the LAN, gets
  a 403 and its WebSocket is dropped (`tailnetOnly` in `vite.config.ts`). No token: the tailnet
  is your devices, and what is behind the port is a watchlist. Windows asks once whether Node
  may accept connections; allow it on private networks (Tailscale's adapter is one).
- **https, if you want it.** `tailscale serve --bg 5178` puts the same page at
  `https://<machine>.<tailnet>.ts.net`. Vite accepts `.ts.net` host names for this. Plain http
  works for everything Finnie does; https only matters for installing on Android.
- **Its settings.** A page whose address is not loopback counts as `remote` (`settings.ts`). It
  shares the file's doc, so the lists are the desktop's, and writes only that half; its device
  half (theme, chart, open list) lives in the phone browser's localStorage. Edits on either side
  reach the other within 15 seconds (`docs/settings.md`).
- **The shape.** Under 700px wide, or a touch screen under 1024px, the page draws `Phone.tsx`:
  one panel at a time, with Lists, Chart and Details on a bar at the bottom. Tapping a row
  charts it. The panels are the desk's own. `?mobile=1` and `?desktop=1` force a shape.
- **Home screen.** `public/manifest.webmanifest`, the Apple meta tags and `viewport-fit=cover`
  make it open full-screen from the home screen, clear of the notch and home bar. The status bar
  takes the theme's colour. There is no service worker: with no desktop to talk to, the page
  has no data to show anyway.
- **Not yet on a phone**: dragging rows to reorder, and renaming a list (double-tap).
