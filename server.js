const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASS = process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD || "";
const N8N_API_KEY = process.env.N8N_API_KEY || "";
const FB_PAGE_ID = process.env.FB_PAGE_ID || "";
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN || "";
const X_API_KEY = process.env.X_API_KEY || "";
const X_API_SECRET = process.env.X_API_SECRET || "";
const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN || "";
const X_ACCESS_SECRET = process.env.X_ACCESS_SECRET || "";
const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || "";
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || "";
const TIKTOK_ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN || "";
const TIKTOK_OPEN_ID = process.env.TIKTOK_OPEN_ID || "";
const IG_USER_ID = process.env.IG_USER_ID || "";
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN || FB_PAGE_ACCESS_TOKEN;
const BUFFER_API_KEY = process.env.BUFFER_API_KEY || "";
const BUFFER_CHANNEL_IDS = parseCsv(process.env.BUFFER_CHANNEL_IDS);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN || "";
const SESSION_COOKIE = "fulin_session";
const SEED_DATA_DIR = path.join(__dirname, "data");
const FALLBACK_SEED_DATA_DIR = path.join(__dirname, "seed-data");
const PUBLIC_UPLOAD_DIR = path.join(__dirname, "assets", "uploads");
const isRailwayRuntime = Boolean(
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.RAILWAY_PROJECT_ID ||
  process.env.RAILWAY_SERVICE_ID
);
const DEFAULT_RAILWAY_DATA_DIR = "/app/data";
const PERSIST_DIR =
  process.env.FULIN_DATA_DIR ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  (isRailwayRuntime ? DEFAULT_RAILWAY_DATA_DIR : SEED_DATA_DIR);
const PERSIST_DIR_SOURCE = process.env.FULIN_DATA_DIR
  ? "FULIN_DATA_DIR"
  : process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? "RAILWAY_VOLUME_MOUNT_PATH"
    : isRailwayRuntime
      ? "railway-default"
      : "local-data";
const DATA_FILE = path.join(PERSIST_DIR, "inventory.json");
const ANALYTICS_FILE = path.join(PERSIST_DIR, "analytics.json");
const SOCIAL_POSTS_FILE = path.join(PERSIST_DIR, "social-posts.json");
const UPLOAD_DIR = path.join(PERSIST_DIR, "uploads");
const MAX_BODY_BYTES = 120 * 1024 * 1024;
const PUBLIC_INVENTORY_ENABLED = /^(1|true|yes)$/i.test(process.env.PUBLIC_INVENTORY_ENABLED || "");
const PUBLIC_INVENTORY_AUTO_OPEN = /^(1|true|yes)$/i.test(process.env.PUBLIC_INVENTORY_AUTO_OPEN || "");
const PUBLIC_INVENTORY_MIN_ITEMS = Number(process.env.PUBLIC_INVENTORY_MIN_ITEMS || 30);

