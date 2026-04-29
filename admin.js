const CATEGORY_OPTIONS = [
  "印花用布",
  "針織布",
  "平織布",
  "彈性布",
  "網布",
  "刷毛布",
  "尼龍布",
  "單面布",
  "雙面布",
  "吸排布",
  "魚鱗布",
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
const newFeaturedOrderEl = document.getElementById("newFeaturedOrder");
const newDisplayTitleEl = document.getElementById("newDisplayTitle");
const newFeaturedImageEl = document.getElementById("newFeaturedImage");
const newFeaturedImageFileEl = document.getElementById("newFeaturedImageFile");
const newFeaturedImagePreviewEl = document.getElementById("newFeaturedImagePreview");
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

function updateImagePreview(previewEl, url) {
  if (!previewEl) {
    return;
  }

  const imageUrl = String(url || "").trim();
  previewEl.classList.toggle("is-empty", !imageUrl);
  previewEl.style.backgroundImage = imageUrl ? `url("${imageUrl.replaceAll('"', "%22")}")` : "";
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",").pop() : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Unable to read image."));
    reader.readAsDataURL(file);
  });
}

async function uploadImageFile(file, code = "") {
  if (!file) {
    return "";
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("請選擇圖片檔。");
  }

  const response = await fetch("/api/admin/upload-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      code,
      mimeType: file.type,
      data: await fileToBase64(file)
    })
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "圖片上傳失敗。");
  }
  return data.url;
}

