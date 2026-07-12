#!/usr/bin/env node
/* ============================================================================
   NEXUS CLINIC — Optional backend server (zero dependencies)

   Runs the whole site AND a shared bookings API from ONE command:
       node server/server.js
   Then open  http://localhost:3000

   Why use this instead of just opening the HTML files?
   - Bookings are saved on the SERVER (data/bookings.json), so the owner
     dashboard shows bookings made from ANY device / phone, not just one browser.
   - No database to install, no npm install — pure Node.js built-ins.

   The frontend auto-detects this server (via /api/health) and uses it.
   If it's not running, the site still works fully using each browser's
   local storage.
   ========================================================================== */

const http = require("http");
const fs = require("fs");
const path = require("path");
const whatsapp = require("./whatsapp"); // auto-send once WA_PROVIDER env vars are set

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "..");          // serve the nexus/ folder
const DATA_DIR = path.join(__dirname, "data");
const DB = path.join(DATA_DIR, "bookings.json");

/* ---------- tiny JSON "database" ---------- */
function ensureDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB)) fs.writeFileSync(DB, "[]");
}
function readDB() {
  ensureDB();
  try { return JSON.parse(fs.readFileSync(DB, "utf8")); } catch { return []; }
}
function writeDB(list) {
  ensureDB();
  fs.writeFileSync(DB, JSON.stringify(list, null, 2));
}

/* ---------- helpers ---------- */
const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".ico": "image/x-icon",
};
function send(res, code, body, type = "application/json") {
  res.writeHead(code, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}
function body(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); } });
  });
}

/* ---------- static file serving ---------- */
function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT)) return send(res, 403, "Forbidden", "text/plain");
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "Not found", "text/plain");
    send(res, 200, data, MIME[path.extname(filePath)] || "application/octet-stream");
  });
}

/* ---------- request router ---------- */
const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  if (req.method === "OPTIONS") return send(res, 204, "");

  // --- API ---
  if (url.startsWith("/api/")) {
    if (url === "/api/health") return send(res, 200, { ok: true, mode: "server" });

    // WhatsApp Business API inbound webhook (Meta Cloud API)
    if (url === "/api/wa-webhook" && req.method === "GET") {
      const q = Object.fromEntries(new URL(req.url, "http://x").searchParams);
      return whatsapp.verifyWebhook(q, res);
    }
    if (url === "/api/wa-webhook" && req.method === "POST") {
      const payload = await body(req);
      whatsapp.handleInbound(payload, readDB(), writeDB);
      return send(res, 200, { ok: true });
    }

    if (url === "/api/bookings" && req.method === "GET") {
      const list = readDB().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return send(res, 200, list);
    }
    if (url === "/api/bookings" && req.method === "POST") {
      const rec = await body(req);
      const list = readDB();
      list.push(rec);
      writeDB(list);
      return send(res, 201, rec);
    }
    const m = url.match(/^\/api\/bookings\/(.+)$/);
    if (m) {
      const id = m[1];
      let list = readDB();
      if (req.method === "DELETE") {
        list = list.filter((b) => b.id !== id);
        writeDB(list);
        return send(res, 200, { ok: true });
      }
      if (req.method === "PATCH") {
        const patch = await body(req);
        const b = list.find((x) => x.id === id);
        if (b) Object.assign(b, patch);
        writeDB(list);
        return send(res, 200, b || {});
      }
    }
    return send(res, 404, { error: "Unknown API route" });
  }

  // --- static site ---
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`\n  NEXUS CLINIC running`);
  console.log(`  → Site:      http://localhost:${PORT}`);
  console.log(`  → Dashboard: http://localhost:${PORT}/dashboard.html`);
  console.log(`  → Data file: ${DB}\n`);
  // Confirmations + 1-hour reminders, fully automatic once the
  // WhatsApp Business API env vars are set (see WHATSAPP-SETUP.md).
  whatsapp.startLoop(readDB);
});
