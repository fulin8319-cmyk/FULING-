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
const analyticsTodayViewsEl = document.getElementById("analyticsTodayViews");
const analyticsTodayVisitorsEl = document.getElementById("analyticsTodayVisitors");
const analyticsWeekViewsEl = document.getElementById("analyticsWeekViews");
const analyticsWeekVisitorsEl = document.getElementById("analyticsWeekVisitors");
const analyticsDaysEl = document.getElementById("analyticsDays");
const analyticsPagesEl = document.getElementById("analyticsPages");
const featuredEditorListEl = document.getElementById("featuredEditorList");
const saveFeaturedButtonEl = document.getElementById("saveFeaturedButton");
const reloadFeaturedButtonEl = document.getElementById("reloadFeaturedButton");
const featuredEditorMessageEl = document.getElementById("featuredEditorMessage");
const socialSchedulerLinkEl = document.getElementById("socialSchedulerLink");

const newCodeEl = document.getElementById("newCode");
const newCategoryEl = document.getElementById("newCategory");
const newIsPrintingFabricEl = document.getElementById("newIsPrintingFabric");
const newFeaturedOnHomeEl = document.getElementById("newFeaturedOnHome");
const newFeaturedOrderEl = document.getElementById("newFeaturedOrder");
const newDisplayTitleEl = document.getElementById("newDisplayTitle");
const newFeaturedImageEl = document.getElementById("newFeaturedImage");
const newFeaturedImageFileEl = document.getElementById("newFeaturedImageFile");
const newFeaturedImagePreviewEl = document.getElementById("newFeaturedImagePreview");
const newStoredImagesEl = document.getElementById("newStoredImages");
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
let editingExistingIndex = -1;
let editingLoadedCode = "";
let codeLookupTimer = 0;
let addFormImages = [];

if (socialSchedulerLinkEl) {
  socialSchedulerLinkEl.addEventListener("click", (event) => {
    event.preventDefault();
    window.open(socialSchedulerLinkEl.href, "_blank", "noopener,noreferrer");
  });
}

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