function normalizeItem(item = {}) {
  const category = item.category || (item.isPrintingFabric ? "印花用布" : "其他布料");
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
    featuredOrder: Number(item.featuredOrder || 0),
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
  selectEl.innerHTML = buildCategoryOptions("其他布料");
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

function applyAdminHeaderLabels() {
  const textMap = {
    category: "布料種類",
    isPrintingFabric: "印花用布",
    featuredOnHome: "首頁精選",
    fabricType: "布種",
    pattern: "顏色",
    composition: "成份",
    status: "狀態"
  };

  const plainLabels = [
    "編號 / 縮圖",
    null,
    null,
    null,
    "顯示名稱",
    null,
    null,
    null,
    "圖片",
    "幅寬",
    "碼重",
    "公斤數",
    "碼數",
    "庫位",
    null,
    "備註",
    "操作"
  ];

  document.querySelectorAll(".admin-table thead th").forEach((cell, index) => {
    const filterButton = cell.querySelector("[data-filter-toggle]");
    if (filterButton) {
      filterButton.textContent = textMap[filterButton.dataset.filterToggle] || filterButton.textContent;
    } else if (plainLabels[index]) {
      cell.textContent = plainLabels[index];
    }
  });

  document.querySelectorAll(".admin-filter-label").forEach((label) => {
    const select = label.querySelector("select");
    if (!select) return;
    const firstOption = select.querySelector("option[value='']");
    label.childNodes[0].nodeValue = "篩選";
    if (firstOption) {
      firstOption.textContent = "全部";
    }
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
  applyAdminHeaderLabels();
  renderHeaderFilters();
  updateFilterSummary();

  adminRowsEl.innerHTML = filteredIndexes.map((realIndex) => {
    const item = adminInventory[realIndex];
    const thumbnailUrl = item.featuredImage || item.image || "";
    const imageCell = `
      <div class="admin-image-editor">
        <span class="image-upload-preview${thumbnailUrl ? "" : " is-empty"}" data-image-preview="${realIndex}"${thumbnailUrl ? ` style="background-image:url('${escapeAttribute(thumbnailUrl)}')"` : ""}></span>
        <input data-index="${realIndex}" data-field="featuredImage" type="text" value="${escapeAttribute(item.featuredImage)}" placeholder="/assets/uploads/...">
        <input class="admin-image-file" data-image-file-index="${realIndex}" type="file" accept="image/*">
      </div>
    `;
    const codeCell = `
      <div class="admin-code-cell">
        <div class="admin-code-thumb${thumbnailUrl ? "" : " is-empty"}"${thumbnailUrl ? ` style="background-image:url('${escapeAttribute(thumbnailUrl)}')"` : ""}></div>
        <div class="admin-code-text">${escapeHtml(item.code)}</div>
      </div>
    `;
    return `
      <tr>
        <td>${codeCell}</td>
        <td><select data-index="${realIndex}" data-field="category">${buildCategoryOptions(item.category)}</select></td>
        <td><select data-index="${realIndex}" data-field="isPrintingFabric">${buildBooleanOptions(item.isPrintingFabric)}</select></td>
        <td><select data-index="${realIndex}" data-field="featuredOnHome">${buildBooleanOptions(item.featuredOnHome)}</select></td>
        <td><input data-index="${realIndex}" data-field="featuredOrder" type="number" min="0" step="1" value="${item.featuredOrder || ""}" placeholder="1"></td>
        <td><input data-index="${realIndex}" data-field="displayTitle" type="text" value="${escapeAttribute(item.displayTitle)}"></td>
        <td><input data-index="${realIndex}" data-field="fabricType" type="text" list="fabricTypeOptions" value="${escapeAttribute(item.fabricType)}"></td>
        <td><input data-index="${realIndex}" data-field="pattern" type="text" list="patternOptions" value="${escapeAttribute(item.pattern)}"></td>
        <td><input data-index="${realIndex}" data-field="composition" type="text" list="compositionOptions" value="${escapeAttribute(item.composition)}"></td>
        <td>${imageCell}</td>
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

    if (["featuredOrder", "width", "weightPerYard", "kg", "yards"].includes(field)) {
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
      item.category = "其他布料";
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
  newCategoryEl.value = "其他布料";
  newIsPrintingFabricEl.value = "false";
  newFeaturedOnHomeEl.value = "false";
  newFeaturedOrderEl.value = "";
  newDisplayTitleEl.value = "";
  newFeaturedImageEl.value = "";
  if (newFeaturedImageFileEl) {
    newFeaturedImageFileEl.value = "";
  }
  updateImagePreview(newFeaturedImagePreviewEl, "");
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
  const featuredOrder = Number(newFeaturedOrderEl.value || 0);
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
    featuredOrder,
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

adminRowsEl.addEventListener("input", (event) => {
  const input = event.target.closest("[data-field='featuredImage']");
  if (!input) {
    return;
  }

  const index = Number(input.dataset.index);
  updateImagePreview(document.querySelector(`[data-image-preview="${index}"]`), input.value);
});

adminRowsEl.addEventListener("change", async (event) => {
  const input = event.target.closest("[data-image-file-index]");
  if (!input || !input.files?.[0]) {
    return;
  }

  try {
    adminInventory = readFormData();
    const index = Number(input.dataset.imageFileIndex);
    const item = adminInventory[index] || {};
    adminMessageEl.textContent = "圖片上傳中...";
    const url = await uploadImageFile(input.files[0], item.code);
    item.featuredImage = url;
    item.image = url;
    renderAdminRows();
    adminMessageEl.textContent = "圖片已更新，記得按儲存全部變更。";
  } catch (error) {
    adminMessageEl.textContent = error.message;
  } finally {
    input.value = "";
  }
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

newFeaturedImageEl.addEventListener("input", () => {
  updateImagePreview(newFeaturedImagePreviewEl, newFeaturedImageEl.value);
});

newFeaturedImageFileEl?.addEventListener("change", async () => {
  if (!newFeaturedImageFileEl.files?.[0]) {
    return;
  }

  try {
    adminMessageEl.textContent = "圖片上傳中...";
    const url = await uploadImageFile(newFeaturedImageFileEl.files[0], newCodeEl.value.trim());
    newFeaturedImageEl.value = url;
    updateImagePreview(newFeaturedImagePreviewEl, url);
    adminMessageEl.textContent = "圖片已上傳，新增這筆布料時會使用這張圖。";
  } catch (error) {
    adminMessageEl.textContent = error.message;
  } finally {
    newFeaturedImageFileEl.value = "";
  }
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
applyAdminHeaderLabels();
loadAdminInventory();
