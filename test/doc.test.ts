import { describe, expect, test } from "bun:test";
import { itemKey, listKey, listsFrom, merge, posAt, put, seedDefaults, type Doc } from "../src/sync/doc";

const lists = [
  { id: "a", name: "A", items: [{ symbol: "X" }, { symbol: "Y" }] },
  { id: "b", name: "B", items: [{ symbol: "Z" }] },
];

describe("sync doc", () => {
  test("defaults read back as the lists they were", () => {
    expect(listsFrom(seedDefaults({}, lists))).toEqual(lists);
  });

  test("merge is the same in either order, and newest wins per key", () => {
    const base = seedDefaults({}, lists);
    const win = put(base, itemKey("a", "W"), { pos: 5 }, "win", 100);
    const mac = put(put(base, itemKey("a", "X"), null, "mac", 200), listKey("b"), { name: "Bee", pos: 1 }, "mac", 150);
    const m1 = merge(win, mac), m2 = merge(mac, win);
    expect(m1).toEqual(m2);
    expect(listsFrom(m1)).toEqual([
      { id: "a", name: "A", items: [{ symbol: "Y" }, { symbol: "W" }] },
      { id: "b", name: "Bee", items: [{ symbol: "Z" }] },
    ]);
  });

  test("a deletion survives meeting a copy that still has the thing", () => {
    const base = seedDefaults({}, lists);
    const deleted = put(base, listKey("b"), null, "win", 100);
    expect(listsFrom(merge(base, deleted)).map((l) => l.id)).toEqual(["a"]);
    // and a fresh install seeding the same default later does not revive it
    expect(listsFrom(merge(seedDefaults({}, lists), deleted)).map((l) => l.id)).toEqual(["a"]);
    expect(listsFrom(seedDefaults(deleted, lists)).map((l) => l.id)).toEqual(["a"]);
  });

  test("a stamp never goes backwards for a key, even with a slow clock", () => {
    let d: Doc = put({}, "k", 1, "fast", 1000);
    d = put(d, "k", 2, "slow", 10);
    expect(d.k!.t).toBe(1001);
    expect(d.k!.v).toBe(2);
  });

  test("equal stamps break the same way everywhere", () => {
    const a = put({}, "k", "a", "aaa", 5), b = put({}, "k", "b", "bbb", 5);
    expect(merge(a, b).k!.v).toBe("b");
    expect(merge(b, a).k!.v).toBe("b");
  });

  test("moving a row puts it between its new neighbours", () => {
    let d = seedDefaults({}, [{ id: "a", name: "A", items: ["P", "Q", "R"].map((symbol) => ({ symbol })) }]);
    const others = ["P", "Q"].map((s) => itemKey("a", s)); // R moving to the front
    d = put(d, itemKey("a", "R"), { pos: posAt(d, others, 0) }, "x", 1);
    expect(listsFrom(d)[0]!.items.map((i) => i.symbol)).toEqual(["R", "P", "Q"]);
    const others2 = ["R", "Q"].map((s) => itemKey("a", s)); // P between R and Q is where it is; move P to the end
    d = put(d, itemKey("a", "P"), { pos: posAt(d, others2, 2) }, "x", 2);
    expect(listsFrom(d)[0]!.items.map((i) => i.symbol)).toEqual(["R", "Q", "P"]);
  });
});
