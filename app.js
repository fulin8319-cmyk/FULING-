const state = {
  rawItems: [],
  items: [],
};

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const fabricTypeFilter = document.getElementById("fabricTypeFilter");
const colorFilter = document.getElementById("colorFilter");
const categoryFilter = document.getElementById("categoryFilter");
const compositionFilter = document.getElementById("compositionFilter");
const sortSelect = document.getElementById("sortSelect");
const inventoryRows = document.getElementById("inventoryRows");
const cardGrid = document.getElementById("cardGrid");

const resultCount = document.getElementById("resultCount");
const soldCount = document.getElementById("soldCount");
const totalKg = document.getElementById("totalKg");
const totalYards = document.getElementById("totalYards");
const maxWidth = document.getElementById("maxWidth");
const categoryCount = document.getElementById("categoryCount");

const previewModal = document.getElementById("previewModal");
const previewImage = document.getElementById("previewImage");
const previewTitle = document.getElementById("previewTitle");
const previewMeta = document.getElementById("previewMeta");
const closePreview = document.getElementById("closePreview");

function cleanText(value, fallback = "未填") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function parseNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeCodeKey(code) {
  return String(code || "").trim().toUpperCase();
}

function normalizeSearchCode(code) {
  return normalizeCodeKey(code).replace(/^A/, "");
}

function isLogoImage(url) {
  const lower = String(url || "").toLowerCase();
  return (
    lower.includes("logo.jpg") ||
    lower.includes("logo.jpeg") ||
    lower.includes("logo.png") ||
    lower.includes("fulin-logo") ||
    lower.includes("lineqr")
  );
}

function isPrintingItem(item) {
  const markerText = [
    item.category,
    item.fabricType,
    item.name,
    item.note,
    item.displayTitle,
    item.useText,
  ]
    .map((v) => String(v || ""))
    .join(" ")
    .toLowerCase();

  return (
    item.isPrintingFabric === true ||
    markerText.includes("印花") ||
    markerText.includes("print") ||
    markerText.includes("轉印") ||
    markerText.includes("昇華")
  );
}

function mapStatus(status) {
  const text = String(status || "").trim().toLowerCase();
  if (text.includes("sold") || text.includes("已售")) return "已售出";
  if (text.includes("reserved") || text.includes("保留")) return "保留中";
  if (text.includes("review") || text.includes("待確認")) return "待確認";
  return "現貨中";
}

function deriveCategory(item) {
  const explicit = cleanText(item.category, "");
  if (explicit) return explicit;
  return isPrintingItem(item) ? "印花用布" : "其他布料";
}

