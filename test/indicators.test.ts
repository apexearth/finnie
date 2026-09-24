import { describe, expect, test } from "bun:test";
import { bollinger, ema, macd, rsi, sma } from "../src/indicators";

const close = (a: number[], b: number[]) => a.forEach((v, i) => (Number.isNaN(b[i]!) ? expect(v).toBeNaN() : expect(v).toBeCloseTo(b[i]!, 4)));

describe("indicators", () => {
  test("sma", () => {
    close(sma([1, 2, 3, 4, 5], 3), [NaN, NaN, 2, 3, 4]);
  });

  test("ema seeds with the sma, then weights 2/(n+1)", () => {
    // n=3: k=0.5. seed (1+2+3)/3 = 2; then 4*.5+2*.5 = 3; 5*.5+3*.5 = 4
    close(ema([1, 2, 3, 4, 5], 3), [NaN, NaN, 2, 3, 4]);
    close(ema([2, 4, 6, 10], 2), [NaN, 3, 5, 25 / 3]);
  });

  test("bollinger bands of a flat series collapse on the mean", () => {
    const b = bollinger([5, 5, 5, 5], 2);
    close(b.upper, [NaN, 5, 5, 5]);
    close(b.lower, [NaN, 5, 5, 5]);
  });

  test("rsi: all gains is 100, all losses is 0", () => {
    const up = rsi([1, 2, 3, 4, 5, 6], 3);
    expect(up[3]).toBe(100);
    expect(up[5]).toBe(100);
    const down = rsi([6, 5, 4, 3, 2], 3);
    expect(down[4]).toBe(0);
  });

  test("rsi matches a known value", () => {
    // Wilder's classic 14-day example ends near 70.46 at its first value.
    const xs = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];
    expect(rsi(xs, 14)[14]!).toBeCloseTo(70.46, 1);
  });

  test("macd histogram is macd minus signal once both exist", () => {
    const xs = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 4) * 5 + i * 0.2);
    const m = macd(xs);
    expect(m.signal[25 + 7]).toBeNaN();
    expect(m.signal[25 + 8]).not.toBeNaN();
    expect(m.hist[50]!).toBeCloseTo(m.macd[50]! - m.signal[50]!, 10);
  });
});
