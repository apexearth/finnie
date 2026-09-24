import { expect, test } from "bun:test";
import { viewStart } from "../src/data/ranges";

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
