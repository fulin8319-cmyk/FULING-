const CATEGORY_OPTIONS = [
  "現貨布",
  "印花用布",
  "針織布",
  "平織布",
  "彈性布",
  "網布",
  "刷毛布",
  "尼龍布",
  "聚酯布",
  "其他布料"
];

const STATUS_LABELS = {
  confirmed: "現貨中",
  sold: "已售出",
  reserved: "保留中",
  review: "待確認"
};

const adminRowsEl = document.getElementById("adminRows");
const adminMessageEl = document.getElementById("adminMessage");
const adminFilterSummaryEl = document.getElementById("adminFilterSummary");
const saveButtonEl = document.getElementById("saveInventoryButton");
const resetButtonEl = document.getElementById("resetInventoryButton");
const addButtonEl = document.getElementById("addInventoryButton");
const clearFormButtonEl = document.getElementById("clearInventoryFormButton");

const newCodeEl = document.getElementById("newCode");
const newCategoryEl = document.getElementById("newCategory");
const newIsPrintingFabricEl = document.getElementById("newIsPrintingFabric");
const newFeaturedOnHomeEl = document.getElementById("newFeaturedOnHome");
const newDisplayTitleEl = document.getElementById("newDisplayTitle");
const newFeaturedImageEl = document.getElementById("newFeaturedImage");
const newFabricTypeEl = document.getElementById("newFabricType");
const newPatternEl = document.getElementById("newPattern");
const newCompositionEl = document.getElementById("newComposition");
const newWidthEl = document.getElementById("newWidth");
const newWeightEl = document.getElementById("newWeightPerYard");
const newKgEl = document.getElementById("newKg");
const newYardsEl = document.getElementById("newYards");
const newLocationEl = document.getElementById("newLocation");
const newStatusEl = document.getElementById("newStatus");
const newNoteEl = document.getElementById("newNote");

const fabricTypeOptionsEl = document.getElementById("fabricTypeOptions");
const patternOptionsEl = document.getElementById("patternOptions");
const compositionOptionsEl = document.getElementById("compositionOptions");

let adminInventory = [];
let filteredIndexes = [];

const adminFilters = {
  category: "",
  isPrintingFabric: "",
  featuredOnHome: "",
  fabricType: "",
  pattern: "",
  composition: "",
  status: ""
};

function roundOne(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function yardsFromKg(kg, weightPerYard) {
  if (!kg || !weightPerYard) {
    return 0;
  }
  return roundOne((kg * 1000) / weightPerYard);
}

function kgFromYards(yards, weightPerYard) {
  if (!yards || !weightPerYard) {
    return 0;
  }
  return roundOne((yards * weightPerYard) / 1000);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function normalizeItem(item = {}) {
  const category = item.category || (item.isPrintingFabric ? "印花用布" : "現貨布");
  const isPrintingFabric = item.isPrintingFabric === true || category === "印花用布";
  const weightPerYard = Number(item.weightPerYard || 0);
  let kg = Number(item.kg || 0);
  let yards = Number(item.yards || 0);

  if (kg && weightPerYard && !yards) {
    yards = yardsFromKg(kg, weightPerYard);
  } else if (yards && weightPerYard && !kg) {
    kg = kgFromYards(yards, weightPerYard);
  }

  return {
    ...item,
    code: item.code || "",
    category,
    isPrintingFabric,
    featuredOnHome: Boolean(item.featuredOnHome),
    displayTitle: item.displayTitle || item.code || "",
    fabricType: item.fabricType || "",
    pattern: item.pattern || "",
    composition: item.composition || "",
    featuredImage: item.featuredImage || item.image || "",
    width: Number(item.width || 0),
    weightPerYard,
    kg,
    yards,
    location: item.location || "",
    status: item.status || "confirmed",
    note: item.note || "",
    image: item.image || item.featuredImage || ""
  };
}

function buildDataListMarkup(values) {
  return values
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "zh-Hant"))
    .map((value) => `<option value="${escapeAttribute(value)}"></option>`)
    .join("");
}