const TRACKED_PAGES = {
  "/index.html": "首頁",
  "/inventory.html": "現貨查詢",
  "/printing.html": "印花用布",
  "/products.html": "主力布料產品",
  "/functional-fabric": "機能布",
  "/printed-fabric": "印花布",
  "/n66-nylon-fabric": "N66尼龍布",
  "/cooling-fabric": "涼感布",
  "/moisture-wicking": "排汗布",
  "/sportswear-fabric": "運動服布料",
  "/underwear-fabric": "內衣內褲布料",
  "/t-shirt-fabric": "T恤用布",
  "/fabric-wholesale": "布料批發",
  "/photo-fabric-matching": "傳照片找布",
  "/about": "關於福麟商行",
  "/contact": "聯絡我們",
  "/ricky-master": "Ricky大師",
  "/faq.html": "常見問題"
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
  ".heic": "image/heic",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm"
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
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  res.end(body);
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
  seedPersistentFile("social-posts.json", "[]\n");
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function extensionFromMime(mimeType = "") {
  const normalized = String(mimeType).toLowerCase().split(";")[0].trim();
  return {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm"
  }[normalized] || "";
}

function mediaKindFromMime(mimeType = "") {
  const normalized = String(mimeType).toLowerCase().split(";")[0].trim();
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("video/")) return "video";
  return "";
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

function hasPublicText(value) {
  return String(value || "").trim().length > 0;
}

function hasPublicQuantity(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0;
}

function getPublicInventoryStatus() {
  const inventory = readInventory();
  const readyItems = inventory.filter((item) => {
    if (!item) return false;
    const status = String(item.status || "").toLowerCase();
    const isSold = status.includes("sold") || status.includes("售完");
    return (
      !isSold &&
      hasPublicText(item.code) &&
      (hasPublicText(item.displayTitle) || hasPublicText(item.name) || hasPublicText(item.fabricType)) &&
      (hasPublicText(item.pattern) || hasPublicText(item.color)) &&
      (hasPublicQuantity(item.kg) || hasPublicQuantity(item.yards))
    );
  });

  const autoOpen = PUBLIC_INVENTORY_AUTO_OPEN && readyItems.length >= PUBLIC_INVENTORY_MIN_ITEMS;
  return {
    open: PUBLIC_INVENTORY_ENABLED || autoOpen,
    mode: PUBLIC_INVENTORY_ENABLED ? "manual" : autoOpen ? "auto" : "closed",
    readyCount: readyItems.length,
    minItems: PUBLIC_INVENTORY_MIN_ITEMS,
    autoOpenEnabled: PUBLIC_INVENTORY_AUTO_OPEN
  };
}

function parseCsv(value = "") {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readSocialPosts() {
  const data = readJsonFile(SOCIAL_POSTS_FILE, []);
  return Array.isArray(data) ? data : [];
}

function writeSocialPosts(posts) {
  fs.mkdirSync(path.dirname(SOCIAL_POSTS_FILE), { recursive: true });
  fs.writeFileSync(SOCIAL_POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
}

function normalizePlatforms(platforms) {
  const allowed = new Set(["facebook", "x", "tiktok", "instagram", "buffer"]);
  return (Array.isArray(platforms) ? platforms : [])
    .map((platform) => String(platform || "").trim().toLowerCase())
    .filter((platform, index, list) => allowed.has(platform) && list.indexOf(platform) === index);
}

function normalizeMediaList(media) {
  return (Array.isArray(media) ? media : [])
    .map((item) => ({
      url: String(item.url || "").trim(),
      type: String(item.type || "").trim().toLowerCase() === "video" ? "video" : "image",
      name: String(item.name || "").trim()
    }))
    .filter((item) => item.url);
}

function getCredentialStatus() {
  return {
    facebook: Boolean(FB_PAGE_ID && FB_PAGE_ACCESS_TOKEN),
    x: Boolean(X_API_KEY && X_API_SECRET && X_ACCESS_TOKEN && X_ACCESS_SECRET),
    tiktok: Boolean(TIKTOK_CLIENT_KEY && TIKTOK_CLIENT_SECRET && TIKTOK_ACCESS_TOKEN && TIKTOK_OPEN_ID),
    instagram: Boolean(IG_USER_ID && IG_ACCESS_TOKEN),
    buffer: Boolean(BUFFER_API_KEY && BUFFER_CHANNEL_IDS.length)
  };
}

function getPlatformCapabilities() {
  const credentials = getCredentialStatus();
  return {
    facebook: {
      ready: credentials.facebook,
      selectable: credentials.facebook,
      reason: credentials.facebook ? "" : "請在 Railway Variables 設定 FB_PAGE_ID 與 FB_PAGE_ACCESS_TOKEN。"
    },
    buffer: {
      ready: credentials.buffer,
      selectable: credentials.buffer,
      reason: credentials.buffer ? "" : "請設定 BUFFER_API_KEY 與 BUFFER_CHANNEL_IDS。"
    },
    x: {
      ready: false,
      selectable: false,
      reason: "X 發文尚未完成 OAuth 1.0a 簽章，暫時無法自動送出。"
    },
    tiktok: {
      ready: false,
      selectable: false,
      reason: "TikTok Content Posting API 尚未核准或完成設定。"
    },
    instagram: {
      ready: false,
      selectable: false,
      reason: credentials.instagram
        ? "Instagram Graph API 帳號權限尚未就緒，暫時無法自動送出。"
        : "請先設定 IG_USER_ID 與 IG_ACCESS_TOKEN。"
    }
  };
}

function makeAbsoluteUrl(req, url) {
  const text = String(url || "").trim();
  if (/^https?:\/\//i.test(text)) return text;
  if (!req && PUBLIC_BASE_URL) {
    const base = PUBLIC_BASE_URL.startsWith("http") ? PUBLIC_BASE_URL : `https://${PUBLIC_BASE_URL}`;
    return `${base.replace(/\/+$/, "")}${text.startsWith("/") ? text : `/${text}`}`;
  }
  if (!req) {
    throw new Error("PUBLIC_BASE_URL is required for scheduled media publishing.");
  }
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}${text.startsWith("/") ? text : `/${text}`}`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || data.message || `Request failed with ${response.status}`);
  }
  return data;
}

async function bufferGraphql(query) {
  if (!BUFFER_API_KEY) {
    throw new Error("Buffer API key is not configured.");
  }

  const data = await fetchJson("https://api.buffer.com", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BUFFER_API_KEY}`
    },
    body: JSON.stringify({ query })
  });

  if (Array.isArray(data.errors) && data.errors.length) {
    throw new Error(data.errors.map((error) => error.message).filter(Boolean).join(" / ") || "Buffer API request failed.");
  }

  return data.data;
}