function deriveImage(item) {
  const candidates = [
    item.image,
    item.imagePrimary,
    item.featuredImage,
    item.imageSecondary,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  for (const src of candidates) {
    if (!isLogoImage(src)) return src;
  }
  return "";
}

function buildViewItem(item) {
  const code = cleanText(item.code, "");
  const codeKey = normalizeCodeKey(code);
  const kg = parseNumber(item.kg);
  const yards = parseNumber(item.yards);
  const width = parseNumber(item.width);
  const weightPerYard = parseNumber(item.weightPerYard);

  return {
    ...item,
    code,
    codeKey,
    codeSearch: normalizeSearchCode(code),
    displayCode: code || "未填",
    displayName: cleanText(item.displayTitle || item.name || item.fabricType, "未命名"),
    displayFabricType: cleanText(item.fabricType),
    displayColor: cleanText(item.pattern),
    displayComposition: cleanText(item.composition),
    displayCategory: deriveCategory(item),
    displayLocation: cleanText(item.location),
    displayStatus: mapStatus(item.status),
    displayImage: deriveImage(item),
    kg,
    yards,
    width,
    weightPerYard,
  };
}

function scoreInventoryItem(item) {
  let score = 0;
  if (item.displayImage) score += 50;
  if (item.kg > 0) score += 20;
  if (item.yards > 0) score += 20;
  if (item.width > 0) score += 5;
  if (item.weightPerYard > 0) score += 5;
  if (isLogoImage(item.image) || isLogoImage(item.featuredImage)) score -= 100;
  return score;
}

function dedupeInventory(items) {
  const bestByCode = new Map();

  items.forEach((item) => {
    if (!item.codeKey) return;
    const current = bestByCode.get(item.codeKey);
    if (!current || scoreInventoryItem(item) > scoreInventoryItem(current)) {
      bestByCode.set(item.codeKey, item);
    }
  });

  return Array.from(bestByCode.values());
}

function matchesSearch(item, query) {
  if (!query) return true;
  const q = String(query).trim().toUpperCase();
  const qNoA = q.replace(/^A/, "");
  const haystack = [
    item.displayCode.toUpperCase(),
    item.codeSearch,
    item.displayName.toUpperCase(),
    item.displayFabricType.toUpperCase(),
    item.displayColor.toUpperCase(),
    item.displayComposition.toUpperCase(),
    item.displayCategory.toUpperCase(),
  ];
  return haystack.some((text) => text.includes(q) || text.includes(qNoA));
}

function compareItems(a, b, sortKey) {
  switch (sortKey) {
    case "code-desc":
      return b.codeKey.localeCompare(a.codeKey, "zh-Hant");
    case "kg-desc":
      return b.kg - a.kg || a.codeKey.localeCompare(b.codeKey, "zh-Hant");
    case "yards-desc":
      return b.yards - a.yards || a.codeKey.localeCompare(b.codeKey, "zh-Hant");
    case "code-asc":
    default:
      return a.codeKey.localeCompare(b.codeKey, "zh-Hant");
  }
}

function uniqueValues(items, key) {
  return Array.from(
    new Set(items.map((item) => cleanText(item[key], "")).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

function fillSelect(select, values, placeholder) {
  if (!select) return;
  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = placeholder;
  select.appendChild(allOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function populateFilterOptions(items) {
  fillSelect(statusFilter, uniqueValues(items, "displayStatus"), "全部狀態");
  fillSelect(fabricTypeFilter, uniqueValues(items, "displayFabricType"), "全部布種");
  fillSelect(colorFilter, uniqueValues(items, "displayColor"), "全部顏色");
  fillSelect(categoryFilter, uniqueValues(items, "displayCategory"), "全部分類");
  fillSelect(compositionFilter, uniqueValues(items, "displayComposition"), "全部成份");
}

function renderSummary(items) {
  resultCount.textContent = String(items.length);
  soldCount.textContent = String(items.filter((item) => item.displayStatus === "已售出").length);
  totalKg.textContent = `${items.reduce((sum, item) => sum + item.kg, 0).toFixed(1)} kg`;
  totalYards.textContent = `${items.reduce((sum, item) => sum + item.yards, 0).toFixed(1)} yd`;
  maxWidth.textContent = `${Math.max(0, ...items.map((item) => item.width))}"`;
  categoryCount.textContent = String(new Set(items.map((item) => item.displayCategory)).size);
}

function renderTable(items) {
  inventoryRows.innerHTML = "";

  items.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.displayImage ? `<img class="table-thumb" src="${item.displayImage}" alt="${item.displayCode}">` : '<span class="muted-text">無圖</span>'}</td>
      <td>${item.displayCode}</td>
      <td>${item.displayFabricType}</td>
      <td>${item.displayColor}</td>
      <td>${item.displayCategory}</td>
      <td>${item.displayComposition}</td>
      <td>${item.width ? `${item.width}"` : "-"}</td>
      <td>${item.weightPerYard || "-"}</td>
      <td>${item.kg ? item.kg.toFixed(1) : "-"}</td>
      <td>${item.yards ? item.yards.toFixed(1) : "-"}</td>
      <td>${item.displayLocation}</td>
      <td>${item.displayStatus}</td>
    `;
    inventoryRows.appendChild(tr);
  });
}

function openPreview(item) {
  if (!item.displayImage) return;
  previewImage.src = item.displayImage;
  previewTitle.textContent = item.displayCode;
  previewMeta.textContent = `${item.displayFabricType} / ${item.displayColor} / ${item.displayCategory}`;
  previewModal.hidden = false;
}

function renderCards(items) {
  cardGrid.innerHTML = "";

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "inventory-card";
    card.innerHTML = `
      <button class="inventory-card-image" type="button">
        ${item.displayImage ? `<img src="${item.displayImage}" alt="${item.displayCode}">` : '<span class="muted-text">無圖片</span>'}
      </button>
      <div class="inventory-card-body">
        <h3>${item.displayCode}</h3>
        <p>${item.displayFabricType} / ${item.displayColor}</p>
        <p>${item.displayCategory}</p>
        <p>幅寬 ${item.width ? `${item.width}"` : "-"} / 碼重 ${item.weightPerYard || "-"}</p>
        <p>${item.kg ? `${item.kg.toFixed(1)} kg` : "-"} / ${item.yards ? `${item.yards.toFixed(1)} yd` : "-"}</p>
        <p>${item.displayLocation} / ${item.displayStatus}</p>
      </div>
    `;
    const imageButton = card.querySelector(".inventory-card-image");
    imageButton?.addEventListener("click", () => openPreview(item));
    cardGrid.appendChild(card);
  });
}

function applyFilters() {
  const query = searchInput.value;
  const filtered = state.items
    .filter((item) => matchesSearch(item, query))
    .filter((item) => !statusFilter.value || item.displayStatus === statusFilter.value)
    .filter((item) => !fabricTypeFilter.value || item.displayFabricType === fabricTypeFilter.value)
    .filter((item) => !colorFilter.value || item.displayColor === colorFilter.value)
    .filter((item) => !categoryFilter.value || item.displayCategory === categoryFilter.value)
    .filter((item) => !compositionFilter.value || item.displayComposition === compositionFilter.value)
    .sort((a, b) => compareItems(a, b, sortSelect.value));

  renderSummary(filtered);
  renderTable(filtered);
  renderCards(filtered);
}

async function loadInventory() {
  const response = await fetch("./api/inventory");
  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload : payload.items || [];

  state.rawItems = rows;
  state.items = dedupeInventory(
    state.rawItems
      .map(buildViewItem)
      .filter((item) => item.codeKey)
      .filter((item) => isPrintingItem(item))
      .filter((item) => !isLogoImage(item.displayImage))
  );

  populateFilterOptions(state.items);
  applyFilters();
}

closePreview?.addEventListener("click", () => {
  previewModal.hidden = true;
  previewImage.src = "";
});

previewModal?.addEventListener("click", (event) => {
  if (event.target === previewModal) {
    previewModal.hidden = true;
    previewImage.src = "";
  }
});

[searchInput, statusFilter, fabricTypeFilter, colorFilter, categoryFilter, compositionFilter, sortSelect].forEach((element) => {
  element?.addEventListener("input", applyFilters);
  element?.addEventListener("change", applyFilters);
});

loadInventory().catch((error) => {
  console.error(error);
});