function refreshDataLists() {
  fabricTypeOptionsEl.innerHTML = buildDataListMarkup([...new Set(adminInventory.map((item) => item.fabricType))]);
  patternOptionsEl.innerHTML = buildDataListMarkup([...new Set(adminInventory.map((item) => item.pattern))]);
  compositionOptionsEl.innerHTML = buildDataListMarkup([...new Set(adminInventory.map((item) => item.composition))]);
}

function buildCategoryOptions(selectedValue = "") {
  const values = new Set(CATEGORY_OPTIONS);
  if (selectedValue) {
    values.add(selectedValue);
  }

  return [...values]
    .map((value) => `<option value="${escapeAttribute(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
}

function buildStatusOptions(selectedValue = "confirmed") {
  return Object.entries(STATUS_LABELS)
    .map(([value, label]) => `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${label}</option>`)
    .join("");
}

function buildBooleanOptions(selectedValue) {
  return `
    <option value="true" ${selectedValue ? "selected" : ""}>是</option>
    <option value="false" ${!selectedValue ? "selected" : ""}>否</option>
  `;
}

function populateCategorySelect(selectEl) {
  selectEl.innerHTML = buildCategoryOptions("現貨布");
}

function buildHeaderFilterOptions(key) {
  if (key === "category") {
    return CATEGORY_OPTIONS;
  }
  if (key === "isPrintingFabric" || key === "featuredOnHome") {
    return ["是", "否"];
  }
  if (key === "status") {
    return Object.values(STATUS_LABELS);
  }

  return [...new Set(adminInventory.map((item) => String(item[key] || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

function renderHeaderFilters() {
  document.querySelectorAll("[data-filter-menu]").forEach((menu) => {
    const key = menu.dataset.filterMenu;
    const selectedValue = adminFilters[key] || "";
    const options = buildHeaderFilterOptions(key)
      .map((value) => `<option value="${escapeAttribute(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
      .join("");

    menu.innerHTML = `
      <label class="admin-filter-label">
        篩選
        <select data-filter-key="${escapeAttribute(key)}">
          <option value="">全部</option>
          ${options}
        </select>
      </label>
    `;
  });
}

function getBooleanLabel(value) {
  return value ? "是" : "否";
}

function matchesFilter(item, key, value) {
  if (!value) {
    return true;
  }
  if (key === "isPrintingFabric" || key === "featuredOnHome") {
    return getBooleanLabel(Boolean(item[key])) === value;
  }
  if (key === "status") {
    return STATUS_LABELS[item.status] === value;
  }
  return String(item[key] || "").trim() === value;
}

function applyFilters() {
  filteredIndexes = adminInventory
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => Object.entries(adminFilters).every(([key, value]) => matchesFilter(item, key, value)))
    .map(({ index }) => index);
}

function updateFilterSummary() {
  const labels = {
    category: "布料種類",
    isPrintingFabric: "印花用布",
    featuredOnHome: "首頁精選",
    fabricType: "布種",
    pattern: "顏色",
    composition: "成份",
    status: "狀態"
  };

  const active = Object.entries(adminFilters)
    .filter(([, value]) => value)
    .map(([key, value]) => `${labels[key]}：${value}`);

  adminFilterSummaryEl.textContent = active.length
    ? `目前篩選：${active.join(" / ")}，共顯示 ${filteredIndexes.length} 筆。`
    : `目前顯示全部資料，共 ${filteredIndexes.length} 筆。`;
}

