import { expect, test } from "bun:test";
import { DEFAULT_LISTS } from "../src/defaults";
import { fromLocalStorage } from "../src/settings";
import { listsFrom, seedDefaults } from "../src/sync/doc";

const store = (o: Record<string, unknown>) => (k: string) => (k in o ? JSON.stringify(o[k]) : null);
const load = (o: Record<string, unknown>) => {
  const f = fromLocalStorage(store(o), 1000);
  return { f, lists: listsFrom(seedDefaults(f.doc, DEFAULT_LISTS)) };
};

test("a fresh install gets every default list", () => {
  const { lists } = load({});
  expect(lists.map((l) => l.id)).toEqual(DEFAULT_LISTS.map((l) => l.id));
});

test("an old install keeps its edits, and what it deleted stays deleted", () => {
  const { f, lists } = load({
    "finnie.seeded": 2,
    // Four defaults deleted, Stocks cut to two rows and renamed, a list of its own added.
    "finnie.lists": [
      { id: "markets", name: "Markets", items: [{ symbol: "^GSPC" }] },
      { id: "stocks", name: "My stocks", items: [{ symbol: "PLTR" }, { symbol: "AAPL" }] },
      { id: "l1", name: "Ideas", items: [{ symbol: "RKLB" }] },
    ],
    "finnie.names": { PLTR: "Palantir Technologies Inc.", SPY: "should not override the default" },
    "finnie.listId": "l1",
    "finnie.refreshSec": 300,
  });
  // It had been given every default (seeded 2), so each one missing was deleted and stays so.
  expect(lists.map((l) => l.id)).toEqual(["markets", "stocks", "l1"]);
  expect(lists.find((l) => l.id === "stocks")).toEqual({ id: "stocks", name: "My stocks", items: [{ symbol: "PLTR" }, { symbol: "AAPL" }] });
  expect(lists.find((l) => l.id === "markets")!.items).toEqual([{ symbol: "^GSPC" }]);
  expect(f.device.listId).toBe("l1");
  expect(f.device.refreshSec).toBe(300);
  expect(f.doc["name:PLTR"]!.v).toBe("Palantir Technologies Inc.");
  expect(f.doc["name:SPY"]).toBeUndefined();
});

test("an install from before the macro lists gets them, once", () => {
  const { lists } = load({ "finnie.lists": [{ id: "stocks", name: "Stocks", items: DEFAULT_LISTS.find((l) => l.id === "stocks")!.items }] });
  // Crypto (since 1) was deleted; the since-2 lists were never offered, so they arrive.
  expect(lists.map((l) => l.id).sort()).toEqual(["commodities", "fx", "markets", "rates", "sectors", "stocks"]);
});
