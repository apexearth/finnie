// The indicators popover: switch each on or off, change its length, add more averages.
import { useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_INDICATORS, setChart, type Indicator, type IndicatorKind } from "../store";
import { hueLine } from "../theme";

const MA_HUES = [75, 300, 195, 350, 145, 255, 30];
/** Averages take turns through a fixed set of hues, so the same list draws the same colours. */
export function indicatorHue(ind: Indicator, all: Indicator[]): number {
  if (ind.kind === "bb") return 220;
  if (ind.kind === "rsi") return 285;
  if (ind.kind === "macd") return 195;
  const mas = all.filter((x) => x.kind === "sma" || x.kind === "ema");
  return MA_HUES[mas.indexOf(ind) % MA_HUES.length]!;
}

const NAMES: Record<IndicatorKind, string> = { sma: "SMA", ema: "EMA", bb: "BB", vol: "Volume", rsi: "RSI", macd: "MACD" };
export function indicatorLabel(ind: Indicator): string {
  return ind.kind === "vol" || ind.kind === "macd" ? NAMES[ind.kind] : `${NAMES[ind.kind]} ${ind.period}`;
}
const HELP: Record<IndicatorKind, string> = {
  sma: "simple moving average",
  ema: "exponential moving average",
  bb: "Bollinger bands, 2 standard deviations",
  vol: "volume, under the candles",
  rsi: "relative strength index, own pane",
  macd: "MACD 12/26/9, own pane",
};

function Period({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (v: string) => {
    const n = Math.round(Number(v));
    if (n >= 2 && n <= 500) onChange(n);
    setDraft(null);
  };
  return (
    <input type="number" min={2} max={500} value={draft ?? value} onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commit(e.currentTarget.value)} />
  );
}

/**
 * Drawn into <body>, fixed under its button: the chart's toolbar clips what overflows it, and a
 * popover inside it opened out of sight.
 */
export function IndicatorMenu({ id, indicators, anchor, onClose }: { id: string; indicators: Indicator[]; anchor: DOMRect; onClose: () => void }) {
  const set = (next: Indicator[]) => setChart(id, { indicators: next });
  const patch = (ind: Indicator, p: Partial<Indicator>) => set(indicators.map((x) => (x === ind ? { ...x, ...p } : x)));
  const add = (kind: "sma" | "ema") => {
    const period = kind === "sma" ? 20 : 9;
    set([...indicators, { id: kind + Date.now().toString(36), kind, period, on: true }]);
  };
  return createPortal(
    <>
      <div className="pop-bg" onClick={onClose} />
      <div className="pop ind-pop" style={{ position: "fixed", top: anchor.bottom + 4, right: Math.max(8, window.innerWidth - anchor.right) }}>
        <h4>overlays</h4>
        {indicators.filter((x) => x.kind !== "rsi" && x.kind !== "macd").map((ind) => <IndRow key={ind.id} ind={ind} all={indicators} patch={patch} remove={() => set(indicators.filter((x) => x !== ind))} />)}
        <div className="ind-add">
          <button onClick={() => add("sma")}>+ SMA</button>
          <button onClick={() => add("ema")}>+ EMA</button>
        </div>
        <h4>panes</h4>
        {indicators.filter((x) => x.kind === "rsi" || x.kind === "macd").map((ind) => <IndRow key={ind.id} ind={ind} all={indicators} patch={patch} />)}
        <div className="ind-add">
          <button onClick={() => set(DEFAULT_INDICATORS)} title="SMA 50 and 200 with volume">reset</button>
        </div>
      </div>
    </>,
    document.body,
  );
}

function IndRow({ ind, all, patch, remove }: { ind: Indicator; all: Indicator[]; patch: (i: Indicator, p: Partial<Indicator>) => void; remove?: () => void }) {
  const hasPeriod = ind.kind !== "vol" && ind.kind !== "macd";
  const removable = remove && (ind.kind === "sma" || ind.kind === "ema");
  return (
    <div className="ind-row" title={HELP[ind.kind]}>
      <label>
        <input type="checkbox" checked={ind.on} onChange={(e) => patch(ind, { on: e.target.checked })} />
        {ind.kind !== "vol" && <span className="swatch-line" style={{ background: hueLine(indicatorHue(ind, all)) }} />}
        {NAMES[ind.kind]}
      </label>
      {hasPeriod && <Period value={ind.period} onChange={(period) => patch(ind, { period, on: true })} />}
      {removable && <button className="icon-btn" onClick={remove} title="remove">×</button>}
    </div>
  );
}
