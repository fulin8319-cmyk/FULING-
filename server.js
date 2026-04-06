const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "fulin2026";
const N8N_API_KEY = process.env.N8N_API_KEY || "";
const SESSION_COOKIE = "fulin_session";
const DATA_FILE = path.join(__dirname, "data", "inventory.json");

const sessions = new Map();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".heic": "image/heic"
};

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || "";
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      })
  );
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function roundOne(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function yardsFromKg(kg, weightPerYard) {
  if (!kg || !weightPerYard) {
    return 0;
  }
  return roundOne((Number(kg) * 1000) / Number(weightPerYard));
}

function kgFromYards(yards, weightPerYard) {
  if (!yards || !weightPerYard) {
    return 0;
  }
  return roundOne((Number(yards) * Number(weightPerYard)) / 1000);
}

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickFirstString(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function mapInventoryStatus(status) {
  const text = String(status || "").trim().toLowerCase();
  if (!text) return "confirmed";
  if (text.includes("sold") || text.includes("售")) return "sold";
  if (text.includes("reserved") || text.includes("保留")) return "reserved";
  if (text.includes("review") || text.includes("確認") || text.includes("檢查")) return "review";
  return "confirmed";
}

function normalizeInventoryItem(item = {}, existingItem = {}) {
  const code = pickFirstString(item.code, item["編號"], existingItem.code);
  const width = Math.round(toNumber(pickFirstString(item.width, item["幅寬"], existingItem.width)));
  const weightPerYard = Math.round(
    toNumber(pickFirstString(item.weightPerYard, item["每碼克重"], existingItem.weightPerYard))
  );
  let kg = roundOne(toNumber(pickFirstString(item.kg, item["公斤數"], existingItem.kg)));
  let yards = roundOne(toNumber(pickFirstString(item.yards, item["自動換算碼數"], existingItem.yards)));

  if (!yards && kg && weightPerYard) {
    yards = yardsFromKg(kg, weightPerYard);
  } else if (!kg && yards && weightPerYard) {
    kg = kgFromYards(yards, weightPerYard);
  }

  const featuredOnHome =
    item.featuredOnHome === true ||
    String(item["熱門"] || "").trim().toLowerCase() === "true" ||
    Boolean(existingItem.featuredOnHome);

  const image = pickFirstString(
    item.image,
    item.imageUrl,
    item.featuredImage,
    item["照片連結"],
    item["照片 1"],
    item["照片 2"],
    existingItem.image
  );

  return {
    code,
    featuredOnHome,
    displayTitle: pickFirstString(item.displayTitle, item.name, item["品名"], existingItem.displayTitle, code),
    useText: pickFirstString(item.useText, item.fabricType ? `布種：${item.fabricType}` : "", existingItem.useText),
    descriptionText: pickFirstString(
      item.descriptionText,
      item.composition ? `成份：${item.composition}` : "",
      item["成份"] ? `成份：${item["成份"]}` : "",
      existingItem.descriptionText
    ),
    featuredImage: pickFirstString(item.featuredImage, existingItem.featuredImage, featuredOnHome ? image : ""),
    width,
    weightPerYard,
    kg,
    yards,
    location: pickFirstString(item.location, item["庫存位置"], existingItem.location),
    side: pickFirstString(item.side, existingItem.side, "n8n"),
    status: mapInventoryStatus(item.status || item["狀態"] || existingItem.status),
    note: pickFirstString(item.note, existingItem.note),
    image,
    fabricType: pickFirstString(item.fabricType, item["布種"], existingItem.fabricType),
    name: pickFirstString(item.name, item["品名"], existingItem.name),
    pattern: pickFirstString(item.pattern, item["顏色／花紋"], existingItem.pattern),
    composition: pickFirstString(item.composition, item["成份"], existingItem.composition),
    category: pickFirstString(item.category, item["分類"], existingItem.category),
    rowId: pickFirstString(item.rowId, item["🔒 Row ID"], existingItem.rowId)
  };
}

function hasValidN8nKey(req) {
  if (!N8N_API_KEY) {
    return false;
  }

  const authHeader = req.headers.authorization || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const apiKey = req.headers["x-api-key"] || "";

  return bearer === N8N_API_KEY || apiKey === N8N_API_KEY;
}

function upsertInventoryItems(nextItems) {
  const inventory = readInventory();
  const byCode = new Map(
    inventory
      .filter((item) => item && item.code)
      .map((item) => [String(item.code).trim(), item])
  );

  for (const incoming of nextItems) {
    const code = String(incoming.code || "").trim();
    if (!code) {
      continue;
    }
    const existingItem = byCode.get(code) || {};
    byCode.set(code, normalizeInventoryItem(incoming, existingItem));
  }

  const merged = Array.from(byCode.values()).sort((a, b) =>
    String(a.code).localeCompare(String(b.code), "zh-Hant")
  );
  writeInventory(merged);
  return merged;
}

function readInventory() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeInventory(items) {
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  return Boolean(cookies[SESSION_COOKIE] && sessions.has(cookies[SESSION_COOKIE]));
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/inventory") {
    return sendJson(res, 200, { items: readInventory() });
  }

  if (req.method === "GET" && url.pathname === "/api/n8n/health") {
    return sendJson(res, 200, {
      ok: true,
      n8nEnabled: Boolean(N8N_API_KEY),
      inventoryCount: readInventory().length
    });
  }

  if (req.method === "GET" && url.pathname === "/api/me") {
    return sendJson(res, 200, { authenticated: isAuthenticated(req) });
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = JSON.parse((await readBody(req)) || "{}");
    if (body.username === ADMIN_USER && body.password === ADMIN_PASS) {
      const token = crypto.randomBytes(24).toString("hex");
      sessions.set(token, { createdAt: Date.now() });
      return sendJson(
        res,
        200,
        { ok: true },
        {
          "Set-Cookie": `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax`
        }
      );
    }
    return sendJson(res, 401, { ok: false, message: "Invalid username or password." });
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    const cookies = parseCookies(req);
    if (cookies[SESSION_COOKIE]) {
      sessions.delete(cookies[SESSION_COOKIE]);
    }
    return sendJson(
      res,
      200,
      { ok: true },
      {
        "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
      }
    );
  }

  if (req.method === "PUT" && url.pathname === "/api/admin/inventory") {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, message: "Unauthorized." });
    }

    const body = JSON.parse((await readBody(req)) || "{}");
    if (!Array.isArray(body.items)) {
      return sendJson(res, 400, { ok: false, message: "Invalid payload." });
    }

    writeInventory(body.items);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/n8n/inventory") {
    if (!hasValidN8nKey(req)) {
      return sendJson(res, 401, { ok: false, message: "Invalid n8n API key." });
    }

    const body = JSON.parse((await readBody(req)) || "{}");
    const incomingItems = Array.isArray(body.items) ? body.items : [body];
    const normalizedIncoming = incomingItems
      .map((item) => normalizeInventoryItem(item))
      .filter((item) => item.code);

    if (!normalizedIncoming.length) {
      return sendJson(res, 400, { ok: false, message: "No valid inventory items found." });
    }

    const merged = upsertInventoryItems(normalizedIncoming);
    return sendJson(res, 200, {
      ok: true,
      imported: normalizedIncoming.length,
      total: merged.length
    });
  }

  return sendJson(res, 404, { ok: false, message: "Not found." });
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": contentTypes[ext] || "application/octet-stream"
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.join(__dirname, pathname);

    if (!filePath.startsWith(__dirname)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    serveFile(res, filePath);
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Fulin server running at http://localhost:${PORT}`);
});
