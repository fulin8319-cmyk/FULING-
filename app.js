const state = {
  rawItems: [],
  items: [],
};

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const fabricTypeFilter = document.getElementById("fabricTypeFilter");
const colorFilter = document.getElementById("colorFilter");
const categoryFilter = document.getElementById("categoryFilter");
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

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/^A/i, "");
}

function cleanText(value, fallback = "?芸‵") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function parseNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function isLogoImage(url) {
  const lower = String(url || "").toLowerCase();
  return (
    lower.includes("/logo.jpg") ||
    lower.includes("fulin-logo") ||
    lower.includes("logo.JPG".toLowerCase()) ||
    lower.includes("d80_0722")
  );
}

function isPrintingItem(item) {
  return (
    item.isPrintingFabric === true ||
    cleanText(item.category, "").includes("?啗")
  );
}

function deriveCategory(item) {
  const explicit = cleanText(item.category, "");
  if (explicit) return explicit;
  return isPrintingItem(item) ? "?啗?典?" : "?嗡?撣?";
}

function buildImage(item) {
  const primary = cleanText(item.imagePrimary || item.image, "");
  const secondary = cleanText(item.imageSecondary, "");
  if (primary && !isLogoImage(primary)) return primary;
  if (secondary && !isLogoImage(secondary)) return secondary;
  return "";
}

function buildViewItem(item) {
  const kg = parseNumber(item.kg);
  const yards = parseNumber(item.yards);
  const width = parseNumber(item.width);
  const weightPerYard = parseNumber(item.weightPerYard);

  return {
    ...item,
    normalizedCode: normalizeCode(item.code),
    displayCode: cleanText(item.code, "?芰楊??),
    displayName: cleanText(item.name || item.fabricType, "?芸??),
    displayFabricType: cleanText(item.fabricType, "?芸?憿?),
    displayColor: cleanText(item.pattern, "?芸?憿?),
    displayComposition: cleanText(item.composition, "?芸‵"),
    displayCategory: deriveCategory(item),
    displayLocation: cleanText(item.location, "?芸‵"),
    displayStatus: cleanText(item.status, "?曇疏銝?),
    displayImage: buildImage(item),
    kg,
    yards,
    width,
    weightPerYard,
  };
}

function scoreInventoryItem(item) {
  let score = 0;
  if (isPrintingItem(item)) score += 100;
  if (item.displayImage) score += 40;
  if (item.kg > 0) score += 10;
  if (item.yards > 0) score += 10;
  if (item.width > 0) score += 5;
  if (item.weightPerYard > 0) score += 5;
  if (!isLogoImage(item.image || item.imagePrimary)) score += 5;
  return score;
}

function dedupeInventory(items) {
  const bestMap = new Map();

  items.forEach((item) => {
<<<<<<< HEAD
    const key = item.displayCode || `${item.displayName}-${item.displayLocation}-${item.kg}-${item.yards}`;
    const current = bestByCode.get(key);
=======
    if (!item.normalizedCode) return;
    const current = bestMap.get(item.normalizedCode);
>>>>>>> 9ed663e (Fix printing inventory dedupe and search behavior)
    if (!current || scoreInventoryItem(item) > scoreInventoryItem(current)) {
      bestMap.set(item.normalizedCode, item);
    }
  });

  return Array.from(bestMap.values());
}

function matchesSearch(item, query) {
  if (!query) return true;
  const normalizedQuery = query.trim().toUpperCase().replace(/^A/i, "");
  const haystack = [
    item.displayCode,
    item.normalizedCode,
    item.displayName,
    item.displayFabricType,
    item.displayColor,
    item.displayComposition,
    item.displayCategory,
  ]
    .join(" ")
    .toUpperCase();
  return haystack.includes(normalizedQuery);
}

function compareItems(a, b, sortKey) {
  switch (sortKey) {
    case "code-desc":
      return b.normalizedCode.localeCompare(a.normalizedCode, "zh-Hant");
    case "kg-desc":
      return b.kg - a.kg || a.normalizedCode.localeCompare(b.normalizedCode, "zh-Hant");
    case "yards-desc":
      return b.yards - a.yards || a.normalizedCode.localeCompare(b.normalizedCode, "zh-Hant");
    case "code-asc":
    default:
      return a.normalizedCode.localeCompare(b.normalizedCode, "zh-Hant");
  }
}

function uniqueValues(items, key) {
  return Array.from(
    new Set(items.map((item) => cleanText(item[key], "")).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

function fillSelect(select, values, placeholder) {
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
  fillSelect(statusFilter, uniqueValues(items, "displayStatus"), "?券???);
  fillSelect(fabricTypeFilter, uniqueValues(items, "displayFabricType"), "?券撣車");
  fillSelect(colorFilter, uniqueValues(items, "displayColor"), "?券憿");
  fillSelect(categoryFilter, uniqueValues(items, "displayCategory"), "?券撣?蝔桅?");
}

function renderSummary(items) {
  resultCount.textContent = String(items.length);
  soldCount.textContent = String(items.filter((item) => item.displayStatus === "sold" || item.displayStatus === "撌脣??).length);
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
      <td>${item.displayImage ? `<img class="table-thumb" src="${item.displayImage}" alt="${item.displayCode}">` : '<span class="muted-text">?芸‵</span>'}</td>
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
        ${item.displayImage ? `<img src="${item.displayImage}" alt="${item.displayCode}">` : '<span class="muted-text">?∪???/span>'}
      </button>
      <div class="inventory-card-body">
        <h3>${item.displayCode}</h3>
        <p>${item.displayFabricType} / ${item.displayColor}</p>
        <p>${item.displayCategory}</p>
        <p>撟祝 ${item.width ? `${item.width}"` : "-"} / 蝣潮? ${item.weightPerYard || "-"}</p>
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
    .sort((a, b) => compareItems(a, b, sortSelect.value));

  renderSummary(filtered);
  renderTable(filtered);
  renderCards(filtered);
}

async function loadInventory() {
  const response = await fetch("./api/inventory");
  const data = await response.json();

  state.rawItems = Array.isArray(data) ? data : [];
  state.items = dedupeInventory(
    state.rawItems
      .map(buildViewItem)
      .filter((item) => isPrintingItem(item))
      .filter((item) => !isLogoImage(item.image || item.imagePrimary || item.displayImage))
      .filter((item) => item.normalizedCode)
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

[searchInput, statusFilter, fabricTypeFilter, colorFilter, categoryFilter, sortSelect].forEach((element) => {
  element?.addEventListener("input", applyFilters);
  element?.addEventListener("change", applyFilters);
});

loadInventory().catch((error) => {
  console.error(error);
});

