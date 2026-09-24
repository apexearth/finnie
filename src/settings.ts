// Your settings, in one file: ~/.finnie/settings.json (FINNIE_HOME moves it). The shell reads
// and writes it through Rust; `bun run web` through the dev server; so dev, the installed app
// and a browser tab all see the same file.
//
// Two halves. `doc` is what follows you between machines (sync/doc.ts: lists, learned names).
// `device` is this machine's: layout, chart panels, theme, the list you had open.
import { invoke } from "@tauri-apps/api/core";
import { inShell } from "./data/net";
import { DEFAULT_LISTS, DEFAULT_NAMES } from "./defaults";
import { itemKey, listKey, nameKey, put, seedDefaults, type Doc } from "./sync/doc";

export interface Device {
  id: string;
  listId?: string;
  sort?: string;
  refreshSec?: number;
  charts?: Record<string, unknown>;
  layout?: unknown;
  theme?: unknown;
}
export interface SettingsFile {
  format: 1;
  device: Device;
  doc: Doc;
}

async function readRaw(): Promise<string | null> {
  if (inShell) return invoke<string | null>("settings_read");
  const r = await fetch("/__settings");
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`settings read failed: ${r.status} ${await r.text()}`);
  return r.text();
}
async function writeRaw(text: string): Promise<void> {
  if (inShell) return invoke("settings_write", { text });
  const r = await fetch("/__settings", { method: "PUT", body: text });
  if (!r.ok) throw new Error(`settings write failed: ${r.status}`);
}

let file: SettingsFile | null = null;
export function settings(): SettingsFile {
  if (!file) throw new Error("settings used before loadSettings()");
  return file;
}

/**
 * Reads the file, or builds it from what an older Finnie kept in localStorage. A file that is
 * there but will not parse stops the app rather than being overwritten: it is yours.
 */
export async function loadSettings(): Promise<SettingsFile> {
  const raw = await readRaw();
  let f: SettingsFile;
  if (raw != null) {
    try {
      f = JSON.parse(raw) as SettingsFile;
    } catch (e) {
      throw new Error(`~/.finnie/settings.json is not valid JSON (${(e as Error).message}). Fix or move it, then reload.`);
    }
  } else {
    f = fromLocalStorage((k) => localStorage.getItem(k));
  }
  f.doc = seedDefaults(f.doc ?? {}, DEFAULT_LISTS);
  f.device ??= { id: newId() };
  f.device.id ||= newId();
  file = f;
  if (raw == null) await writeRaw(JSON.stringify(f, null, 1));
  return f;
}

const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10);

let timer: ReturnType<typeof setTimeout> | undefined;
let told: ((error: string | null) => void) | undefined;
/** Told how each write went (null: saved), so the status bar can say when saving fails. */
export function onSaveResult(fn: (error: string | null) => void) {
  told = fn;
}
function saveSoon() {
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
}
export function flush() {
  clearTimeout(timer);
  timer = undefined;
  if (file) writeRaw(JSON.stringify(file, null, 1)).then(() => told?.(null), (e) => told?.(e instanceof Error ? e.message : String(e)));
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => timer && flush());
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && timer && flush());
}

export function saveDoc(doc: Doc) {
  settings().doc = doc;
  saveSoon();
}
export function saveDevice(patch: Partial<Device>) {
  const f = settings();
  f.device = { ...f.device, ...patch };
  saveSoon();
}

/**
 * The file an older Finnie would have written, from its localStorage. Default lists and rows
 * that are missing were deleted by you, so they are written as deletions and stay gone.
 */
export function fromLocalStorage(get: (key: string) => string | null, now = Date.now()): SettingsFile {
  const read = <T>(k: string): T | undefined => {
    try {
      const raw = get(k);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  };
  const device: Device = {
    id: newId(),
    listId: read("finnie.listId"),
    sort: read("finnie.sort"),
    refreshSec: read("finnie.refreshSec"),
    charts: read("finnie.charts"),
    layout: read("finnie.layout.v1"),
    theme: read("finnie.theme"),
  };
  let doc: Doc = {};
  const lists = read<{ id: string; name: string; items: { symbol: string }[] }[]>("finnie.lists");
  if (lists?.length) {
    const by = device.id;
    const seen = read<number>("finnie.seeded") ?? 1;
    lists.forEach((l, i) => {
      doc = put(doc, listKey(l.id), { name: l.name, pos: i }, by, now);
      l.items.forEach((it, j) => (doc = put(doc, itemKey(l.id, it.symbol), { pos: j }, by, now)));
    });
    for (const d of DEFAULT_LISTS) {
      const mine = lists.find((l) => l.id === d.id);
      if (!mine) {
        // A default this install had been given, and no longer has, was deleted.
        if (d.since <= seen) doc = put(doc, listKey(d.id), null, by, now);
        continue;
      }
      for (const it of d.items) if (!mine.items.some((x) => x.symbol === it.symbol)) doc = put(doc, itemKey(d.id, it.symbol), null, by, now);
    }
    for (const [sym, name] of Object.entries(read<Record<string, string>>("finnie.names") ?? {})) {
      if (!(sym in DEFAULT_NAMES)) doc = put(doc, nameKey(sym), name, by, now);
    }
  }
  return { format: 1, device, doc };
}
