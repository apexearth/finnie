import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { ALLOWED_HOSTS, USER_AGENT } from "./src/data/hosts";
import { merge, type Doc } from "./src/sync/doc";

// The server listens on every address so a phone can reach it over Tailscale, and answers only
// this machine and the tailnet (100.64.0.0/10, fd7a:115c:a1e0::/48): not the café's wifi.
const reachable = (addr = "") => {
  const a = addr.replace(/^::ffff:/, "").toLowerCase();
  if (a === "127.0.0.1" || a === "::1") return true;
  const m = /^100\.(\d+)\./.exec(a);
  return (m != null && Number(m[1]) >= 64 && Number(m[1]) < 128) || a.startsWith("fd7a:115c:a1e0:");
};
function tailnetOnly(): Plugin {
  return {
    name: "finnie-tailnet-only",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (reachable(req.socket.remoteAddress)) return next();
        res.statusCode = 403;
        res.end("Finnie answers this machine and your tailnet only");
      });
      server.httpServer?.prependListener("upgrade", (req) => {
        if (!reachable(req.socket.remoteAddress)) req.socket.destroy();
      });
    },
  };
}

// In a plain browser tab the market APIs refuse cross-origin requests, so the dev server
// fetches on the page's behalf. The Tauri shell does the same thing in Rust (src-tauri).
function devProxy(): Plugin {
  return {
    name: "finnie-dev-proxy",
    configureServer(server) {
      server.middlewares.use("/__get", async (req, res) => {
        const target = new URL(req.url ?? "", "http://x").searchParams.get("url") ?? "";
        let host = "";
        try {
          host = new URL(target).host;
        } catch {}
        if (!ALLOWED_HOSTS.includes(host)) {
          res.statusCode = 403;
          res.end("host not allowed");
          return;
        }
        try {
          const r = await fetch(target, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
          res.statusCode = r.status;
          res.setHeader("Content-Type", "application/json");
          res.end(await r.text());
        } catch (e) {
          res.statusCode = 502;
          res.end(String(e));
        }
      });
    },
  };
}

// A browser reads and writes the same settings file the shell does (src-tauri/src/main.rs).
// Several pages may share it (this machine's and a phone's), so a write merges its doc with the
// one on disk and answers with the result. A write without a device half (a phone's) keeps
// the one on disk.
function settingsFile(): Plugin {
  const dir = process.env.FINNIE_HOME ?? join(homedir(), ".finnie");
  const path = join(dir, "settings.json");
  let backedUp = false;
  return {
    name: "finnie-settings",
    configureServer(server) {
      server.middlewares.use("/__settings", async (req, res) => {
        try {
          if (req.method === "GET") {
            if (!existsSync(path)) {
              res.statusCode = 404;
              res.end();
              return;
            }
            res.setHeader("Content-Type", "application/json");
            res.end(readFileSync(path, "utf8"));
            return;
          }
          if (req.method === "PUT") {
            const chunks: Buffer[] = [];
            for await (const c of req) chunks.push(c as Buffer);
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { device?: unknown; doc?: Doc };
            // A file that will not parse throws here and is left alone: it is yours to fix.
            const disk = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as { device?: unknown; doc?: Doc }) : null;
            const out = JSON.stringify({ format: 1, device: body.device ?? disk?.device, doc: merge(disk?.doc ?? {}, body.doc ?? {}) }, null, 1);
            mkdirSync(dir, { recursive: true });
            if (!backedUp && disk) copyFileSync(path, path + ".bak");
            backedUp = true;
            writeFileSync(path + ".tmp", out);
            renameSync(path + ".tmp", path);
            res.setHeader("Content-Type", "application/json");
            res.end(out);
            return;
          }
          res.statusCode = 405;
          res.end();
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [tailnetOnly(), react(), devProxy(), settingsFile()],
  clearScreen: false,
  // A MagicDNS name (`tailscale serve`, for https) is a host name, which Vite checks; IPs pass.
  server: { port: 5178, strictPort: true, host: "0.0.0.0", allowedHosts: [".ts.net"] },
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
});
