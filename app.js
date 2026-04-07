let inventory = [];

const rowsEl = document.getElementById("inventoryRows");
const cardGridEl = document.getElementById("cardGrid");
const searchInputEl = document.getElementById("searchInput");
const statusFilterEl = document.getElementById("statusFilter");
const fabricTypeFilterEl = document.getElementById("fabricTypeFilter");
const colorFilterEl = document.getElementById("colorFilter");
const categoryFilterEl = document.getElementById("categoryFilter");
const sortSelectEl = document.getElementById("sortSelect");
const summaryStripEl = document.getElementById("summaryStrip");
const recordCountEl = document.getElementById("recordCount");
const reviewCountEl = document.getElementById("reviewCount");
const modalEl = document.getElementById("previewModal");
const modalSwatchEl = document.getElementById("modalSwatch");
const modalInfoEl = document.getElementById("modalInfo");
const closeModalEl = document.getElementById("closeModal");

function formatNumber(value, digits = 1) {
  return Number(value || 0).toFixed(digits);
}

function statusLabel(status) {
  if (status === "review") return "待確認";
  if (status === "sold") return "已售出";
  if (status === "reserved") return "保留中";
  return "現貨中";
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^A/, "");
}

function cleanText(value) {
  return String(value || "").trim();
}

function deriveCategory(item) {
  const text = [
    item.category,
    item.fabricType,
    item.name,
    item.note,
    item.composition
  ].join(" ").toLowerCase();

  if (/印|print|昇華|轉印/.test(text)) return "印花用布";
  if (/針織/.test(text)) return "針織布";
  if (/平織/.test(text)) return "平織布";
  if (/op|spandex|lycra|彈/.test(text)) return "彈性布";
  if (/mesh|網/.test(text)) return "網布";
  if (/刷毛|毛圈/.test(text)) return "刷毛布";
  if (/尼龍|\bn\b/.test(text)) return "尼龍布";
  if (/poly|聚酯|\bt\b/.test(text)) return "聚酯布";
  return "其他布料";
}

function deriveColor(item) {
  const text = [item.pattern, item.name, item.note].join(" ");
  const colorMap = [
    ["黑", "黑色"],
    ["白", "白色"],
    ["灰", "灰色"],
    ["藍", "藍色"],
    ["深藍", "深藍"],
    ["紅", "紅色"],
    ["綠", "綠色"],
    ["黃", "黃色"],
    ["紫", "紫色"],
    ["粉", "粉色"],
    ["咖", "咖色"],
    ["米", "米色"],
    ["卡其", "卡其"],
    ["條紋", "條紋"],
    ["格", "格紋"],
    ["印花", "印花"],
    ["素", "素色"]
  ];

  const match = colorMap.find(([keyword]) => text.includes(keyword));
  return match ? match[1] : cleanText(item.pattern) || "未分類";
}

function buildViewItem(item) {
  return {
    ...item,
    displayCode: cleanText(item.code),
    normalizedCode: normalizeCode(item.code),
    normalizedBaseCode: normalizeCode(item.baseCode),
    displayFabricType: cleanText(item.fabricType) || "未分類",
    displayColor: deriveColor(item),
    displayCategory: deriveCategory(item),
    displayName: cleanText(item.name) || cleanText(item.displayTitle) || cleanText(item.code),
    displayLocation: cleanText(item.location) || "未填",
    displayImage: cleanText(item.image) || "./assets/Logo.JPG"
  };
}

function populateFilter(selectEl, values, allLabel) {
  const currentValue = selectEl.value || "all";
  const options = [`<option value="all">${allLabel}</option>`].concat(
    values.map((value) => `<option value="${value}">${value}</option>`)
  );
  selectEl.innerHTML = options.join("");
  selectEl.value = values.includes(currentValue) ? currentValue : "all";
}

