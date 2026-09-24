// The strip along the bottom: where the numbers come from and how fresh they are.
import { useEffect, useState } from "react";
import { refreshQuotes } from "./data/poll";
import * as f from "./fmt";
import { useStore } from "./store";

export function StatusBar() {
  const y = useStore((s) => s.yahoo);
  const live = useStore((s) => s.live);
  const refreshSec = useStore((s) => s.refreshSec);
  const count = useStore((s) => Object.keys(s.quotes).length);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const next = y.lastOk ? Math.max(0, Math.round((y.lastOk + refreshSec * 1000 - now) / 1000)) : null;
  return (
    <div className="statusbar">
      <button className="sb-item" onClick={() => void refreshQuotes()} title="refresh now (r)">
        <span className={"dot " + (y.state === "ok" ? "ok" : y.state === "error" ? "err" : "")} />
        yahoo <b>{y.lastOk ? f.clock(y.lastOk) : "—"}</b>
        {next != null && y.state === "ok" && <span className="faint">next in {next}s</span>}
      </button>
      <span className="sb-item" title={live.symbols.length ? live.symbols.join(", ") : "no crypto on your lists that Coinbase trades"}>
        <span className={"dot " + (live.connected ? "live" : "")} />
        coinbase <b>{live.connected ? `live · ${live.symbols.length}` : live.symbols.length ? "reconnecting" : "idle"}</b>
      </span>
      {y.state === "error" && <span className="sb-item sb-err" title={y.error}>quotes failed: {y.error} · showing last known</span>}
      <span style={{ flex: 1 }} />
      <span className="sb-item">{count} quotes</span>
      <span className="sb-item faint">personal use · not affiliated with Yahoo or Coinbase</span>
    </div>
  );
}
