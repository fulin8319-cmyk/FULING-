import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const testDataDir = mkdtempSync(path.join(tmpdir(), "fulin-mobile-inventory-"));
const port = 18000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const fixture = [
  { code: "A020001", name: "第一筆", kg: 1, status: "confirmed", side: "csv" },
  { code: "A020002", name: "重複編號甲", kg: 2, status: "confirmed", side: "csv" },
  { code: "A020002", name: "重複編號乙", kg: 3, status: "confirmed", side: "csv" },
  { code: "A020003", name: "最後一筆", kg: 4, status: "confirmed", side: "csv" }
];

writeFileSync(
  path.join(testDataDir, "inventory.json"),
  JSON.stringify({ items: fixture }, null, 2)
);

const server = spawn(process.execPath, ["server.js"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    PORT: String(port),
    FULIN_DATA_DIR: testDataDir,
    ADMIN_USER: "test-admin",
    ADMIN_PASS: "test-pass"
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
});

let serverError = "";
server.stderr.on("data", (chunk) => {
  serverError += chunk;
});

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/inventory`);
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Test server did not start. ${serverError}`);
}

async function getItems() {
  const response = await fetch(`${baseUrl}/api/inventory`);
  assert.equal(response.ok, true);
  return (await response.json()).items;
}

try {
  await waitForServer();

  const loginResponse = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "test-admin", password: "test-pass" })
  });
  assert.equal(loginResponse.ok, true);
  const cookie = loginResponse.headers.get("set-cookie").split(";")[0];

  const before = await getItems();
  const beforeSnapshot = JSON.stringify(before);
  const payload = {
    baseCode: "A099999",
    displayTitle: "手機入庫測試",
    color: "測試",
    weightPerYard: 200,
    width: 60,
    images: ["/uploads/1.jpg", "/uploads/2.jpg", "/uploads/3.jpg"],
    rolls: [{ rollNo: "1", kg: 1, yards: 5, status: "review" }]
  };

  async function sendMobileEntry() {
    const response = await fetch(`${baseUrl}/api/admin/inventory-rolls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie
      },
      body: JSON.stringify(payload)
    });
    assert.equal(response.ok, true);
    return response.json();
  }

  const firstResult = await sendMobileEntry();
  const afterFirst = await getItems();
  assert.equal(firstResult.total, 5);
  assert.equal(afterFirst.length, 5);
  assert.equal(JSON.stringify(afterFirst.slice(0, before.length)), beforeSnapshot);
  assert.equal(afterFirst.filter((item) => item.code === "A020002").length, 2);

  payload.rolls[0].kg = 2;
  const secondResult = await sendMobileEntry();
  const afterSecond = await getItems();
  assert.equal(secondResult.total, 5);
  assert.equal(afterSecond.length, 5);
  assert.equal(JSON.stringify(afterSecond.slice(0, before.length)), beforeSnapshot);

  const mobileRows = afterSecond.filter((item) => item.code === "A099999-1");
  assert.equal(mobileRows.length, 1);
  assert.equal(mobileRows[0].kg, 2);
  assert.equal(mobileRows[0].status, "review");
  assert.equal(mobileRows[0].images.length, 3);

  console.log("手機入庫保護檢查通過：原有順序與重複編號均保留。");
} finally {
  server.kill();
  rmSync(testDataDir, { recursive: true, force: true });
}