function refreshFilterOptions() {
  const fabricTypes = [...new Set(inventory.map((item) => item.displayFabricType).filter(Boolean))].sort();
  const colors = [...new Set(inventory.map((item) => item.displayColor).filter(Boolean))].sort();
  const categories = [...new Set(inventory.map((item) => item.displayCategory).filter(Boolean))].sort();

  populateFilter(fabricTypeFilterEl, fabricTypes, "全部布種");
  populateFilter(colorFilterEl, colors, "全部顏色");
  populateFilter(categoryFilterEl, categories, "全部種類");
}

function getFilteredRecords() {
  const keyword = searchInputEl.value.trim().toLowerCase();
  const normalizedKeyword = normalizeCode(keyword);
  const status = statusFilterEl.value;
  const fabricType = fabricTypeFilterEl.value;
  const color = colorFilterEl.value;
  const category = categoryFilterEl.value;
  const sortKey = sortSelectEl.value;

  const filtered = inventory.filter((item) => {
    const haystack = [
      item.displayCode,
      item.normalizedCode,
      item.baseCode,
      item.normalizedBaseCode,
      item.rollNo,
      item.displayName,
      item.displayFabricType,
      item.displayColor,
      item.displayCategory,
      String(item.width),
      String(item.weightPerYard),
      String(item.kg),
      String(item.yards),
      item.displayLocation,
      item.side
    ].join(" ").toLowerCase();

    const codeMatch = !normalizedKeyword ||
      item.normalizedCode.includes(normalizedKeyword) ||
      item.normalizedBaseCode.includes(normalizedKeyword);

    const textMatch = !keyword || haystack.includes(keyword);
    const matchesSearch = !keyword || codeMatch || textMatch;
    const matchesStatus = status === "all" || item.status === status;
    const matchesFabricType = fabricType === "all" || item.displayFabricType === fabricType;
    const matchesColor = color === "all" || item.displayColor === color;
    const matchesCategory = category === "all" || item.displayCategory === category;

    return matchesSearch && matchesStatus && matchesFabricType && matchesColor && matchesCategory;
  });

  filtered.sort((a, b) => {
    if (sortKey === "code") return a.displayCode.localeCompare(b.displayCode, undefined, { numeric: true, sensitivity: "base" });
    return (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0);
  });

  return filtered;
}

function buildSummary(records) {
  const totalKg = records.reduce((sum, item) => sum + (item.kg || 0), 0);
  const totalYards = records.reduce((sum, item) => sum + (item.yards || 0), 0);
  const maxWidth = records.reduce((max, item) => Math.max(max, item.width || 0), 0);
  const categories = new Set(records.map((item) => item.displayCategory)).size;

  summaryStripEl.innerHTML = [
    { label: "總公斤數", value: `${formatNumber(totalKg)} kg` },
    { label: "總碼數", value: `${formatNumber(totalYards)} yd` },
    { label: "最大幅寬", value: `${maxWidth}"` },
    { label: "布料種類", value: categories }
  ].map((card) => `
    <article class="summary-card">
      <span>${card.label}</span>
      <strong>${card.value}</strong>
    </article>
  `).join("");
}

function openPreview(item) {
  modalSwatchEl.style.background = `center / cover no-repeat url("${item.displayImage}")`;
  modalInfoEl.innerHTML = `
    <div>
      <p class="eyebrow">Fabric Detail</p>
      <h3>${item.displayCode}</h3>
      <p>${item.normalizedBaseCode && item.normalizedBaseCode !== item.normalizedCode ? `主編號 A${item.normalizedBaseCode}` : "單支庫存"}${item.rollNo ? ` / 支號 ${item.rollNo}` : ""}</p>
    </div>
    <div class="modal-grid">
      <div class="detail-card"><span>布種</span><strong>${item.displayFabricType}</strong></div>
      <div class="detail-card"><span>顏色</span><strong>${item.displayColor}</strong></div>
      <div class="detail-card"><span>布料種類</span><strong>${item.displayCategory}</strong></div>
      <div class="detail-card"><span>幅寬</span><strong>${item.width}"</strong></div>
      <div class="detail-card"><span>碼重</span><strong>${item.weightPerYard}</strong></div>
      <div class="detail-card"><span>公斤數</span><strong>${item.kg ? `${formatNumber(item.kg)} kg` : "-"}</strong></div>
      <div class="detail-card"><span>碼數</span><strong>${item.yards ? `${formatNumber(item.yards)} yd` : "-"}</strong></div>
      <div class="detail-card"><span>庫位</span><strong>${item.displayLocation}</strong></div>
    </div>
    <div class="note">${item.note || "目前沒有額外備註。"}</div>
  `;
  modalEl.showModal();
}

