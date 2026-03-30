const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "fulin2026";
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
