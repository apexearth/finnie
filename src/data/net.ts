// GET a JSON document from one of the market hosts. Inside the Tauri shell the request is made
// by Rust (no CORS, real User-Agent); in a browser tab it goes through the dev server's proxy.
import { invoke } from "@tauri-apps/api/core";

export const inShell = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function getJson<T>(url: string): Promise<T> {
  let status: number, body: string;
  if (inShell) {
    [status, body] = await invoke<[number, string]>("http_get", { url });
  } else {
    const r = await fetch("/__get?url=" + encodeURIComponent(url));
    status = r.status;
    body = await r.text();
  }
  if (status < 200 || status >= 300) throw new HttpError(status, `${status} from ${new URL(url).host}`);
  return JSON.parse(body) as T;
}