function graphQlString(value) {
  return JSON.stringify(String(value || ""));
}

function bufferAssetInput(req, media) {
  if (!media.length) return "";
  const assets = media
    .map((item) => {
      const url = graphQlString(makeAbsoluteUrl(req, item.url));
      return item.type === "video" ? `{ video: { url: ${url} } }` : `{ image: { url: ${url} } }`;
    })
    .join(", ");
  return `assets: [${assets}]`;
}

async function publishBuffer(req, post) {
  if (!BUFFER_API_KEY || !BUFFER_CHANNEL_IDS.length) {
    throw new Error("Buffer API is not configured. Set BUFFER_API_KEY and BUFFER_CHANNEL_IDS.");
  }

  const media = (post.media || []).filter((item) => item.type === "image" || item.type === "video");
  const scheduledAt = Date.parse(post.scheduledAt || "");
  const scheduleFields = Number.isFinite(scheduledAt) && scheduledAt > Date.now()
    ? `mode: customScheduled, dueAt: ${graphQlString(new Date(scheduledAt).toISOString())}`
    : "mode: addToQueue";
  const assetFields = bufferAssetInput(req, media);
  const results = [];

  for (const channelId of BUFFER_CHANNEL_IDS) {
    const query = `
      mutation CreatePost {
        createPost(input: {
          text: ${graphQlString(post.content)}
          channelId: ${graphQlString(channelId)}
          schedulingType: automatic
          ${scheduleFields}
          ${assetFields}
        }) {
          ... on PostActionSuccess {
            post {
              id
              text
            }
          }
          ... on MutationError {
            message
          }
        }
      }
    `;
    const data = await bufferGraphql(query);
    const response = data?.createPost;
    if (response?.message) {
      throw new Error(response.message);
    }
    results.push(response?.post || response);
  }

  return { channels: BUFFER_CHANNEL_IDS.length, posts: results };
}

