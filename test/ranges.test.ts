import { expect, test } from "bun:test";
import { axisTimes, viewStart } from "../src/data/ranges";

test("1D shows the last session of a stock: bars after the last overnight gap", () => {
  const day1 = [0, 300, 600].map((t) => 1_000_000 + t);
  const day2 = [0, 300, 600].map((t) => 1_000_000 + 86400 + t);
  expect(viewStart("1D", [...day1, ...day2], false)).toBe(day2[0]!);
  expect(viewStart("5D", [...day1, ...day2], false)).toBe(day1[0]!);
});

test("1D for crypto is the last 24 hours", () => {
  const times = Array.from({ length: 600 }, (_, i) => i * 300);
  expect(viewStart("1D", times, true)).toBe(times[599]! - 86400);
});

test("chart time keys keep rising through the hour the clocks go back", () => {
  process.env.TZ = "America/Los_Angeles";
  // OGN-USD's 15m bars across 2026-11-01 08:00-10:00 UTC; 01:00-02:00 Pacific happens twice.
  const times = Array.from({ length: 9 }, (_, i) => 1793491200 + i * 900 + 3600 * 8);
  const keys = axisTimes(times, true, 0);
  for (let i = 1; i < keys.length; i++) expect(keys[i]!).toBeGreaterThan(keys[i - 1]!);
  expect(keys[0]).toBe(times[0]! - 7 * 3600);
  expect(keys[8]).toBe(times[8]! - 8 * 3600);
});

test("daily keys that land on the same date still rise", () => {
  expect(axisTimes([86400 * 10 + 100, 86400 * 10 + 200], false, 0)).toEqual([864000, 864001]);
});
