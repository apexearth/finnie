// Details for the active chart's symbol: today, the year, returns over the usual windows, where
// it sits against its daily averages, and which lists it is on. Built from two years of daily
// candles, whatever range the chart itself is showing.
import { addToList, dayChange, removeFromList, useStore } from "../store";
import * as f from "../fmt";
import { rsi, sma } from "../indicators";
import { useChartData } from "./Chart";

function RangeBar({ lo, hi, at }: { lo?: number; hi?: number; at?: number }) {
  if (lo == null || hi == null || at == null || hi <= lo) return null;
  const x = Math.min(100, Math.max(0, ((at - lo) / (hi - lo)) * 100));
  return (
    <>
      <div className="rangebar"><i style={{ left: `calc(${x}% - 1px)` }} /></div>
      <div className="rangebar-labels num"><span>{f.price(lo)}</span><span>{f.price(hi)}</span></div>
    </>
  );
}

const DAY = 86400;
const WINDOWS: [string, (now: Date) => number][] = [
  ["1W", (n) => n.getTime() / 1000 - 7 * DAY],
  ["1M", (n) => n.getTime() / 1000 - 30 * DAY],
  ["3M", (n) => n.getTime() / 1000 - 91 * DAY],
  ["6M", (n) => n.getTime() / 1000 - 182 * DAY],
  ["YTD", (n) => Date.UTC(n.getUTCFullYear(), 0, 1) / 1000 - 1],
  ["1Y", (n) => n.getTime() / 1000 - 365 * DAY],
];

export function Details() {
  const symbol = useStore((s) => (s.activeChart ? s.charts[s.activeChart]?.symbol : undefined));
  const quote = useStore((s) => (symbol ? s.quotes[symbol] : undefined));
  const name = useStore((s) => (symbol ? s.names[symbol] : undefined));
  const lists = useStore((s) => s.lists);
  const daily = useChartData(symbol, "1Y");
  if (!symbol) return <div className="details dim">No chart open.</div>;

  const bars = daily?.bars ?? [];
  const meta = daily?.meta;
  const px = quote?.price ?? meta?.price;
  const chg = dayChange(quote) ?? (meta ? dayChange({ symbol, price: meta.price, prevClose: meta.prevClose, time: 0, spark: [] }) : null);
  const closes = bars.map((b) => b.close);
  // Today's candle is the last daily bar while its session runs; once it has closed it still is.
  const today = bars[bars.length - 1];
  const dayLo = Math.min(meta?.dayLow ?? Infinity, px ?? Infinity), dayHi = Math.max(meta?.dayHigh ?? -Infinity, px ?? -Infinity);
  const year = bars.filter((b) => b.time >= Date.now() / 1000 - 365 * DAY);
  const lo52 = year.length ? Math.min(...year.map((b) => b.low)) : meta?.low52;
  const hi52 = year.length ? Math.max(...year.map((b) => b.high)) : meta?.high52;
  const avgVol = bars.length ? bars.slice(-30).reduce((a, b) => a + b.volume, 0) / Math.min(30, bars.length) : undefined;
  const last = (xs: number[]) => xs[xs.length - 1];
  const s50 = last(sma(closes, 50)), s200 = last(sma(closes, 200)), r14 = last(rsi(closes, 14));
  const vs = (avg?: number) => (px != null && avg != null && Number.isFinite(avg) ? (px / avg - 1) * 100 : undefined);
  const now = new Date();
  const perf = WINDOWS.map(([label, from]) => {
    const t = from(now);
    const base = bars.find((b) => b.time >= t);
    // A window reaching back past the history we have has no honest answer.
    const ok = base && px != null && t >= (bars[0]?.time ?? Infinity);
    return { label, from: ok ? base.close : undefined };
  });
  // Indexes, yields and currencies trade no volume of their own; Yahoo reports 0.
  const hasVolume = (meta?.volume ?? today?.volume ?? 0) > 0;

  return (
    <div className="details">
      <h2>{symbol}</h2>
      <div className="name">{name ?? meta?.name ?? ""}</div>
      <div className="big num">{f.quote(symbol, px)} <span style={{ fontSize: 12 }}>{f.isYield(symbol) ? "" : meta?.currency}</span></div>
      <div className={"num " + f.tone(chg?.pct)}>{f.day(symbol, chg, px)} today</div>

      <h4>day range</h4>
      <RangeBar lo={Number.isFinite(dayLo) ? dayLo : undefined} hi={Number.isFinite(dayHi) ? dayHi : undefined} at={px} />
      <div className="kv num" style={{ marginTop: 6 }}>
        <span>open</span><b>{f.price(today?.open)}</b>
        <span>prev close</span><b>{f.price(quote?.prevClose ?? meta?.prevClose)}</b>
        {hasVolume && (
          <>
            <span>volume</span><b>{f.compact(meta?.volume ?? today?.volume)}</b>
            <span>avg vol (30d)</span><b>{f.compact(avgVol)}</b>
          </>
        )}
      </div>

      <h4>52-week range</h4>
      <RangeBar lo={lo52} hi={hi52} at={px} />

      <h4>performance</h4>
      <div className="perf num">
        {perf.map((p) => (
          <div key={p.label}><span>{p.label}</span><b className={f.tone(p.from != null && px != null ? px - p.from : null)}>{f.change(symbol, p.from, px)}</b></div>
        ))}
      </div>

      <h4>technicals (daily)</h4>
      <div className="kv num">
        <span>vs SMA 50</span><b className={f.tone(vs(s50))}>{f.pct(vs(s50))}</b>
        <span>vs SMA 200</span><b className={f.tone(vs(s200))}>{f.pct(vs(s200))}</b>
        <span>RSI 14</span>
        <b className={r14 != null && r14 >= 70 ? "down" : r14 != null && r14 <= 30 ? "up" : ""}>
          {r14 != null && Number.isFinite(r14) ? r14.toFixed(1) : "—"}
          {r14 != null && r14 >= 70 ? " overbought" : r14 != null && r14 <= 30 ? " oversold" : ""}
        </b>
      </div>

      <h4>info</h4>
      <div className="kv">
        <span>exchange</span><b>{meta?.exchange || "—"}</b>
        <span>type</span><b>{meta?.kind.toLowerCase() || "—"}</b>
        <span>source</span><b>{daily?.source ?? "—"}</b>
      </div>

      <h4>on lists</h4>
      <div className="lists-in">
        {lists.map((l) => {
          const on = l.items.some((i) => i.symbol === symbol);
          return (
            <button key={l.id} className={on ? "on" : ""} onClick={() => (on ? removeFromList(symbol, l.id) : addToList(symbol, l.id))}
              title={on ? `remove from ${l.name}` : `add to ${l.name}`}>
              {on ? "✓ " : "+ "}{l.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
