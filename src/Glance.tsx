// The top bar's glance at the markets, shared by the desk and the phone: the connection dot,
// US market hours and the tape of a few tickers.
import { useEffect, useState } from "react";
import { openSymbol } from "./dock";
import * as f from "./fmt";
import { span, usMarket } from "./market";
import { TAPE, dayChange, useStore } from "./store";

function useNow(ms: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function Market() {
  const now = useNow(30_000);
  const m = usMarket(new Date(now));
  return (
    <span className={"market" + (m.open ? " open" : "")} title="US stock market, regular hours (holidays not known)">
      <span className="dot" />
      {m.open ? `US open · closes in ${span(m.minutes)}` : `US closed · opens in ${span(m.minutes)}`}
    </span>
  );
}

export function Tape() {
  const quotes = useStore((s) => s.quotes);
  return (
    <div className="tape">
      {TAPE.map((t) => {
        const q = quotes[t.symbol], c = dayChange(q);
        return (
          <button key={t.symbol} className="tape-item num" onClick={() => openSymbol(t.symbol)} title={t.symbol}>
            {t.label} <b>{f.quote(t.symbol, q?.price)}</b> <span className={f.tone(c?.pct)}>{f.move(t.symbol, c)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Conn() {
  const y = useStore((s) => s.yahoo);
  const refreshSec = useStore((s) => s.refreshSec);
  const now = useNow(5_000);
  const stale = y.state === "ok" && now - y.lastOk > refreshSec * 3000;
  const cls = y.state === "error" ? "" : stale ? " stale" : y.state === "ok" ? " on" : " stale";
  const title = y.state === "error" ? `data: ${y.error}` : y.lastOk ? `data updated ${f.ago(y.lastOk, now)}` : "connecting";
  return <span className={"conn" + cls} title={title}>●</span>;
}