function renderAdminRows() {
  applyFilters();
  refreshDataLists();
  renderHeaderFilters();
  updateFilterSummary();

  adminRowsEl.innerHTML = filteredIndexes.map((realIndex) => {
    const item = adminInventory[realIndex];
    return `
      <tr>
        <td>${escapeHtml(item.code)}</td>
        <td><select data-index="${realIndex}" data-field="category">${buildCategoryOptions(item.category)}</select></td>
        <td><select data-index="${realIndex}" data-field="isPrintingFabric">${buildBooleanOptions(item.isPrintingFabric)}</select></td>
        <td><select data-index="${realIndex}" data-field="featuredOnHome">${buildBooleanOptions(item.featuredOnHome)}</select></td>
        <td><input data-index="${realIndex}" data-field="displayTitle" type="text" value="${escapeAttribute(item.displayTitle)}"></td>
        <td><input data-index="${realIndex}" data-field="fabricType" type="text" list="fabricTypeOptions" value="${escapeAttribute(item.fabricType)}"></td>
        <td><input data-index="${realIndex}" data-field="pattern" type="text" list="patternOptions" value="${escapeAttribute(item.pattern)}"></td>
        <td><input data-index="${realIndex}" data-field="composition" type="text" list="compositionOptions" value="${escapeAttribute(item.composition)}"></td>
        <td><input data-index="${realIndex}" data-field="featuredImage" type="text" value="${escapeAttribute(item.featuredImage)}"></td>
        <td><input data-index="${realIndex}" data-field="width" type="number" value="${item.width || ""}"></td>
        <td><input data-index="${realIndex}" data-field="weightPerYard" type="number" value="${item.weightPerYard || ""}"></td>
        <td><input data-index="${realIndex}" data-field="kg" type="number" step="0.1" value="${item.kg || ""}"></td>
        <td><input data-index="${realIndex}" data-field="yards" type="number" step="0.1" value="${item.yards || ""}"></td>
        <td><input data-index="${realIndex}" data-field="location" type="text" value="${escapeAttribute(item.location)}"></td>
        <td><select data-index="${realIndex}" data-field="status">${buildStatusOptions(item.status)}</select></td>
        <td><input data-index="${realIndex}" data-field="note" type="text" value="${escapeAttribute(item.note)}"></td>
        <td><button class="secondary-button admin-delete-button" type="button" data-delete-index="${realIndex}">刪除</button></td>
      </tr>
    `;
  }).join("");
}

function readFormData() {
  const next = adminInventory.map((item) => normalizeItem(item));

  document.querySelectorAll("[data-index][data-field]").forEach((element) => {
    const index = Number(element.dataset.index);
    const field = element.dataset.field;
    let value = element.value;

    if (["width", "weightPerYard", "kg", "yards"].includes(field)) {
      value = value === "" ? 0 : Number(value);
    }

    if (["featuredOnHome", "isPrintingFabric"].includes(field)) {
      value = value === "true";
    }

    next[index][field] = value;
  });

  next.forEach((item) => {
    if (item.isPrintingFabric) {
      item.category = "印花用布";
    } else if (item.category === "印花用布") {
      item.category = "現貨布";
    }

    if (item.kg && item.weightPerYard && !item.yards) {
      item.yards = yardsFromKg(item.kg, item.weightPerYard);
    } else if (item.yards && item.weightPerYard && !item.kg) {
      item.kg = kgFromYards(item.yards, item.weightPerYard);
    }

    item.image = item.featuredImage || item.image || "";
  });

  return next;
}

function clearAddForm() {
  newCodeEl.value = "";
  newCategoryEl.value = "現貨布";
  newIsPrintingFabricEl.value = "false";
  newFeaturedOnHomeEl.value = "false";
  newDisplayTitleEl.value = "";
  newFeaturedImageEl.value = "";
  newFabricTypeEl.value = "";
  newPatternEl.value = "";
  newCompositionEl.value = "";
  newWidthEl.value = "";
  newWeightEl.value = "";
  newKgEl.value = "";
  newYardsEl.value = "";
  newLocationEl.value = "";
  newStatusEl.value = "confirmed";
  newNoteEl.value = "";
}

