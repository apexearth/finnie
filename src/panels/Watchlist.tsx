// The watchlist: Henry's rail, one row per symbol with the day's line drawn underneath. Lists
// are tabs along the top; rows drag to reorder while the list is in its own order.
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { openSymbol } from "../dock";
import * as f from "../fmt";
import {
  activeList, dayChange, deleteList, getState, moveInList, newList, removeFromList, renameList, setState, sortedItems, useStore,
  type ListSort,
} from "../store";
import type { Quote } from "../data/types";

function Spark({ q }: { q: Quote | undefined }) {
  if (!q || q.spark.length < 2) return null;
  const xs = [...q.spark.slice(0, -1), q.price];
  const lo = Math.min(...xs, q.prevClose), hi = Math.max(...xs, q.prevClose);
  const y = (v: number) => (hi === lo ? 50 : 100 - ((v - lo) / (hi - lo)) * 100);
  const pts = xs.map((v, i) => `${(i / (xs.length - 1)) * 100},${y(v).toFixed(1)}`).join(" ");
  const stroke = q.price >= q.prevClose ? "var(--up)" : "var(--down)";
  return (
    <svg className="spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <line x1="0" x2="100" y1={y(q.prevClose)} y2={y(q.prevClose)} />
      <polyline points={pts} style={{ stroke }} />
    </svg>
  );
}

/** The price flashes green or red for a moment when it moves. */
function Price({ symbol, value }: { symbol: string; value: number | undefined }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<{ n: number; cls: string }>({ n: 0, cls: "" });
  useEffect(() => {
    if (value != null && prev.current != null && value !== prev.current) {
      setFlash((x) => ({ n: x.n + 1, cls: value > prev.current! ? "flash-up" : "flash-down" }));
    }
    prev.current = value;
  }, [value]);
  return <span key={flash.n} className={"num " + flash.cls}>{f.quote(symbol, value)}</span>;
}

const Row = memo(function Row(props: {
  symbol: string; name: string; q: Quote | undefined; active: boolean; live: boolean; index: number; draggable: boolean;
  listId: string;
}) {
  const { symbol, name, q, active, live, index, draggable, listId } = props;
  const [over, setOver] = useState(false);
  const chg = dayChange(q);
  return (
    <div
      className={"wl-row" + (active ? " active" : "") + (over ? " drag-over" : "")}
      onClick={() => openSymbol(symbol)}
      onDoubleClick={() => openSymbol(symbol, { newChart: true })}
      onAuxClick={(e) => e.button === 1 && openSymbol(symbol, { newChart: true })}
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("finnie/row", String(index))}
      onDragOver={(e) => {
        if (!draggable || !e.dataTransfer.types.includes("finnie/row")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const from = Number(e.dataTransfer.getData("finnie/row"));
        if (Number.isFinite(from) && from !== index) moveInList(listId, from, index);
      }}
      title={`${symbol}: click to chart, double-click for a new chart`}
    >
      <Spark q={q} />
      {live && <span className="live-dot" title="live from Coinbase" />}
      <div className="wl-sym">
        <b>{symbol}</b>
        <span>{name}</span>
      </div>
      <div className="wl-px"><Price symbol={symbol} value={q?.price} /></div>
      <div className="wl-chg">
        <span className={"pill num " + f.tone(chg?.pct)}>{f.move(symbol, chg)}</span>
      </div>
      <button className="x" title="remove from list" onClick={(e) => { e.stopPropagation(); removeFromList(symbol, listId); }}>×</button>
    </div>
  );
});

function ListTabs() {
  const lists = useStore((s) => s.lists);
  const listId = useStore((s) => s.listId);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const commit = () => {
    if (editing) {
      const name = draft.trim();
      if (editing === "new") {
        if (name) newList(name);
      } else if (name) renameList(editing, name);
    }
    setEditing(null);
  };
  const input = (
    <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(null);
      }} />
  );
  return (
    <div className="wl-head">
      <div className="wl-tabs">
        {lists.map((l) =>
          editing === l.id ? (
            <span key={l.id} className="wl-tab on">{input}</span>
          ) : (
            <button key={l.id} className={"wl-tab" + (l.id === listId ? " on" : "")} onClick={() => setState({ listId: l.id })}
              onDoubleClick={() => { setDraft(l.name); setEditing(l.id); }} title="double-click to rename">
              {l.name}
            </button>
          ),
        )}
        {editing === "new" && <span className="wl-tab on">{input}</span>}
      </div>
      {editing && editing !== "new" && lists.length > 1 && (
        <button className="icon-btn" title="delete this list" onMouseDown={(e) => e.preventDefault()}
          onClick={() => { deleteList(editing); setEditing(null); }}>delete</button>
      )}
      <button className="icon-btn" title="new list" onClick={() => { setDraft(""); setEditing("new"); }}>+</button>
    </div>
  );
}

const NEXT_SORT: Record<ListSort, ListSort> = { manual: "chg-desc", "chg-desc": "chg-asc", "chg-asc": "manual", sym: "manual" };

export function Watchlist() {
  const lists = useStore((s) => s.lists);
  const listId = useStore((s) => s.listId);
  const sort = useStore((s) => s.sort);
  const quotes = useStore((s) => s.quotes);
  const names = useStore((s) => s.names);
  const live = useStore((s) => s.live);
  const activeSym = useStore((s) => (s.activeChart ? s.charts[s.activeChart]?.symbol : undefined));
  // Recomputed from the pieces it depends on; sortedItems itself returns a fresh array.
  const items = useMemo(() => sortedItems(getState()), [lists, listId, sort, quotes]);
  const list = activeList();
  const liveSet = new Set(live.connected ? live.symbols : []);
  return (
    <div className="wl">
      <ListTabs />
      <div className="wl-cols">
        <button className={sort === "sym" ? "on" : ""} onClick={() => setState({ sort: sort === "sym" ? "manual" : "sym" })}>
          symbol{sort === "sym" ? " ↓" : ""}
        </button>
        <span>price</span>
        <span>
          <button className={sort.startsWith("chg") ? "on" : ""} onClick={() => setState({ sort: NEXT_SORT[sort] })}>
            day{sort === "chg-desc" ? " ↓" : sort === "chg-asc" ? " ↑" : ""}
          </button>
        </span>
      </div>
      <div className="wl-list">
        {items.map((it) => (
          <Row key={it.symbol} symbol={it.symbol} name={names[it.symbol] ?? ""} q={quotes[it.symbol]}
            active={it.symbol === activeSym} live={liveSet.has(it.symbol)} listId={list.id}
            index={list.items.indexOf(it)} draggable={sort === "manual"} />
        ))}
        {!items.length && <div className="wl-empty">This list is empty. Add a symbol below, or with Ctrl+K.</div>}
      </div>
      <div className="wl-foot">
        <span>{items.length} symbol{items.length === 1 ? "" : "s"}</span>
        <button onClick={() => setState({ search: { mode: "add" } })}>+ add symbol</button>
      </div>
    </div>
  );
}
