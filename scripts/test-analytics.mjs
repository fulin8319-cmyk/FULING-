import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fulin-analytics-"));

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

await fs.writeFile(path.join(tempDir, "inventory.json"), "[]\n", "utf8");
await fs.writeFile(path.join(tempDir, "analytics.json"), '{"days":{},"sessions":{}}\n', "utf8");
await fs.writeFile(path.join(tempDir, "social-posts.json"), "[]\n", "utf8");

const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["server.js"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    PORT: String(port),
    FULIN_DATA_DIR: tempDir,
    ADMIN_USER: "analytics-test",
    ADMIN_PASS: "analytics-test"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/me`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Analytics test server did not start.");
}

async function sendEvent(payload) {
  const response = await fetch(`${baseUrl}/api/analytics/event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "fulin-analytics-test",
      "X-Forwarded-For": "203.0.113.8"
    },
    body: JSON.stringify(payload)
  });
  assert.equal(response.status, 200);
}

try {
  await waitForServer();

  const homepage = await fetch(`${baseUrl}/`);
  const homepageHtml = await homepage.text();
  assert.match(homepageHtml, /analytics\.js\?v=20260804/);

  await sendEvent({ type: "cta_click", sessionId: "session_test_01", path: "/", source: "Google", action: "line" });
  await sendEvent({ type: "page_view", sessionId: "session_test_01", path: "/", source: "Google" });
  await sendEvent({ type: "engagement", sessionId: "session_test_01", seconds: 12 });
  await sendEvent({ type: "page_view", sessionId: "session_test_02", path: "/inventory.html", source: "直接進入" });

  const login = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "analytics-test", password: "analytics-test" })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie");
  assert.ok(cookie);

  const response = await fetch(`${baseUrl}/api/admin/analytics?range=today`, {
    headers: { Cookie: cookie }
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  const analytics = data.analytics;

  assert.equal(analytics.sessions, 2);
  assert.equal(analytics.visitors, 1);
  assert.equal(analytics.bounceRate, 50);
  assert.equal(analytics.averageEngagementSeconds, 6);
  assert.equal(analytics.actionsTotal, 1);
  assert.equal(analytics.sources.find((row) => row.source === "Google").count, 1);
  assert.equal(analytics.sources.find((row) => row.source === "直接進入").count, 1);
  assert.equal(analytics.topLandingPages[0].sessions, 1);
  assert.equal(analytics.actions.find((row) => row.key === "line").clicks, 1);

  console.log("流量統計檢查通過：來源、跳出率、互動時間、工作階段與按鈕事件皆正確。");
} finally {
  child.kill();
  await fs.rm(tempDir, { recursive: true, force: true });
}
