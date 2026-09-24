// The part of your settings that follows you between machines: watchlists and learned names.
// It is a flat map of keys, each holding its newest value and when and where that was written.
// Two copies merge key by key, newest wins, so machines can edit apart and meet later in any
// order. A deletion is a value of null, kept, so a merge cannot bring the thing back.
//
//   list:<id>              { name, pos }       a watchlist
//   item:<listId>:<symbol> { pos }             a row on it
//   name:<symbol>          string              a name learned from search or a chart
//
// Order is a number per list and per row: a moved row takes a pos between its new neighbours,
// so a reorder is one key, not a rewrite of the list.
import type { Watchlist } from "../store";

export interface Entry {
  v: unknown;
  /** Milliseconds; 0 is a default seeded by the app, which any real edit beats. */
  t: number;
  /** The writing device, to break a tie in t the same way on every machine. */
  by: string;
}
export type Doc = Record<string, Entry>;

export const newer = (a: Entry, b: Entry) => (a.t !== b.t ? a.t > b.t : a.by > b.by);

export function merge(a: Doc, b: Doc): Doc {
  const out: Doc = { ...a };
  for (const [k, e] of Object.entries(b)) {
    const cur = out[k];
    if (!cur || newer(e, cur)) out[k] = e;
  }
  return out;
}

/** Write a key. The stamp never goes backwards for a key, even if this clock is behind another's. */
export function put(doc: Doc, key: string, v: unknown, by: string, now = Date.now()): Doc {
  const prev = doc[key];
  return { ...doc, [key]: { v, t: Math.max(now, (prev?.t ?? 0) + 1), by } };
}

/** A default: written only where the key has never existed, at t 0, so it loses to any edit. */
export function seed(doc: Doc, key: string, v: unknown): Doc {
  return key in doc ? doc : { ...doc, [key]: { v, t: 0, by: "" } };
}

export const listKey = (id: string) => `list:${id}`;
export const itemKey = (listId: string, symbol: string) => `item:${listId}:${symbol}`;
export const nameKey = (symbol: string) => `name:${symbol}`;

interface ListVal { name: string; pos: number }
interface ItemVal { pos: number }

/** Watchlists as the app draws them, from a doc. */
export function listsFrom(doc: Doc): Watchlist[] {
  const lists = new Map<string, { name: string; pos: number; items: { symbol: string; pos: number }[] }>();
  for (const [k, e] of Object.entries(doc)) {
    if (e.v == null || !k.startsWith("list:")) continue;
    const v = e.v as ListVal;
    lists.set(k.slice(5), { name: v.name, pos: v.pos, items: [] });
  }
  for (const [k, e] of Object.entries(doc)) {
    if (e.v == null || !k.startsWith("item:")) continue;
    // The symbol may itself contain ":" in principle, so split on the first one only.
    const rest = k.slice(5), at = rest.indexOf(":");
    const l = lists.get(rest.slice(0, at));
    if (l) l.items.push({ symbol: rest.slice(at + 1), pos: (e.v as ItemVal).pos });
  }
  const byPos = <T extends { pos: number }>(key: (x: T) => string) => (a: T, b: T) => a.pos - b.pos || key(a).localeCompare(key(b));
  return [...lists.entries()]
    .map(([id, l]) => ({ id, ...l }))
    .sort(byPos((l) => l.id))
    .map((l) => ({ id: l.id, name: l.name, items: l.items.sort(byPos((i) => i.symbol)).map((i) => ({ symbol: i.symbol })) }));
}

export function namesFrom(doc: Doc): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, e] of Object.entries(doc)) if (k.startsWith("name:") && typeof e.v === "string") out[k.slice(5)] = e.v;
  return out;
}

const posOf = (doc: Doc, key: string) => (doc[key]?.v as { pos?: number } | null)?.pos ?? 0;

/** Where something goes to land at `index` among `keys` (the others, in order). */
export function posAt(doc: Doc, keys: string[], index: number): number {
  const before = index > 0 ? posOf(doc, keys[index - 1]!) : undefined;
  const after = index < keys.length ? posOf(doc, keys[index]!) : undefined;
  if (before == null && after == null) return 0;
  if (before == null) return after! - 1;
  if (after == null) return before + 1;
  return (before + after) / 2;
}

/** The defaults, planted where nothing has ever been. */
export function seedDefaults(doc: Doc, lists: Watchlist[]): Doc {
  let d = doc;
  lists.forEach((l, i) => {
    d = seed(d, listKey(l.id), { name: l.name, pos: i });
    l.items.forEach((it, j) => (d = seed(d, itemKey(l.id, it.symbol), { pos: j })));
  });
  return d;
}
