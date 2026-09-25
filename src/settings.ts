// Your settings, in one file: ~/.finnie/settings.json (FINNIE_HOME moves it). The shell reads
// and writes it through Rust; a browser through the dev server; so dev, the installed app, a
// browser tab and a phone on the tailnet all see the same file.
//
// Two halves. `doc` is what follows you between machines (sync/doc.ts: lists, learned names).
// `device` is this machine's: layout, chart panels, theme, the list you had open.
//
// More than one page can have the file open at once (the desktop window and a phone), so the
// doc is never written blind: every write merges with what is on disk, and every page re-reads
// it now and then, so an edit on one shows up on the other.
import { invoke } from "@tauri-apps/api/core";
import { inShell } from "./data/net";
import { DEFAULT_LISTS, DEFAULT_NAMES } from "./defaults";
import { adds, itemKey, listKey, merge, nameKey, put, seedDefaults, type Doc } from "./sync/doc";

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

/**
 * A page opened from another device (a phone, over Tailscale). It shares the lists in the file
 * but not the desktop's device half: its own lives in its own browser storage.
 */
export const remote = !inShell && typeof location !== "undefined" && !["127.0.0.1", "localhost", "[::1]"].includes(location.hostname);
const DEVICE_KEY = "finnie.device";

async function readRaw(): Promise<string | null> {
  if (inShell) return invoke<string | null>("settings_read");
  const r = await fetch("/__settings");
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`settings read failed: ${r.status} ${await r.text()}`);
  return r.text();
}
const parse = (raw: string | null) => (raw == null ? null : (JSON.parse(raw) as Partial<SettingsFile>));

/** Writes the file and returns the doc now on disk. The dev server merges; the shell merges here. */
async function write(f: SettingsFile): Promise<Doc> {
  if (inShell) {
    const disk = parse(await readRaw())?.doc ?? {};
    const out = { ...f, doc: merge(disk, f.doc) };
    await invoke("settings_write", { text: JSON.stringify(out, null, 1) });
    return out.doc;
  }
  const body = remote ? { format: 1, doc: f.doc } : f;
  const r = await fetch("/__settings", { method: "PUT", body: JSON.stringify(body, null, 1) });
  if (!r.ok) throw new Error(`settings write failed: ${r.status} ${await r.text()}`);
  return (JSON.parse(await r.text()) as SettingsFile).doc;
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
    f = remote ? { format: 1, device: { id: "" }, doc: {} } : fromLocalStorage((k) => localStorage.getItem(k));
  }
  if (remote) f.device = readLocalDevice();
  f.doc = seedDefaults(f.doc ?? {}, DEFAULT_LISTS);
  f.device ??= { id: newId() };
  f.device.id ||= newId();
  file = f;
  if (raw == null) await write(f);
  if (remote) saveLocalDevice();
  if (typeof window !== "undefined") {
    setInterval(() => document.visibilityState === "visible" && void pull(), 15_000);
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void pull());
  }
  return f;
}

function readLocalDevice(): Device {
  try {
    return (JSON.parse(localStorage.getItem(DEVICE_KEY) ?? "null") as Device | null) ?? { id: "" };
  } catch {
    return { id: "" };
  }
}
function saveLocalDevice() {
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(settings().device));
  } catch {}
}

// Not crypto.randomUUID: a phone opens the page over plain http, where it does not exist.
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, "0")).join("");

let timer: ReturnType<typeof setTimeout> | undefined;
let told: ((error: string | null) => void) | undefined;
let docChanged: ((doc: Doc) => void) | undefined;
/** Told how each write went (null: saved), so the status bar can say when saving fails. */
export function onSaveResult(fn: (error: string | null) => void) {
  told = fn;
}
/** Told when the doc took in edits from another page sharing the file. */
export function onDocChanged(fn: (doc: Doc) => void) {
  docChanged = fn;
}
/** Takes in a doc from disk, keeping anything newer here. */
function absorb(disk: Doc) {
  const f = settings();
  if (!adds(f.doc, disk)) return;
  f.doc = merge(f.doc, disk);
  docChanged?.(f.doc);
}
function saveSoon() {
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
}
export function flush() {
  clearTimeout(timer);
  timer = undefined;
  if (file) write(file).then((disk) => { told?.(null); absorb(disk); }, (e) => told?.(e instanceof Error ? e.message : String(e)));
}
/** Re-reads the file for edits another page made, and writes back anything it is missing. */
async function pull() {
  if (!file || timer) return;
  try {
    const disk = parse(await readRaw())?.doc;
    if (!disk) return;
    absorb(disk);
    if (adds(disk, settings().doc)) saveSoon();
  } catch {
    // A read that fails now is tried again on the next pull; writes report their own failures.
  }
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
  if (remote) saveLocalDevice();
  else saveSoon();
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
