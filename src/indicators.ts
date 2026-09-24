// Technical indicators over a close (or bar) series. Every function returns an array the same
// length as its input, with NaN where the indicator has not warmed up yet.

export function sma(xs: number[], n: number): number[] {
  const out = new Array<number>(xs.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < xs.length; i++) {
    sum += xs[i]!;
    if (i >= n) sum -= xs[i - n]!;
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

/** Seeded with the SMA of the first n values, the way most charting packages do it. */
export function ema(xs: number[], n: number): number[] {
  const out = new Array<number>(xs.length).fill(NaN);
  const k = 2 / (n + 1);
  let prev = NaN;
  for (let i = 0; i < xs.length; i++) {
    if (i === n - 1) {
      let s = 0;
      for (let j = 0; j < n; j++) s += xs[j]!;
      prev = s / n;
    } else if (i >= n) {
      prev = xs[i]! * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

export function bollinger(xs: number[], n: number, mult = 2): { mid: number[]; upper: number[]; lower: number[] } {
  const mid = sma(xs, n);
  const upper = new Array<number>(xs.length).fill(NaN), lower = new Array<number>(xs.length).fill(NaN);
  for (let i = n - 1; i < xs.length; i++) {
    let v = 0;
    for (let j = i - n + 1; j <= i; j++) v += (xs[j]! - mid[i]!) ** 2;
    const sd = Math.sqrt(v / n);
    upper[i] = mid[i]! + mult * sd;
    lower[i] = mid[i]! - mult * sd;
  }
  return { mid, upper, lower };
}

/** Wilder's RSI. */
export function rsi(xs: number[], n = 14): number[] {
  const out = new Array<number>(xs.length).fill(NaN);
  if (xs.length <= n) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = xs[i]! - xs[i - 1]!;
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  const val = () => (loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
  out[n] = val();
  for (let i = n + 1; i < xs.length; i++) {
    const d = xs[i]! - xs[i - 1]!;
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = val();
  }
  return out;
}

export function macd(xs: number[], fast = 12, slow = 26, signal = 9): { macd: number[]; signal: number[]; hist: number[] } {
  const f = ema(xs, fast), s = ema(xs, slow);
  const line = xs.map((_, i) => f[i]! - s[i]!);
  // The signal line is an EMA of the MACD line from where that line starts.
  const start = slow - 1;
  const sig = new Array<number>(xs.length).fill(NaN);
  const tail = ema(line.slice(start), signal);
  tail.forEach((v, i) => (sig[start + i] = v));
  return { macd: line, signal: sig, hist: line.map((v, i) => v - sig[i]!) };
}
