// A chart panel: a symbol, a range, candles or a line, and whichever indicators are switched on.
// The chart object is rebuilt when its shape changes (style, indicators, theme) and only fed new
// data otherwise, so a refresh never throws away where you have scrolled or zoomed to.
import { useEffect, useRef, useState } from "react";
import type { DockviewPanelApi } from "dockview-react";
import {
  AreaSeries, CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, LineSeries, LineStyle, createChart,
  type IChartApi, type ISeriesApi, type SeriesType, type Time, type UTCTimestamp,
} from "lightweight-charts";
import { cachedChart, loadChart } from "../data/charts";
import { onTick } from "../data/poll";
import { RANGE_IDS, RANGES, isIntraday, viewStart, type RangeId } from "../data/ranges";
import { isCrypto, type ChartData } from "../data/types";
import { getDockApi, isChartPanel } from "../dock";
import * as f from "../fmt";
import { bollinger, ema, macd, rsi, sma } from "../indicators";
import { dayChange, defaultChart, learnName, setChart, setState, useStore, type ChartSettings, type Indicator } from "../store";
import { cssVar, hueLine, useTheme } from "../theme";
import { IndicatorMenu, indicatorHue, indicatorLabel } from "./IndicatorMenu";

interface LegendLine {
  label: string;
  color: string;
  values: number[];
}
interface Built {
  chart: IChartApi;
  main: ISeriesApi<SeriesType>;
  /** Fills each series from the bars; returns the legend lines. */
  paint: (d: ChartData, tx: (t: number) => number) => LegendLine[];
}

