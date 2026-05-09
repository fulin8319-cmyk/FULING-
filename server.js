const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASS = process.env.ADMIN_PASS || "";
const N8N_API_KEY = process.env.N8N_API_KEY || "";
const SESSION_COOKIE = "fulin_session";
const SEED_DATA_DIR = path.join(__dirname, "data");
const FALLBACK_SEED_DATA_DIR = path.join(__dirname, "seed-data");
const PUBLIC_UPLOAD_DIR = path.join(__dirname, "assets", "uploads");
const PERSIST_DIR = process.env.FULIN_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || SEED_DATA_DIR;
const DATA_FILE = path.join(PERSIST_DIR, "inventory.json");
const ANALYTICS_FILE = path.join(PERSIST_DIR, "analytics.json");
const UPLOAD_DIR = path.join(PERSIST_DIR, "uploads");
const MAX_BODY_BYTES = 12 * 1024 * 1024;

const TRACKED_PAGES = {
  "/index.html": "首頁",
  "/inventory.html": "現貨查詢",
  "/printing.html": "印花用布",
  "/wordpress/products.html": "主力布料產品",
  "/wordpress/faq.html": "常見問題"
};

const sessions = new Map();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
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

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function seedPersistentFile(filename, fallbackContent) {
  const target = path.join(PERSIST_DIR, filename);
  if (fs.existsSync(target)) {
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  const seedCandidates = [
    path.join(FALLBACK_SEED_DATA_DIR, filename),
    path.join(SEED_DATA_DIR, filename)
  ];

  const seed = seedCandidates.find(
    (candidate) => fs.existsSync(candidate) && path.resolve(candidate) !== path.resolve(target)
  );

  if (seed) {
    fs.copyFileSync(seed, target);
    return;
  }

  fs.writeFileSync(target, fallbackContent, "utf8");
}

function initializePersistentStorage() {
  seedPersistentFile("inventory.json", "[]\n");
  seedPersistentFile("analytics.json", "{\"days\":{}}\n");
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function extensionFromMime(mimeType = "") {
  const normalized = String(mimeType).toLowerCase().split(";")[0].trim();
  return {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif"
  }[normalized] || "";
}

function safeFileStem(value = "fabric") {
  return String(value)
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "fabric";
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

function normalizeImageList(...values) {
  const images = [];
  const addImage = (value) => {
    const text = String(value || "").trim();
    if (text && !images.includes(text)) {
      images.push(text);
    }
  };

  for (const value of values) {
    if (Array.isArray(value)) {
      value.forEach(addImage);
    } else {
      addImage(value);
    }
  }

  return images;
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
  const baseCode = pickFirstString(item.baseCode, existingItem.baseCode, code);
  const rollNo = pickFirstString(item.rollNo, existingItem.rollNo);
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
  const images = normalizeImageList(item.images, item.imagePrimary, item.imageSecondary, image, existingItem.images);

  return {
    code,
    baseCode,
    rollNo,
    featuredOnHome,
    featuredOrder: Math.max(0, Math.round(toNumber(pickFirstString(item.featuredOrder, existingItem.featuredOrder)))),
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
    images,
    fabricType: pickFirstString(item.fabricType, item["布種"], existingItem.fabricType),
    name: pickFirstString(item.name, item["品名"], existingItem.name),
    pattern: pickFirstString(item.pattern, item["顏色／花紋"], existingItem.pattern),
    composition: pickFirstString(item.composition, item["成份"], existingItem.composition),
    category: pickFirstString(item.category, item["分類"], existingItem.category),
    rowId: pickFirstString(item.rowId, item["🔒 Row ID"], existingItem.rowId)
  };
}

function buildRollInventoryItems(payload = {}) {
  const baseCode = pickFirstString(payload.code, payload.baseCode);
  const rolls = Array.isArray(payload.rolls) ? payload.rolls : [];

  if (!baseCode || !rolls.length) {
    return [];
  }

  return rolls
    .map((roll, index) => {
      const rollNo = pickFirstString(roll.rollNo, String(index + 1));

      return normalizeInventoryItem({
        code: `${baseCode}-${rollNo}`,
        baseCode,
        rollNo,
        name: payload.name,
        fabricType: payload.fabricType,
        pattern: payload.pattern,
        composition: payload.composition,
        width: payload.width,
        weightPerYard: payload.weightPerYard,
        note: pickFirstString(roll.note, payload.note),
        image: pickFirstString(roll.image, payload.image),
        uploadedBy: payload.uploadedBy,
        location: roll.location,
        status: roll.status,
        kg: roll.kg,
        yards: roll.yards,
        side: "mobile"
      });
    })
    .filter((item) => item.code);
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

function readJsonFile(filePath, fallback) {
  try {
    const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

function readInventory() {
  const data = readJsonFile(DATA_FILE, []);
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.items)) {
    return data.items;
  }
  return [];
}

function writeInventory(items) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function readAnalytics() {
  if (!fs.existsSync(ANALYTICS_FILE)) {
    return { days: {} };
  }

  const data = readJsonFile(ANALYTICS_FILE, { days: {} });
  return data && typeof data === "object" && data.days ? data : { days: {} };
}

function writeAnalytics(data) {
  fs.mkdirSync(path.dirname(ANALYTICS_FILE), { recursive: true });
  fs.writeFileSync(ANALYTICS_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function getVisitorHash(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwardedFor || req.socket.remoteAddress || "";
  const userAgent = String(req.headers["user-agent"] || "");
  return crypto.createHash("sha256").update(`${ip}|${userAgent}`).digest("hex").slice(0, 24);
}

function trackPageView(req, pathname) {
  if (req.method !== "GET" || !TRACKED_PAGES[pathname]) {
    return;
  }

  const data = readAnalytics();
  const date = todayKey();
  const visitor = getVisitorHash(req);
  const day = data.days[date] || { pageViews: 0, visitors: {}, pages: {} };
  const page = day.pages[pathname] || {
    title: TRACKED_PAGES[pathname],
    pageViews: 0,
    visitors: {}
  };

  day.pageViews += 1;
  day.visitors[visitor] = true;
  page.title = TRACKED_PAGES[pathname];
  page.pageViews += 1;
  page.visitors[visitor] = true;
  day.pages[pathname] = page;
  data.days[date] = day;
  writeAnalytics(data);
}

function summarizeAnalytics() {
  const data = readAnalytics();
  const dates = Object.keys(data.days).sort().reverse();
  const today = todayKey();
  const todayData = data.days[today] || { pageViews: 0, visitors: {}, pages: {} };
  const recentDays = dates.slice(0, 14).map((date) => {
    const day = data.days[date] || { pageViews: 0, visitors: {}, pages: {} };
    return {
      date,
      pageViews: Number(day.pageViews || 0),
      visitors: Object.keys(day.visitors || {}).length
    };
  });
  const last7 = recentDays.slice(0, 7).reduce(
    (sum, day) => ({
      pageViews: sum.pageViews + day.pageViews,
      visitors: sum.visitors + day.visitors
    }),
    { pageViews: 0, visitors: 0 }
  );
  const pageTotals = {};

  for (const date of dates) {
    const day = data.days[date] || {};
    for (const [pathname, page] of Object.entries(day.pages || {})) {
      const total = pageTotals[pathname] || {
        path: pathname,
        title: page.title || TRACKED_PAGES[pathname] || pathname,
        pageViews: 0,
        visitors: 0
      };
      total.pageViews += Number(page.pageViews || 0);
      total.visitors += Object.keys(page.visitors || {}).length;
      pageTotals[pathname] = total;
    }
  }

  return {
    today: {
      date: today,
      pageViews: Number(todayData.pageViews || 0),
      visitors: Object.keys(todayData.visitors || {}).length
    },
    last7,
    recentDays,
    topPages: Object.values(pageTotals)
      .sort((a, b) => b.pageViews - a.pageViews)
      .slice(0, 8)
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
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

  if (req.method === "GET" && url.pathname === "/api/admin/analytics") {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, message: "Unauthorized." });
    }
    return sendJson(res, 200, { ok: true, analytics: summarizeAnalytics() });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/storage") {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, message: "Unauthorized." });
    }
    return sendJson(res, 200, {
      ok: true,
      storage: {
        dataDir: PERSIST_DIR,
        volumeMounted: Boolean(process.env.RAILWAY_VOLUME_MOUNT_PATH),
        inventoryFile: DATA_FILE,
        uploadDir: UPLOAD_DIR
      }
    });
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = JSON.parse((await readBody(req)) || "{}");
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    if (username === ADMIN_USER.toLowerCase() && password === ADMIN_PASS) {
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

  if (req.method === "POST" && url.pathname === "/api/admin/upload-image") {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, message: "Unauthorized." });
    }

    const body = JSON.parse((await readBody(req)) || "{}");
    const mimeType = String(body.mimeType || "");
    const ext = extensionFromMime(mimeType);
    const base64 = String(body.data || "");

    if (!ext || !base64) {
      return sendJson(res, 400, { ok: false, message: "Please upload a JPG, PNG, WebP, or GIF image." });
    }

    const bytes = Buffer.from(base64, "base64");
    if (!bytes.length || bytes.length > MAX_BODY_BYTES) {
      return sendJson(res, 400, { ok: false, message: "Image is empty or too large." });
    }

    ensureUploadDir();
    const stem = safeFileStem(body.code || "fabric");
    const filename = `${stem}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), bytes);
    return sendJson(res, 200, { ok: true, url: `/assets/uploads/${filename}` });
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

  if (req.method === "POST" && url.pathname === "/api/admin/inventory-rolls") {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, message: "Unauthorized." });
    }

    const body = JSON.parse((await readBody(req)) || "{}");
    const normalizedIncoming = buildRollInventoryItems(body);

    if (!normalizedIncoming.length) {
      return sendJson(res, 400, {
        ok: false,
        message: "Please provide a base code and at least one roll."
      });
    }

    const merged = upsertInventoryItems(normalizedIncoming);
    return sendJson(res, 200, {
      ok: true,
      imported: normalizedIncoming.length,
      total: merged.length
    });
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
    let filePath = path.join(__dirname, pathname);

    if (pathname.startsWith("/assets/uploads/")) {
      const uploadName = path.basename(pathname);
      const persistedUpload = path.join(UPLOAD_DIR, uploadName);
      if (fs.existsSync(persistedUpload)) {
        filePath = persistedUpload;
      } else {
        filePath = path.join(PUBLIC_UPLOAD_DIR, uploadName);
      }
    }

    const safeStaticPath = filePath.startsWith(__dirname);
    const safeUploadPath = filePath.startsWith(UPLOAD_DIR);
    if (!safeStaticPath && !safeUploadPath) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    trackPageView(req, pathname);
    serveFile(res, filePath);
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error.message });
  }
});

initializePersistentStorage();

server.listen(PORT, () => {
  console.log(`Fulin server running at http://localhost:${PORT}`);
});