function uniqueImages(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function collectItemImages(item = {}) {
  return uniqueImages([
    ...(Array.isArray(item.images) ? item.images : []),
    item.featuredImage,
    item.image,
    item.imagePrimary,
    item.imageSecondary
  ]);
}

function syncAddFormMainImage() {
  const currentMain = String(newFeaturedImageEl.value || "").trim();
  addFormImages = uniqueImages([currentMain, ...addFormImages]);
  if (!currentMain && addFormImages[0]) {
    newFeaturedImageEl.value = addFormImages[0];
    updateImagePreview(newFeaturedImagePreviewEl, addFormImages[0]);
  }
}

function renderStoredImages() {
  if (!newStoredImagesEl) {
    return;
  }

  syncAddFormMainImage();
  const mainImage = String(newFeaturedImageEl.value || "").trim();
  newStoredImagesEl.classList.toggle("is-empty", addFormImages.length === 0);

  if (!addFormImages.length) {
    newStoredImagesEl.innerHTML = '<span class="muted-text">輸入既有編號後會顯示已上傳照片。</span>';
    return;
  }

  newStoredImagesEl.innerHTML = addFormImages.map((src, index) => `
    <div class="admin-stored-image">
      <span class="admin-stored-thumb" style="background-image:url('${escapeAttribute(src)}')"></span>
      <div class="admin-stored-image-actions">
        <span>${index + 1}${src === mainImage ? "・主圖" : ""}</span>
        <button type="button" class="secondary-button" data-set-main-image="${escapeAttribute(src)}">設為主圖</button>
        <button type="button" class="secondary-button" data-remove-image="${escapeAttribute(src)}">移除</button>
      </div>
    </div>
  `).join("");
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

async function uploadImageFiles(files, code = "") {
  const selectedFiles = Array.from(files || []);
  const urls = [];
  for (const file of selectedFiles) {
    urls.push(await uploadImageFile(file, code));
  }
  return urls;
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
    images: collectItemImages(item),
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

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-TW");
}

function renderAnalyticsList(target, rows, emptyText, rowRenderer) {
  if (!target) {
    return;
  }

  if (!rows.length) {
    target.innerHTML = `<div class="analytics-row is-empty">${emptyText}</div>`;
    return;
  }

  target.innerHTML = rows.map(rowRenderer).join("");
}

async function loadAnalytics() {
  if (!analyticsTodayViewsEl) {
    return;
  }

  try {
    const response = await fetch("/api/admin/analytics", { credentials: "include" });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || "統計資料載入失敗。");
    }

    const analytics = data.analytics || {};
    analyticsTodayViewsEl.textContent = formatNumber(analytics.today?.pageViews);
    analyticsTodayVisitorsEl.textContent = formatNumber(analytics.today?.visitors);
    analyticsWeekViewsEl.textContent = formatNumber(analytics.last7?.pageViews);
    analyticsWeekVisitorsEl.textContent = formatNumber(analytics.last7?.visitors);

    renderAnalyticsList(
      analyticsDaysEl,
      analytics.recentDays || [],
      "目前還沒有瀏覽紀錄。",
      (day) => `
        <div class="analytics-row">
          <strong>${escapeHtml(day.date)}</strong>
          <span>${formatNumber(day.pageViews)} 次瀏覽 / ${formatNumber(day.visitors)} 位訪客</span>
        </div>
      `
    );

    renderAnalyticsList(
      analyticsPagesEl,
      analytics.topPages || [],
      "目前還沒有熱門頁面資料。",
      (page) => `
        <div class="analytics-row">
          <strong>${escapeHtml(page.title)}</strong>
          <span>${formatNumber(page.pageViews)} 次瀏覽 / ${formatNumber(page.visitors)} 位訪客</span>
        </div>
      `
    );
  } catch (error) {
    if (analyticsDaysEl) {
      analyticsDaysEl.innerHTML = `<div class="analytics-row is-empty">${escapeHtml(error.message)}</div>`;
    }
    if (analyticsPagesEl) {
      analyticsPagesEl.innerHTML = `<div class="analytics-row is-empty">請稍後再試。</div>`;
    }
  }
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

function getFeaturedIndexes() {
  return adminInventory
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.featuredOnHome === true)
    .sort((a, b) =>
      Number(a.item.featuredOrder || 0) - Number(b.item.featuredOrder || 0) ||
      String(a.item.code || "").localeCompare(String(b.item.code || ""), "zh-Hant")
    )
    .map(({ index }) => index);
}