function buildNewItem() {
  const code = newCodeEl.value.trim();
  const category = newCategoryEl.value;
  const isPrintingFabric = newIsPrintingFabricEl.value === "true" || category === "印花用布";
  const featuredOnHome = newFeaturedOnHomeEl.value === "true";
  const displayTitle = newDisplayTitleEl.value.trim();
  const featuredImage = newFeaturedImageEl.value.trim();
  const fabricType = newFabricTypeEl.value.trim();
  const pattern = newPatternEl.value.trim();
  const composition = newCompositionEl.value.trim();
  const width = Number(newWidthEl.value || 0);
  const weightPerYard = Number(newWeightEl.value || 0);
  let kg = Number(newKgEl.value || 0);
  let yards = Number(newYardsEl.value || 0);
  const location = newLocationEl.value.trim();
  const status = newStatusEl.value;
  const note = newNoteEl.value.trim();

  if (!code) {
    throw new Error("請先輸入編號。");
  }

  if (!weightPerYard) {
    throw new Error("請先輸入碼重。");
  }

  if (!kg && yards) {
    kg = kgFromYards(yards, weightPerYard);
  } else if (kg && !yards) {
    yards = yardsFromKg(kg, weightPerYard);
  }

  return normalizeItem({
    code,
    category: isPrintingFabric ? "印花用布" : category,
    isPrintingFabric,
    featuredOnHome,
    displayTitle,
    fabricType,
    pattern,
    composition,
    featuredImage,
    image: featuredImage,
    width,
    weightPerYard,
    kg,
    yards,
    location,
    status,
    note
  });
}

async function loadAdminInventory() {
  const response = await fetch("/api/inventory", { credentials: "include" });
  const data = await response.json();
  adminInventory = (data.items || []).map((item) => normalizeItem(item));
  renderAdminRows();
}

adminRowsEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-index]");
  if (!button) {
    return;
  }

  adminInventory = readFormData();
  adminInventory.splice(Number(button.dataset.deleteIndex), 1);
  renderAdminRows();
  adminMessageEl.textContent = "這筆資料已從畫面移除，記得按儲存全部變更。";
});

addButtonEl.addEventListener("click", () => {
  try {
    adminInventory = readFormData();
    const newItem = buildNewItem();

    if (adminInventory.some((item) => item.code === newItem.code)) {
      throw new Error("這個編號已存在，請直接在下方表格修改。");
    }

    adminInventory.unshift(newItem);
    clearAddForm();
    renderAdminRows();
    adminMessageEl.textContent = "已加入新資料，記得按儲存全部變更。";
  } catch (error) {
    adminMessageEl.textContent = error.message;
  }
});

clearFormButtonEl.addEventListener("click", () => {
  clearAddForm();
  adminMessageEl.textContent = "新增表單已清空。";
});

saveButtonEl.addEventListener("click", async () => {
  adminInventory = readFormData();

  const response = await fetch("/api/admin/inventory", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ items: adminInventory })
  });

  const data = await response.json();
  adminMessageEl.textContent = response.ok ? "已儲存全部變更。" : (data.message || "儲存失敗。");
});

resetButtonEl.addEventListener("click", async () => {
  await loadAdminInventory();
  adminMessageEl.textContent = "已重新載入最新資料。";
});

document.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-filter-toggle]");
  const filterSelect = event.target.closest("[data-filter-key]");

  if (toggle) {
    const targetKey = toggle.dataset.filterToggle;
    document.querySelectorAll("[data-filter-menu]").forEach((menu) => {
      const shouldOpen = menu.dataset.filterMenu === targetKey && menu.hidden;
      menu.hidden = !shouldOpen;
    });
    return;
  }

  if (filterSelect) {
    return;
  }

  document.querySelectorAll("[data-filter-menu]").forEach((menu) => {
    menu.hidden = true;
  });
});

document.addEventListener("change", (event) => {
  const filterSelect = event.target.closest("[data-filter-key]");
  if (!filterSelect) {
    return;
  }

  adminInventory = readFormData();
  adminFilters[filterSelect.dataset.filterKey] = filterSelect.value;
  renderAdminRows();
});

populateCategorySelect(newCategoryEl);
loadAdminInventory();
