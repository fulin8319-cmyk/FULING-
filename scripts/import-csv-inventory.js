const fs = require("fs");
const path = require("path");

const csvPath = process.argv[2] || "C:/Users/user/Downloads/db9f5d.布料庫存明細表.csv";
const inventoryPath =
  process.argv[3] ||
  "C:/Users/user/Desktop/新增資料夾/inventory-prototype/data/inventory.json";

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }

      row.push(current);
      current = "";

      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    current += char;
  }

  if (current !== "" || row.length) {
    row.push(current);
    rows.push(row);
  }

  const [header = [], ...dataRows] = rows;
  return dataRows.map((cells) => {
    const entry = {};
    header.forEach((key, index) => {
      entry[key] = (cells[index] || "").trim();
    });
    return entry;
  });
}

function getNumber(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const num = Number(text);
  return Number.isFinite(num) ? num : 0;
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function getYards(kg, weightPerYard) {
  if (!kg || !weightPerYard) return 0;
  return roundOne((kg * 1000) / weightPerYard);
}

function pickImage(row) {
  return row["照片連結"] || row["照片 1"] || row["照片 2"] || "";
}

function mapStatus(statusText) {
  const text = String(statusText || "").trim();
  if (!text) return "confirmed";
  if (/[售賣]/.test(text)) return "sold";
  if (/[保留預]/.test(text)) return "reserved";
  if (/[待確認檢查]/.test(text) || /review/i.test(text)) return "review";
  return "confirmed";
}

function joinParts(parts) {
  return parts.filter(Boolean).join(" | ");
}

function sanitizeBrokenInventory(raw) {
  return raw.replace(
    /^(\s*"(?:displayTitle|useText|descriptionText)"\s*:\s*").*,$/gm,
    '$1",'
  );
}

function readExistingInventory(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) {
    return [];
  }

  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(sanitizeBrokenInventory(raw));
  }
}

function toInventoryItem(row, existing = {}) {
  const code = String(row["編號"] || "").trim();
  const width = Math.round(getNumber(row["幅寬"]));
  const weightPerYard = Math.round(getNumber(row["每碼克重"]));
  const kg = roundOne(getNumber(row["公斤數"]));
  const yardsFromCsv = roundOne(getNumber(row["自動換算碼數"]));
  const yards = yardsFromCsv || getYards(kg, weightPerYard);
  const image = pickImage(row) || existing.image || "";
  const featuredOnHome =
    String(row["熱門"] || "").trim().toLowerCase() === "true" || Boolean(existing.featuredOnHome);
  const displayTitle = existing.displayTitle || String(row["品名"] || "").trim() || code;
  const useText =
    existing.useText ||
    joinParts([
      row["布種"] ? `布種：${row["布種"]}` : "",
      row["顏色／花紋"] ? `顏色：${row["顏色／花紋"]}` : ""
    ]);
  const descriptionText =
    existing.descriptionText ||
    joinParts([
      row["成份"] ? `成份：${row["成份"]}` : "",
      row["分類"] ? `分類：${row["分類"]}` : ""
    ]);

  return {
    code,
    featuredOnHome,
    displayTitle,
    useText,
    descriptionText,
    featuredImage: existing.featuredImage || (featuredOnHome ? image : ""),
    width,
    weightPerYard,
    kg,
    yards,
    location: String(row["庫存位置"] || "").trim(),
    side: existing.side || "csv",
    status: mapStatus(row["狀態"]),
    note: joinParts([
      row["品名"] ? `品名：${row["品名"]}` : "",
      row["布種"] ? `布種：${row["布種"]}` : "",
      row["顏色／花紋"] ? `顏色：${row["顏色／花紋"]}` : "",
      row["成份"] ? `成份：${row["成份"]}` : "",
      row["分類"] ? `分類：${row["分類"]}` : "",
      row["日期"] ? `日期：${row["日期"]}` : ""
    ]),
    image,
    fabricType: String(row["布種"] || "").trim(),
    name: String(row["品名"] || "").trim(),
    pattern: String(row["顏色／花紋"] || "").trim(),
    composition: String(row["成份"] || "").trim(),
    category: String(row["分類"] || "").trim(),
    rowId: String(row["🔒 Row ID"] || "").trim()
  };
}

const csvText = fs.readFileSync(csvPath, "utf8");
const csvRows = parseCsv(csvText);
const existingItems = readExistingInventory(inventoryPath);
const existingByCode = new Map(
  existingItems
    .filter((item) => item && item.code)
    .map((item) => [String(item.code).trim(), item])
);

const mergedItems = [];
const seenCodes = new Set();

for (const row of csvRows) {
  const code = String(row["編號"] || "").trim();
  if (!code) continue;
  const existing = existingByCode.get(code) || {};
  mergedItems.push(toInventoryItem(row, existing));
  seenCodes.add(code);
}

for (const item of existingItems) {
  const code = String(item.code || "").trim();
  if (!code || seenCodes.has(code)) continue;
  mergedItems.push(item);
}

mergedItems.sort((a, b) => String(a.code).localeCompare(String(b.code), "zh-Hant"));

if (fs.existsSync(inventoryPath)) {
  const backupPath = `${inventoryPath}.backup-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}`;
  fs.copyFileSync(inventoryPath, backupPath);
}

fs.writeFileSync(inventoryPath, `${JSON.stringify(mergedItems, null, 2)}\n`, "utf8");

console.log(`Imported ${csvRows.length} CSV rows.`);
console.log(`Final inventory count: ${mergedItems.length}`);
console.log(`Inventory written to: ${inventoryPath}`);
