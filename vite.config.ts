import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { ALLOWED_HOSTS, USER_AGENT } from "./src/data/hosts";

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

// `bun run web` reads and writes the same settings file the shell does (src-tauri/src/main.rs).
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
            mkdirSync(dir, { recursive: true });
            if (!backedUp && existsSync(path)) copyFileSync(path, path + ".bak");
            backedUp = true;
            writeFileSync(path + ".tmp", Buffer.concat(chunks));
            renameSync(path + ".tmp", path);
            res.end();
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
  plugins: [react(), devProxy(), settingsFile()],
  clearScreen: false,
  server: { port: 5178, strictPort: true, host: "127.0.0.1" },
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
});