/** `api` is the dock panel's; a phone draws the chart with no dock around it. */
export function ChartPanel({ id, api }: { id: string; api?: DockviewPanelApi }) {
  const stored = useStore((s) => s.charts[id]);
  const settings: ChartSettings = stored ?? defaultChart();
  const { symbol, range, style, indicators } = settings;
  const quote = useStore((s) => s.quotes[symbol]);
  const name = useStore((s) => s.names[symbol]);
  const theme = useTheme();
  const [data, setData] = useState<ChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const built = useRef<Built | null>(null);
  const times = useRef<number[]>([]);
  const [lines, setLines] = useState<LegendLine[]>([]);
  const fitted = useRef("");

  useEffect(() => {
    if (!stored) setChart(id, {});
  }, [id, stored]);
  useEffect(() => api?.setTitle(symbol), [api, symbol]);

  // Candles: the cached copy straight away, then the network, then again on the range's cadence.
  useEffect(() => {
    let dead = false;
    setError(null);
    setData(null);
    void cachedChart(symbol, range).then((c) => !dead && c && setData((d) => d ?? c));
    const load = async () => {
      setLoading(true);
      try {
        const d = await loadChart(symbol, range);
        if (dead) return;
        setData(d);
        setError(null);
        learnName(symbol, d.meta.name);
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!dead) setLoading(false);
      }
    };
    void load();
    const t = setInterval(() => document.visibilityState === "visible" && void load(), RANGES[range].refresh * 1000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [symbol, range]);

  // Build the chart for this shape.
  const shape = JSON.stringify([style, indicators, theme]);
  useEffect(() => {
    if (!host.current) return;
    const b = build(host.current, style, indicators);
    built.current = b;
    b.chart.subscribeCrosshairMove((p) => {
      if (p.time == null) return setHover(null);
      const i = times.current.indexOf(p.time as number);
      setHover(i >= 0 ? i : null);
    });
    fitted.current = "";
    return () => {
      built.current = null;
      b.chart.remove();
    };
  }, [shape]);

  // Feed it.
  const intraday = isIntraday(range);
  useEffect(() => {
    const b = built.current;
    if (!b || !data || !data.bars.length) return;
    const off = data.meta.gmtoffset;
    // Intraday bars show in your local time; daily and longer are dated as the exchange dates them.
    const tx = intraday
      ? (t: number) => t - new Date(t * 1000).getTimezoneOffset() * 60
      : (t: number) => Math.floor((t + off) / 86400) * 86400;
    setLines(b.paint(data, tx));
    const ts = data.bars.map((x) => tx(x.time));
    times.current = ts;
    const key = `${symbol}:${range}:${shape}`;
    if (fitted.current !== key) {
      fitted.current = key;
      const from = tx(viewStart(range, data.bars.map((x) => x.time), isCrypto(symbol)));
      b.chart.timeScale().setVisibleRange({ from: from as UTCTimestamp, to: ts[ts.length - 1] as UTCTimestamp });
    }
  }, [data, shape]);

  // Live trades move the last candle between refreshes.
  useEffect(() => {
    if (!data?.bars.length) return;
    return onTick((sym, price) => {
      const b = built.current, last = data.bars[data.bars.length - 1];
      if (sym !== symbol || !b || !last) return;
      last.close = price;
      last.high = Math.max(last.high, price);
      last.low = Math.min(last.low, price);
      const t = times.current[times.current.length - 1] as UTCTimestamp;
      b.main.update(style === "candle" ? { time: t, open: last.open, high: last.high, low: last.low, close: price } : { time: t, value: price });
    });
  }, [data, symbol, style]);

  const chg = dayChange(quote) ?? (data ? { abs: data.meta.price - data.meta.prevClose, pct: (data.meta.price / data.meta.prevClose - 1) * 100 } : null);
  const px = quote?.price ?? data?.meta.price;
  const bars = data?.bars ?? [];
  const i = hover ?? bars.length - 1;
  const bar = bars[i];
  const barChg = bar && i > 0 ? (bar.close / bars[i - 1]!.close - 1) * 100 : null;
  const chartCount = getDockApi()?.panels.filter((p) => isChartPanel(p.id)).length ?? 1;
  const changeRange = (r: RangeId) => setChart(id, { range: r });
  const stale = error && data;
  const note = !data ? (error ? `Couldn't load ${symbol}: ${error}` : loading ? `loading ${symbol}…` : "") : !bars.length ? `No ${range} data for ${symbol}` : "";

  return (
    <div className="chart" onMouseDown={() => setState({ activeChart: id })}>
      <div className="chart-bar">
        <button className="chart-sym" onClick={() => setState({ activeChart: id, search: { mode: "open" } })} title="change symbol (Ctrl+K)">{symbol}</button>
        <span className="chart-name">{name ?? data?.meta.name ?? ""}</span>
        <span className="chart-px num">{f.quote(symbol, px)}</span>
        <span className={"num " + f.tone(chg?.pct)}>{f.day(symbol, chg, px)}</span>
        <span style={{ flex: 1 }} />
        <div className="seg">
          {RANGE_IDS.map((r, k) => (
            <button key={r} className={r === range ? "on" : ""} onClick={() => changeRange(r)} title={`${r} (${k + 1})`}>{r}</button>
          ))}
        </div>
        <div className="seg">
          {(["candle", "line", "area"] as const).map((s) => (
            <button key={s} className={s === style ? "on" : ""} onClick={() => setChart(id, { style: s })}>{s}</button>
          ))}
        </div>
        <span style={{ position: "relative" }}>
          <button className="icon-btn" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu((m) => (m ? null : r)); }} title="indicators">indicators ▾</button>
          {menu && <IndicatorMenu id={id} indicators={indicators} anchor={menu} onClose={() => setMenu(null)} />}
        </span>
        {api && chartCount > 1 && <button className="icon-btn" title="close this chart" onClick={() => api.close()}>×</button>}
      </div>
      <div className="chart-body">
        <div className="chart-canvas" ref={host} />
        {bar && (
          <div className="legend num">
            <div className="legend-row">
              <span className="dim">{new Date(bar.time * 1000).toLocaleString([], intraday ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" } : { year: "numeric", month: "short", day: "numeric" })}</span>
              <span>O<b>{f.price(bar.open)}</b></span>
              <span>H<b>{f.price(bar.high)}</b></span>
              <span>L<b>{f.price(bar.low)}</b></span>
              <span>C<b className={f.tone(barChg)}>{f.price(bar.close)}</b></span>
              <span className={f.tone(barChg)}>{f.pct(barChg)}</span>
              {bar.volume > 0 && <span>V<b>{f.compact(bar.volume)}</b></span>}
            </div>
            {lines.length > 0 && (
              <div className="legend-row ind">
                {lines.map((l) => {
                  const v = l.values[i];
                  return v != null && Number.isFinite(v) ? <span key={l.label} style={{ color: l.color }}><i>{l.label}</i>{f.price(v)}</span> : null;
                })}
              </div>
            )}
          </div>
        )}
        {stale && <div className="chart-stale" title={error!}>offline · showing data from {f.ago(data!.fetchedAt)}</div>}
        {!stale && data?.source === "coinbase" && <div className="chart-stale" title="Yahoo did not answer; these candles are Coinbase's">via Coinbase</div>}
        {note && <div className="chart-note">{note}</div>}
      </div>
    </div>
  );
}

function build(el: HTMLElement, style: ChartSettings["style"], indicators: Indicator[]): Built {
  const c = { bg: cssVar("--bg"), fg: cssVar("--fg-dim"), grid: cssVar("--grid"), border: cssVar("--border"), up: cssVar("--up"), down: cssVar("--down"), accent: cssVar("--accent"), faint: cssVar("--fg-faint") };
  const chart = createChart(el, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: c.bg }, textColor: c.fg, fontFamily: cssVar("--mono") || "monospace", fontSize: 11,
      attributionLogo: false,
      panes: { separatorColor: c.border, separatorHoverColor: c.accent + "33", enableResize: true },
    },
    grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
    rightPriceScale: { borderColor: c.border },
    timeScale: { borderColor: c.border, timeVisible: true, secondsVisible: false, rightOffset: 4 },
    crosshair: { mode: CrosshairMode.Normal },
    localization: { priceFormatter: (x: number) => f.price(x) },
  });
  const main: ISeriesApi<SeriesType> =
    style === "candle"
      ? chart.addSeries(CandlestickSeries, { upColor: c.up, downColor: c.down, borderVisible: false, wickUpColor: c.up, wickDownColor: c.down })
      : style === "line"
        ? chart.addSeries(LineSeries, { color: c.accent, lineWidth: 2 })
        : chart.addSeries(AreaSeries, { lineColor: c.accent, topColor: c.accent + "55", bottomColor: c.accent + "05", lineWidth: 2 });

  const quiet = { priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as const;
  const on = indicators.filter((x) => x.on);
  type Painter = (closes: number[], d: ChartData, t: Time[]) => LegendLine[];
  const painters: Painter[] = [];
  const line = (vals: number[], times: Time[]) =>
    vals.flatMap((v, k) => (Number.isFinite(v) ? [{ time: times[k]!, value: v }] : []));
  let pane = 0;

  for (const ind of on) {
    const color = hueLine(indicatorHue(ind, indicators));
    const label = indicatorLabel(ind);
    if (ind.kind === "sma" || ind.kind === "ema") {
      const s = chart.addSeries(LineSeries, { color, lineWidth: 1, ...quiet });
      painters.push((closes, _d, t) => {
        const v = ind.kind === "sma" ? sma(closes, ind.period) : ema(closes, ind.period);
        s.setData(line(v, t));
        return [{ label, color, values: v }];
      });
    } else if (ind.kind === "bb") {
      const opts = { color, lineWidth: 1, ...quiet } as const;
      const up = chart.addSeries(LineSeries, opts), mid = chart.addSeries(LineSeries, { ...opts, lineStyle: LineStyle.Dashed }), lo = chart.addSeries(LineSeries, opts);
      painters.push((closes, _d, t) => {
        const b = bollinger(closes, ind.period);
        up.setData(line(b.upper, t));
        mid.setData(line(b.mid, t));
        lo.setData(line(b.lower, t));
        return [{ label: label + " ↑", color, values: b.upper }, { label: label + " ↓", color, values: b.lower }];
      });
    } else if (ind.kind === "vol") {
      const s = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "vol", ...quiet });
      s.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      painters.push((_c, d, t) => {
        s.setData(d.bars.map((b, k) => ({ time: t[k]!, value: b.volume, color: (b.close >= b.open ? c.up : c.down) + "55" })));
        return [];
      });
    } else if (ind.kind === "rsi") {
      const p = ++pane;
      const s = chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, crosshairMarkerVisible: false }, p);
      for (const level of [70, 30]) s.createPriceLine({ price: level, color: c.faint, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
      painters.push((closes, _d, t) => {
        const v = rsi(closes, ind.period);
        s.setData(line(v, t));
        return [{ label, color, values: v }];
      });
    } else if (ind.kind === "macd") {
      const p = ++pane;
      const hist = chart.addSeries(HistogramSeries, { ...quiet }, p);
      const m = chart.addSeries(LineSeries, { color, lineWidth: 1, ...quiet }, p);
      const sigColor = hueLine(30);
      const sg = chart.addSeries(LineSeries, { color: sigColor, lineWidth: 1, ...quiet }, p);
      painters.push((closes, _d, t) => {
        const r = macd(closes);
        m.setData(line(r.macd, t));
        sg.setData(line(r.signal, t));
        hist.setData(r.hist.flatMap((v, k) => (Number.isFinite(v) ? [{ time: t[k]!, value: v, color: (v >= 0 ? c.up : c.down) + "88" }] : [])));
        return [{ label: "MACD", color, values: r.macd }, { label: "signal", color: sigColor, values: r.signal }];
      });
    }
  }
  // Relative sizes, so they hold at any panel height: each indicator pane gets a fifth of the price pane.
  chart.panes().forEach((p, k) => p.setStretchFactor(k === 0 ? 5 : 1));

  return {
    chart,
    main,
    paint(d, tx) {
      const times = d.bars.map((b) => tx(b.time) as Time);
      const closes = d.bars.map((b) => b.close);
      const last = closes[closes.length - 1] ?? 1;
      const precision = f.decimals(last, d.meta.symbol);
      chart.applyOptions({ localization: { priceFormatter: (x: number) => f.price(x, d.meta.symbol, last) } });
      main.applyOptions({ priceFormat: { type: "price", precision, minMove: 10 ** -precision } });
      if (style === "candle") main.setData(d.bars.map((b, k) => ({ time: times[k]!, open: b.open, high: b.high, low: b.low, close: b.close })));
      else main.setData(d.bars.map((b, k) => ({ time: times[k]!, value: b.close })));
      return painters.flatMap((p) => p(closes, d, times));
    },
  };
}

/** A chart's data without a chart, for the details panel. */
export function useChartData(symbol: string | undefined, range: RangeId): ChartData | null {
  const [data, setData] = useState<ChartData | null>(null);
  useEffect(() => {
    if (!symbol) return;
    let dead = false;
    setData(null);
    void cachedChart(symbol, range).then((c) => !dead && c && setData((d) => d ?? c));
    void loadChart(symbol, range).then((d) => !dead && setData(d)).catch(() => {});
    const t = setInterval(() => void loadChart(symbol, range).then((d) => !dead && setData(d)).catch(() => {}), RANGES[range].refresh * 1000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [symbol, range]);
  return data;
}