function renderFeaturedEditor() {
  if (!featuredEditorListEl) {
    return;
  }

  const featuredIndexes = getFeaturedIndexes();
  if (!featuredIndexes.length) {
    featuredEditorListEl.innerHTML = '<div class="muted-text">目前沒有主力布料。請先到下方表格把某筆「主力布料」改成「是」，再按儲存。</div>';
    return;
  }

  featuredEditorListEl.innerHTML = featuredIndexes.map((realIndex) => {
    const item = adminInventory[realIndex];
    const thumbnailUrl = item.featuredImage || item.image || "";
    return `
      <article class="featured-editor-card" data-featured-card="${realIndex}">
        <div class="featured-editor-preview">
          <span class="image-upload-preview${thumbnailUrl ? "" : " is-empty"}" data-featured-image-preview="${realIndex}"${thumbnailUrl ? ` style="background-image:url('${escapeAttribute(thumbnailUrl)}')"` : ""}></span>
          <strong>${escapeHtml(item.code)}</strong>
          <span>${escapeHtml(item.displayTitle || item.name || "未命名布料")}</span>
        </div>
        <div class="featured-editor-grid">
          <label class="field">展示順序<input data-featured-index="${realIndex}" data-featured-field="featuredOrder" type="number" min="0" step="1" value="${item.featuredOrder || ""}" placeholder="1"></label>
          <label class="field">顯示名稱<input data-featured-index="${realIndex}" data-featured-field="displayTitle" type="text" value="${escapeAttribute(item.displayTitle)}"></label>
          <label class="field">布種<input data-featured-index="${realIndex}" data-featured-field="fabricType" type="text" list="fabricTypeOptions" value="${escapeAttribute(item.fabricType)}"></label>
          <label class="field">顏色<input data-featured-index="${realIndex}" data-featured-field="pattern" type="text" list="patternOptions" value="${escapeAttribute(item.pattern)}"></label>
          <label class="field">成份<input data-featured-index="${realIndex}" data-featured-field="composition" type="text" list="compositionOptions" value="${escapeAttribute(item.composition)}"></label>
          <label class="field">圖片<input data-featured-index="${realIndex}" data-featured-field="featuredImage" type="text" value="${escapeAttribute(item.featuredImage)}" placeholder="/assets/uploads/..."></label>
          <label class="field image-upload-field">上傳圖片<input data-featured-image-file-index="${realIndex}" type="file" accept="image/*" multiple><span class="image-upload-hint">可一次選多張，第一張會自動設為這款主圖。</span></label>
          <label class="field">幅寬<input data-featured-index="${realIndex}" data-featured-field="width" type="number" value="${item.width || ""}"></label>
          <label class="field">碼重<input data-featured-index="${realIndex}" data-featured-field="weightPerYard" type="number" value="${item.weightPerYard || ""}"></label>
          <label class="field">公斤數<input data-featured-index="${realIndex}" data-featured-field="kg" type="number" step="0.1" value="${item.kg || ""}"></label>
          <label class="field">碼數<input data-featured-index="${realIndex}" data-featured-field="yards" type="number" step="0.1" value="${item.yards || ""}"></label>
          <label class="field">備註<input data-featured-index="${realIndex}" data-featured-field="note" type="text" value="${escapeAttribute(item.note)}"></label>
        </div>
        <div class="featured-editor-actions">
          <button class="secondary-button" type="button" data-unfeature-index="${realIndex}">從主力布料移除</button>
          <button class="secondary-button" type="button" data-scroll-row-index="${realIndex}">到完整表格查看</button>
        </div>
      </article>
    `;
  }).join("");
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
    featuredOnHome: "主力布料",
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
    featuredOnHome: "主力布料",
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
  renderFeaturedEditor();

  adminRowsEl.innerHTML = filteredIndexes.map((realIndex) => {
    const item = adminInventory[realIndex];
    const thumbnailUrl = item.featuredImage || item.image || "";
    const imageCell = `
      <div class="admin-image-editor">
        <span class="image-upload-preview${thumbnailUrl ? "" : " is-empty"}" data-image-preview="${realIndex}"${thumbnailUrl ? ` style="background-image:url('${escapeAttribute(thumbnailUrl)}')"` : ""}></span>
        <input data-index="${realIndex}" data-field="featuredImage" type="text" value="${escapeAttribute(item.featuredImage)}" placeholder="/assets/uploads/...">
        <input class="admin-image-file" data-image-file-index="${realIndex}" type="file" accept="image/*" multiple>
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

function applyFeaturedEditorData(items = adminInventory) {
  document.querySelectorAll("[data-featured-index][data-featured-field]").forEach((element) => {
    const index = Number(element.dataset.featuredIndex);
    const field = element.dataset.featuredField;
    if (!items[index]) {
      return;
    }

    let value = element.value;
    if (["featuredOrder", "width", "weightPerYard", "kg", "yards"].includes(field)) {
      value = value === "" ? 0 : Number(value);
    }

    items[index][field] = value;
    if (field === "featuredImage") {
      items[index].image = value || items[index].image || "";
      items[index].images = uniqueImages([value, ...collectItemImages(items[index])]);
    }
  });

  items.forEach((item) => {
    if (item.kg && item.weightPerYard && !item.yards) {
      item.yards = yardsFromKg(item.kg, item.weightPerYard);
    } else if (item.yards && item.weightPerYard && !item.kg) {
      item.kg = kgFromYards(item.yards, item.weightPerYard);
    }
  });

  return items;
}

async function saveInventoryItems(messageEl, successMessage) {
  adminInventory = applyFeaturedEditorData(readFormData()).map((item) => normalizeItem(item));

  const response = await fetch("/api/admin/inventory", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ items: adminInventory })
  });

  const data = await response.json();
  const message = response.ok ? successMessage : (data.message || "儲存失敗。");
  if (messageEl) {
    messageEl.textContent = message;
  }
  if (messageEl !== adminMessageEl && adminMessageEl) {
    adminMessageEl.textContent = message;
  }
  renderAdminRows();
  return response.ok;
}

function clearAddForm() {
  editingExistingIndex = -1;
  editingLoadedCode = "";
  addFormImages = [];
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
  renderStoredImages();
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
  updateAddFormMode();
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
  const images = uniqueImages([featuredImage, ...addFormImages]);

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
    images,
    width,
    weightPerYard,
    kg,
    yards,
    location,
    status,
    note
  });
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function findInventoryIndexByCode(code) {
  const target = normalizeCode(code);
  if (!target) {
    return -1;
  }
  return adminInventory.findIndex((item) => normalizeCode(item.code) === target);
}

function setSelectValue(selectEl, value, fallback) {
  const nextValue = value || fallback || "";
  selectEl.value = nextValue;
  if (selectEl.value !== nextValue && fallback) {
    selectEl.value = fallback;
  }
}

function updateAddFormMode() {
  const isEditing = editingExistingIndex >= 0;
  addButtonEl.textContent = isEditing ? "更新這筆布料" : "新增這筆布料";
  addButtonEl.dataset.mode = isEditing ? "update" : "add";
}

function fillAddFormFromItem(item) {
  const normalized = normalizeItem(item);
  newCodeEl.value = normalized.code;
  setSelectValue(newCategoryEl, normalized.category, "其他布料");
  newIsPrintingFabricEl.value = String(Boolean(normalized.isPrintingFabric));
  newFeaturedOnHomeEl.value = String(Boolean(normalized.featuredOnHome));
  newFeaturedOrderEl.value = normalized.featuredOrder || "";
  newDisplayTitleEl.value = normalized.displayTitle || "";
  newFeaturedImageEl.value = normalized.featuredImage || normalized.image || "";
  addFormImages = collectItemImages(normalized);
  if (newFeaturedImageFileEl) {
    newFeaturedImageFileEl.value = "";
  }
  updateImagePreview(newFeaturedImagePreviewEl, newFeaturedImageEl.value);
  renderStoredImages();
  newFabricTypeEl.value = normalized.fabricType || "";
  newPatternEl.value = normalized.pattern || "";
  newCompositionEl.value = normalized.composition || "";
  newWidthEl.value = normalized.width || "";
  newWeightEl.value = normalized.weightPerYard || "";
  newKgEl.value = normalized.kg || "";
  newYardsEl.value = normalized.yards || "";
  newLocationEl.value = normalized.location || "";
  setSelectValue(newStatusEl, normalized.status, "confirmed");
  newNoteEl.value = normalized.note || "";
}

function loadExistingItemIntoAddForm({ silent = false } = {}) {
  const code = newCodeEl.value.trim();
  const foundIndex = findInventoryIndexByCode(code);

  if (foundIndex < 0) {
    editingExistingIndex = -1;
    editingLoadedCode = "";
    updateAddFormMode();
    return;
  }

  const normalizedCode = normalizeCode(code);
  if (editingExistingIndex === foundIndex && editingLoadedCode === normalizedCode) {
    return;
  }

  editingExistingIndex = foundIndex;
  editingLoadedCode = normalizedCode;
  fillAddFormFromItem(adminInventory[foundIndex]);
  updateAddFormMode();
  if (!silent) {
    adminMessageEl.textContent = `已帶入 ${adminInventory[foundIndex].code}，修改後按「更新這筆布料」。`;
  }
}

async function loadAdminInventory() {
  const response = await fetch("/api/inventory", { credentials: "include" });
  const data = await response.json();
  adminInventory = (data.items || []).map((item) => normalizeItem(item));
  renderAdminRows();
  updateAddFormMode();
}

featuredEditorListEl?.addEventListener("input", (event) => {
  const input = event.target.closest("[data-featured-field='featuredImage']");
  if (!input) {
    return;
  }

  const index = Number(input.dataset.featuredIndex);
  updateImagePreview(document.querySelector(`[data-featured-image-preview="${index}"]`), input.value);
});

featuredEditorListEl?.addEventListener("change", async (event) => {
  const input = event.target.closest("[data-featured-image-file-index]");
  const files = Array.from(input?.files || []);
  if (!input || !files.length) {
    return;
  }

  try {
    adminInventory = applyFeaturedEditorData(readFormData());
    const index = Number(input.dataset.featuredImageFileIndex);
    const item = adminInventory[index] || {};
    featuredEditorMessageEl.textContent = `主力布料圖片上傳中...共 ${files.length} 張`;
    const urls = await uploadImageFiles(files, item.code);
    const mainUrl = urls[0];
    item.featuredImage = mainUrl;
    item.image = mainUrl;
    item.images = uniqueImages([...urls, ...collectItemImages(item)]);
    renderAdminRows();
    featuredEditorMessageEl.textContent = `已上傳 ${urls.length} 張圖片，記得按「儲存主力布料變更」。`;
  } catch (error) {
    featuredEditorMessageEl.textContent = error.message;
  } finally {
    input.value = "";
  }
});

featuredEditorListEl?.addEventListener("click", (event) => {
  const unfeatureButton = event.target.closest("[data-unfeature-index]");
  const scrollButton = event.target.closest("[data-scroll-row-index]");

  if (unfeatureButton) {
    adminInventory = applyFeaturedEditorData(readFormData());
    const index = Number(unfeatureButton.dataset.unfeatureIndex);
    if (adminInventory[index]) {
      adminInventory[index].featuredOnHome = false;
      renderAdminRows();
      featuredEditorMessageEl.textContent = "已從主力布料移除，記得按「儲存主力布料變更」。";
    }
    return;
  }

  if (scrollButton) {
    const index = Number(scrollButton.dataset.scrollRowIndex);
    const rowField = document.querySelector(`[data-index="${index}"][data-field="displayTitle"]`);
    rowField?.scrollIntoView({ behavior: "smooth", block: "center" });
    rowField?.focus();
  }
});

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

newStoredImagesEl?.addEventListener("click", (event) => {
  const setMainButton = event.target.closest("[data-set-main-image]");
  const removeButton = event.target.closest("[data-remove-image]");

  if (setMainButton) {
    const src = setMainButton.dataset.setMainImage;
    newFeaturedImageEl.value = src;
    updateImagePreview(newFeaturedImagePreviewEl, src);
    renderStoredImages();
    return;
  }

  if (removeButton) {
    const src = removeButton.dataset.removeImage;
    addFormImages = addFormImages.filter((image) => image !== src);
    if (newFeaturedImageEl.value.trim() === src) {
      newFeaturedImageEl.value = addFormImages[0] || "";
      updateImagePreview(newFeaturedImagePreviewEl, newFeaturedImageEl.value);
    }
    renderStoredImages();
  }
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
  const files = Array.from(input?.files || []);
  if (!input || !files.length) {
    return;
  }

  try {
    adminInventory = readFormData();
    const index = Number(input.dataset.imageFileIndex);
    const item = adminInventory[index] || {};
    adminMessageEl.textContent = `圖片上傳中...共 ${files.length} 張`;
    const urls = await uploadImageFiles(files, item.code);
    const mainUrl = urls[0];
    item.featuredImage = mainUrl;
    item.image = mainUrl;
    item.images = uniqueImages([...urls, ...collectItemImages(item)]);
    renderAdminRows();
    adminMessageEl.textContent = `已上傳 ${urls.length} 張圖片，記得按儲存全部變更。`;
  } catch (error) {
    adminMessageEl.textContent = error.message;
  } finally {
    input.value = "";
  }
});

addButtonEl.addEventListener("click", () => {
  try {
    adminInventory = readFormData();
    const typedCode = newCodeEl.value.trim();
    const preExistingIndex = findInventoryIndexByCode(typedCode);
    if (
      preExistingIndex >= 0 &&
      (editingExistingIndex !== preExistingIndex || editingLoadedCode !== normalizeCode(typedCode))
    ) {
      editingExistingIndex = preExistingIndex;
      editingLoadedCode = normalizeCode(typedCode);
      fillAddFormFromItem(adminInventory[preExistingIndex]);
      updateAddFormMode();
      adminMessageEl.textContent = `已先帶入 ${adminInventory[preExistingIndex].code} 的資料，確認修改後再按「更新這筆布料」。`;
      return;
    }

    const newItem = buildNewItem();
    const existingIndex = findInventoryIndexByCode(newItem.code);

    if (existingIndex >= 0) {
      adminInventory[existingIndex] = normalizeItem({
        ...adminInventory[existingIndex],
        ...newItem,
        code: adminInventory[existingIndex].code || newItem.code
      });
      editingExistingIndex = existingIndex;
      editingLoadedCode = normalizeCode(newItem.code);
      renderAdminRows();
      updateAddFormMode();
      adminMessageEl.textContent = "已更新這筆布料，記得按「儲存全部變更」。";
      return;
    }

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
  addFormImages = uniqueImages([newFeaturedImageEl.value, ...addFormImages]);
  renderStoredImages();
});

newCodeEl.addEventListener("input", () => {
  clearTimeout(codeLookupTimer);
  codeLookupTimer = setTimeout(() => loadExistingItemIntoAddForm(), 250);
});

newCodeEl.addEventListener("change", () => {
  clearTimeout(codeLookupTimer);
  loadExistingItemIntoAddForm();
});

newFeaturedImageFileEl?.addEventListener("change", async () => {
  const files = Array.from(newFeaturedImageFileEl.files || []);
  if (!files.length) {
    return;
  }

  try {
    adminMessageEl.textContent = `圖片上傳中...共 ${files.length} 張`;
    const urls = await uploadImageFiles(files, newCodeEl.value.trim());
    const mainUrl = urls[0];
    newFeaturedImageEl.value = mainUrl;
    addFormImages = uniqueImages([...urls, ...addFormImages]);
    updateImagePreview(newFeaturedImagePreviewEl, mainUrl);
    renderStoredImages();
    adminMessageEl.textContent = `已上傳 ${urls.length} 張圖片，新增或更新這筆布料時會一起保存。`;
  } catch (error) {
    adminMessageEl.textContent = error.message;
  } finally {
    newFeaturedImageFileEl.value = "";
  }
});

saveButtonEl.addEventListener("click", async () => {
  await saveInventoryItems(adminMessageEl, "已儲存全部變更。");
});

resetButtonEl.addEventListener("click", async () => {
  await loadAdminInventory();
  adminMessageEl.textContent = "已重新載入最新資料。";
});

saveFeaturedButtonEl?.addEventListener("click", async () => {
  await saveInventoryItems(featuredEditorMessageEl, "已儲存主力布料變更到雲端。");
});

reloadFeaturedButtonEl?.addEventListener("click", async () => {
  await loadAdminInventory();
  featuredEditorMessageEl.textContent = "已重新載入主力布料。";
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
loadAnalytics();
loadAdminInventory();