async function publishFacebook(req, post) {
  if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
    throw new Error("Facebook Page API is not configured.");
  }

  const images = post.media.filter((item) => item.type === "image").slice(0, 10);
  const videos = post.media.filter((item) => item.type === "video");
  if (videos.length) {
    const body = new URLSearchParams({
      access_token: FB_PAGE_ACCESS_TOKEN,
      description: post.content,
      file_url: makeAbsoluteUrl(req, videos[0].url)
    });
    return fetchJson(`https://graph.facebook.com/v20.0/${FB_PAGE_ID}/videos`, { method: "POST", body });
  }

  if (images.length) {
    const attached = [];
    for (const image of images) {
      const body = new URLSearchParams({
        access_token: FB_PAGE_ACCESS_TOKEN,
        url: makeAbsoluteUrl(req, image.url),
        published: "false"
      });
      const photo = await fetchJson(`https://graph.facebook.com/v20.0/${FB_PAGE_ID}/photos`, { method: "POST", body });
      attached.push({ media_fbid: photo.id });
    }
    const body = new URLSearchParams({
      access_token: FB_PAGE_ACCESS_TOKEN,
      message: post.content
    });
    attached.forEach((item, index) => body.append(`attached_media[${index}]`, JSON.stringify(item)));
    return fetchJson(`https://graph.facebook.com/v20.0/${FB_PAGE_ID}/feed`, { method: "POST", body });
  }

  const body = new URLSearchParams({
    access_token: FB_PAGE_ACCESS_TOKEN,
    message: post.content
  });
  return fetchJson(`https://graph.facebook.com/v20.0/${FB_PAGE_ID}/feed`, { method: "POST", body });
}

async function publishToPlatform(req, post, platform) {
  if (platform === "facebook") return publishFacebook(req, post);
  if (platform === "buffer") return publishBuffer(req, post);
  if (platform === "x") throw new Error("X media/text publishing needs OAuth 1.0a signing before it can be enabled.");
  if (platform === "tiktok") throw new Error("TikTok Content Posting API is not approved/configured yet.");
  if (platform === "instagram") throw new Error("Instagram Graph API account is not ready yet.");
  throw new Error(`Unsupported platform: ${platform}`);
}

async function publishSocialPost(req, post) {
  const results = {};
  for (const platform of post.platforms) {
    try {
      const data = await publishToPlatform(req, post, platform);
      results[platform] = { ok: true, data };
    } catch (error) {
      results[platform] = { ok: false, message: error.message };
    }
  }
  const ok = Object.values(results).some((result) => result.ok);
  return { ok, results };
}