function bindPreviewClicks() {
  document.querySelectorAll("[data-code]").forEach((element) => {
    element.addEventListener("click", () => {
      const item = inventory.find((entry) => entry.displayCode === element.dataset.code);
      if (item) openPreview(item);
    });
  });
}

function render() {
  const records = getFilteredRecords();
  recordCountEl.textContent = records.length;
  reviewCountEl.textContent = records.filter((item) => item.status === "review").length;
  buildSummary(records);

  rowsEl.innerHTML = records.map((item) => `
    <tr>
      <td><div class="mini-swatch" data-code="${item.displayCode}" style="background:center / cover no-repeat url('${item.displayImage}')"></div></td>
      <td>${item.displayCode}</td>
      <td>${item.normalizedBaseCode && item.normalizedBaseCode !== item.normalizedCode ? `A${item.normalizedBaseCode}` : "-"}</td>
      <td>${item.rollNo || "-"}</td>
      <td>${item.displayFabricType}</td>
      <td>${item.displayColor}</td>
      <td>${item.displayCategory}</td>
      <td>${item.width}"</td>
      <td>${item.weightPerYard}</td>
      <td>${item.kg ? formatNumber(item.kg) : "-"}</td>
      <td>${item.yards ? formatNumber(item.yards) : "-"}</td>
      <td>${item.displayLocation}</td>
      <td><span class="status-pill status-${item.status}">${statusLabel(item.status)}</span></td>
    </tr>
  `).join("");

  cardGridEl.innerHTML = records.map((item) => `
    <article class="fabric-card fabric-card-${item.status}">
      <div class="swatch" data-code="${item.displayCode}" style="background:center / cover no-repeat url('${item.displayImage}')"></div>
      <div class="fabric-meta">
        <strong>${item.displayCode}</strong>
        <span>${item.displayFabricType} / ${item.displayColor}</span>
        <span>${item.displayCategory}</span>
        <span>幅寬 ${item.width}" / 碼重 ${item.weightPerYard}</span>
        <span>${item.kg ? formatNumber(item.kg) : "-"} kg / ${item.yards ? formatNumber(item.yards) : "-"} yd</span>
        <span>${item.displayLocation} / ${statusLabel(item.status)}</span>
      </div>
    </article>
  `).join("");

  bindPreviewClicks();
}

async function loadInventory() {
  const response = await fetch("/api/inventory");
  const data = await response.json();
  inventory = (data.items || []).map(buildViewItem);
  refreshFilterOptions();
  render();
}

searchInputEl.addEventListener("input", render);
statusFilterEl.addEventListener("change", render);
fabricTypeFilterEl.addEventListener("change", render);
colorFilterEl.addEventListener("change", render);
categoryFilterEl.addEventListener("change", render);
sortSelectEl.addEventListener("change", render);
closeModalEl.addEventListener("click", () => modalEl.close());
modalEl.addEventListener("click", (event) => {
  const rect = modalEl.getBoundingClientRect();
  const isInside =
    rect.top <= event.clientY &&
    event.clientY <= rect.top + rect.height &&
    rect.left <= event.clientX &&
    event.clientX <= rect.left + rect.width;
  if (!isInside) modalEl.close();
});

loadInventory();
