import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "server");
const DB_PATH = process.env.DB_PATH || path.resolve(DATA_DIR, "db.json");

const ALLOWED_ENTITIES = new Set([
  "ChatProfile",
  "ChatRoom",
  "ChatMessage",
  "ChatGroup",
  "GroupMessage",
  "SupportMessage",
  "LoginEvent",
]);

function nowIso() {
  return new Date().toISOString();
}

async function ensureDbFile() {
  await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(DB_PATH)) {
    const initial = {};
    for (const entity of ALLOWED_ENTITIES) initial[entity] = [];
    await writeFile(DB_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readDb() {
  await ensureDbFile();
  const raw = await readFile(DB_PATH, "utf8");
  const parsed = JSON.parse(raw || "{}");
  for (const entity of ALLOWED_ENTITIES) {
    if (!Array.isArray(parsed[entity])) parsed[entity] = [];
  }
  return parsed;
}

let writeQueue = Promise.resolve();
function queueWriteDb(nextDb) {
  writeQueue = writeQueue.then(() => writeFile(DB_PATH, JSON.stringify(nextDb, null, 2), "utf8"));
  return writeQueue;
}

function parseOrderBy(orderBy, fallback = "created_date") {
  const raw = String(orderBy || "");
  const isDesc = raw.startsWith("-");
  const field = (isDesc ? raw.slice(1) : raw) || fallback;
  return { field, ascending: !isDesc };
}

function getComparable(value) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const t = Date.parse(value);
    if (!Number.isNaN(t) && /\d{4}-\d{2}-\d{2}T/.test(value)) return t;
    return value.toLowerCase();
  }
  return JSON.stringify(value);
}

function sortRecords(records, orderBy) {
  const { field, ascending } = parseOrderBy(orderBy);
  const dir = ascending ? 1 : -1;
  return [...records].sort((a, b) => {
    const av = getComparable(a?.[field]);
    const bv = getComparable(b?.[field]);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av === bv) return 0;
    return av > bv ? dir : -dir;
  });
}

function matchesCriteria(record, criteria) {
  if (!criteria) return true;
  for (const [key, value] of Object.entries(criteria)) {
    if (value === undefined) continue;
    if (record?.[key] !== value) return false;
  }
  return true;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve uploaded files from server/uploads
const UPLOADS_DIR = path.resolve(DATA_DIR, "uploads");
app.use("/uploads", express.static(UPLOADS_DIR));

app.post("/upload", async (req, res) => {
  try {
    const { filename, contentType, base64 } = req.body || {};
    if (!filename || !base64) return res.status(400).json({ error: "Missing filename or base64" });

    await mkdir(UPLOADS_DIR, { recursive: true });
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(UPLOADS_DIR, safeName);
    const buffer = Buffer.from(base64, "base64");
    await writeFile(filePath, buffer);

    const host = req.get("host");
    const protocol = req.protocol;
    const url = `${protocol}://${host}/uploads/${encodeURIComponent(safeName)}`;
    res.json({ file_url: url });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Upload failed" });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, mode: "local-shared", dbPath: DB_PATH });
});

app.get("/entities/:entity/list", async (req, res) => {
  try {
    const entity = String(req.params.entity || "");
    if (!ALLOWED_ENTITIES.has(entity)) return res.status(400).json({ error: "Unknown entity" });

    const orderBy = req.query.orderBy;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const db = await readDb();
    let records = db[entity] || [];
    records = sortRecords(records, orderBy);
    if (typeof limit === "number" && Number.isFinite(limit)) records = records.slice(0, limit);

    res.json({ data: records });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

app.post("/entities/:entity/filter", async (req, res) => {
  try {
    const entity = String(req.params.entity || "");
    if (!ALLOWED_ENTITIES.has(entity)) return res.status(400).json({ error: "Unknown entity" });

    const { criteria = {}, orderBy, limit } = req.body || {};

    const db = await readDb();
    let records = (db[entity] || []).filter((r) => matchesCriteria(r, criteria));
    records = sortRecords(records, orderBy);
    if (typeof limit === "number" && Number.isFinite(limit)) records = records.slice(0, limit);

    res.json({ data: records });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

app.post("/entities/:entity/create", async (req, res) => {
  try {
    const entity = String(req.params.entity || "");
    if (!ALLOWED_ENTITIES.has(entity)) return res.status(400).json({ error: "Unknown entity" });

    const payload = (req.body && req.body.data) || {};
    const db = await readDb();

    const record = {
      id: randomUUID(),
      created_date: nowIso(),
      updated_date: nowIso(),
      ...payload,
    };

    db[entity].push(record);
    await queueWriteDb(db);

    broadcast({ entity, action: "create", id: record.id });
    res.json({ data: record });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

app.post("/entities/:entity/update", async (req, res) => {
  try {
    const entity = String(req.params.entity || "");
    if (!ALLOWED_ENTITIES.has(entity)) return res.status(400).json({ error: "Unknown entity" });

    const { id, patch = {} } = req.body || {};
    if (!id) return res.status(400).json({ error: "Missing id" });

    const db = await readDb();
    const idx = (db[entity] || []).findIndex((r) => r?.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    const updated = {
      ...db[entity][idx],
      ...patch,
      updated_date: nowIso(),
    };

    db[entity][idx] = updated;
    await queueWriteDb(db);

    broadcast({ entity, action: "update", id });
    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

app.post("/entities/:entity/delete", async (req, res) => {
  try {
    const entity = String(req.params.entity || "");
    if (!ALLOWED_ENTITIES.has(entity)) return res.status(400).json({ error: "Unknown entity" });

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "Missing id" });

    const db = await readDb();
    const before = db[entity].length;
    db[entity] = (db[entity] || []).filter((r) => r?.id !== id);
    if (db[entity].length === before) return res.status(404).json({ error: "Not found" });

    await queueWriteDb(db);
    broadcast({ entity, action: "delete", id });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Server error" });
  }
});

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(payload);
  }
}

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "hello", ok: true }));
});

await ensureDbFile();
httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Local shared DB server running on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`WebSocket endpoint ws://localhost:${PORT}/ws`);
  // eslint-disable-next-line no-console
  console.log(`DB file: ${DB_PATH}`);
});