async function publishDueSocialPosts() {
  const posts = readSocialPosts();
  const now = Date.now();
  let changed = false;

  for (const post of posts) {
    if (post.status !== "scheduled" || !post.scheduledAt) continue;
    const dueAt = Date.parse(post.scheduledAt);
    if (!Number.isFinite(dueAt) || dueAt > now) continue;

    post.status = "publishing";
    post.updatedAt = new Date().toISOString();
    changed = true;
    const result = await publishSocialPost(null, post);
    post.status = result.ok ? "published" : "failed";
    post.results = result.results;
    post.updatedAt = new Date().toISOString();
  }

  if (changed) {
    writeSocialPosts(posts);
  }
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
  if (req.method === "GET" && url.pathname === "/api/public-inventory-status") {
    return sendJson(res, 200, getPublicInventoryStatus());
  }

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
        dataDirSource: PERSIST_DIR_SOURCE,
        railwayRuntime: isRailwayRuntime,
        volumeMounted: Boolean(process.env.RAILWAY_VOLUME_MOUNT_PATH || PERSIST_DIR === DEFAULT_RAILWAY_DATA_DIR),
        inventoryFile: DATA_FILE,
        uploadDir: UPLOAD_DIR
      }
    });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/social/status") {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, message: "Unauthorized." });
    }
    return sendJson(res, 200, {
      ok: true,
      credentials: getCredentialStatus(),
      capabilities: getPlatformCapabilities()
    });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/social/posts") {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, message: "Unauthorized." });
    }
    return sendJson(res, 200, { ok: true, posts: readSocialPosts().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) });
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = JSON.parse((await readBody(req)) || "{}");
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    if (!ADMIN_USER || !ADMIN_PASS) {
      return sendJson(res, 503, { ok: false, message: "Admin login is not configured." });
    }
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

  if (req.method === "POST" && url.pathname === "/api/admin/upload-social-media") {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, message: "Unauthorized." });
    }

    const body = JSON.parse((await readBody(req)) || "{}");
    const mimeType = String(body.mimeType || "");
    const ext = extensionFromMime(mimeType);
    const mediaType = mediaKindFromMime(mimeType);
    const base64 = String(body.data || "");

    if (!ext || !mediaType || !base64) {
      return sendJson(res, 400, { ok: false, message: "Please upload a JPG, PNG, WebP, GIF, MP4, MOV, or WebM file." });
    }

    const bytes = Buffer.from(base64, "base64");
    if (!bytes.length || bytes.length > 80 * 1024 * 1024) {
      return sendJson(res, 400, { ok: false, message: "Media is empty or larger than 80MB." });
    }

    ensureUploadDir();
    const stem = safeFileStem(body.name || "social");
    const filename = `${stem}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), bytes);
    return sendJson(res, 200, { ok: true, url: `/assets/uploads/${filename}`, type: mediaType, name: body.name || filename });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/social/posts") {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, message: "Unauthorized." });
    }

    const body = JSON.parse((await readBody(req)) || "{}");
    const platforms = normalizePlatforms(body.platforms);
    const content = String(body.content || "").trim();
    const media = normalizeMediaList(body.media);
    const scheduledAt = String(body.scheduledAt || "").trim();

    if (!platforms.length) {
      return sendJson(res, 400, { ok: false, message: "Please select at least one platform." });
    }
    if (!content && !media.length) {
      return sendJson(res, 400, { ok: false, message: "Please add text, images, or a video." });
    }

    const posts = readSocialPosts();
    const post = {
      id: crypto.randomBytes(10).toString("hex"),
      content,
      media,
      platforms,
      scheduledAt,
      status: scheduledAt ? "scheduled" : "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      results: {}
    };
    posts.push(post);
    writeSocialPosts(posts);
    return sendJson(res, 200, { ok: true, post });
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/admin/social/posts/") && url.pathname.endsWith("/publish")) {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { ok: false, message: "Unauthorized." });
    }

    const id = url.pathname.split("/").at(-2);
    const posts = readSocialPosts();
    const post = posts.find((item) => item.id === id);
    if (!post) {
      return sendJson(res, 404, { ok: false, message: "Post not found." });
    }

    const result = await publishSocialPost(req, post);
    post.status = result.ok ? "published" : "failed";
    post.results = result.results;
    post.updatedAt = new Date().toISOString();
    writeSocialPosts(posts);
    return sendJson(res, result.ok ? 200 : 400, { ok: result.ok, post, results: result.results });
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

function isCompressibleType(contentType = "") {
  return /text\/|javascript|json|xml|svg/i.test(contentType);
}

function serveFile(req, res, filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypes[ext] || "application/octet-stream";
  const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const isAsset = filePath.includes(`${path.sep}assets${path.sep}`) || filePath.includes(`${path.sep}wordpress${path.sep}`);
  const headers = {
    "Content-Type": contentType,
    "Cache-Control": isAsset ? "public, max-age=604800, stale-while-revalidate=86400" : "no-cache",
    ETag: etag
  };

  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, headers);
    res.end();
    return;
  }

  const acceptsGzip = /\bgzip\b/.test(String(req.headers["accept-encoding"] || ""));
  if (acceptsGzip && stat.size > 1024 && isCompressibleType(contentType)) {
    res.writeHead(200, { ...headers, "Content-Encoding": "gzip", Vary: "Accept-Encoding" });
    fs.createReadStream(filePath).pipe(zlib.createGzip({ level: 6 })).pipe(res);
    return;
  }

  res.writeHead(200, headers);
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
    if (!path.extname(pathname)) {
      const htmlFilePath = path.join(__dirname, `${pathname}.html`);
      if (fs.existsSync(htmlFilePath)) {
        filePath = htmlFilePath;
      }
    }

    if (pathname === "/inventory.html" && !isAuthenticated(req) && !getPublicInventoryStatus().open) {
      res.writeHead(302, {
        Location: "/",
        "Cache-Control": "no-cache"
      });
      res.end();
      return;
    }

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
    serveFile(req, res, filePath);
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error.message });
  }
});

initializePersistentStorage();
setInterval(() => {
  publishDueSocialPosts().catch((error) => {
    console.error("Social scheduler failed:", error.message);
  });
}, 60 * 1000);

server.listen(PORT, () => {
  console.log(`Fulin server running at http://localhost:${PORT}`);
});
