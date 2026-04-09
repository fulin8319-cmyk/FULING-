const CATEGORY_OPTIONS = [
  "印花用布",
  "現貨布",
  "針織布",
  "平織布",
  "彈性布",
  "網布",
  "刷毛布",
  "尼龍布",
  "聚酯布",
  "其他布料"
];

const adminRowsEl = document.getElementById("adminRows");
const adminMessageEl = document.getElementById("adminMessage");
const saveButtonEl = document.getElementById("saveInventoryButton");
const resetButtonEl = document.getElementById("resetInventoryButton");
const addButtonEl = document.getElementById("addInventoryButton");
const clearFormButtonEl = document.getElementById("clearInventoryFormButton");

const newCodeEl = document.getElementById("newCode");
const newCategoryEl = document.getElementById("newCategory");
const newIsPrintingFabricEl = document.getElementById("newIsPrintingFabric");
const newFeaturedOnHomeEl = document.getElementById("newFeaturedOnHome");
const newDisplayTitleEl = document.getElementById("newDisplayTitle");
const newUseTextEl = document.getElementById("newUseText");
const newDescriptionTextEl = document.getElementById("newDescriptionText");
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

let adminInventory = [];

function roundOne(value) {
  return Math.round(value * 10) / 10;
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

function buildCategoryOptions(selectedValue = "") {
  const options = new Set(CATEGORY_OPTIONS);
  if (selectedValue) {
    options.add(selectedValue);
  }
  return [...options]
    .map((value) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
}

function populateCategorySelect(selectEl) {
  selectEl.innerHTML = buildCategoryOptions("現貨布");
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
    useText: item.useText || "",
    descriptionText: item.descriptionText || "",
    featuredImage: item.featuredImage || item.image || "",
    fabricType: item.fabricType || "",
    pattern: item.pattern || "",
    composition: item.composition || "",
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

function renderAdminRows() {
  adminRowsEl.innerHTML = adminInventory.map((item, index) => `
    <tr>
      <td>${escapeHtml(item.code)}</td>
      <td>
        <select data-index="${index}" data-field="category">
          ${buildCategoryOptions(item.category)}
        </select>
      </td>
      <td>
        <select data-index="${index}" data-field="isPrintingFabric">
          <option value="true" ${item.isPrintingFabric ? "selected" : ""}>是</option>
          <option value="false" ${!item.isPrintingFabric ? "selected" : ""}>否</option>
        </select>
      </td>
      <td>
        <select data-index="${index}" data-field="featuredOnHome">
          <option value="true" ${item.featuredOnHome ? "selected" : ""}>是</option>
          <option value="false" ${!item.featuredOnHome ? "selected" : ""}>否</option>
        </select>
      </td>
      <td><input data-index="${index}" data-field="displayTitle" type="text" value="${escapeHtml(item.displayTitle)}"></td>
      <td><input data-index="${index}" data-field="fabricType" type="text" value="${escapeHtml(item.fabricType)}"></td>
      <td><input data-index="${index}" data-field="pattern" type="text" value="${escapeHtml(item.pattern)}"></td>
      <td><input data-index="${index}" data-field="composition" type="text" value="${escapeHtml(item.composition)}"></td>
      <td><input data-index="${index}" data-field="featuredImage" type="text" value="${escapeHtml(item.featuredImage)}"></td>
      <td><input data-index="${index}" data-field="width" type="number" value="${item.width || ""}"></td>
      <td><input data-index="${index}" data-field="weightPerYard" type="number" value="${item.weightPerYard || ""}"></td>
      <td><input data-index="${index}" data-field="kg" type="number" step="0.1" value="${item.kg || ""}"></td>
      <td><input data-index="${index}" data-field="yards" type="number" step="0.1" value="${item.yards || ""}"></td>
      <td><input data-index="${index}" data-field="location" type="text" value="${escapeHtml(item.location)}"></td>
      <td>
        <select data-index="${index}" data-field="status">
          <option value="confirmed" ${item.status === "confirmed" ? "selected" : ""}>現貨中</option>
          <option value="sold" ${item.status === "sold" ? "selected" : ""}>已售出</option>
          <option value="reserved" ${item.status === "reserved" ? "selected" : ""}>保留中</option>
          <option value="review" ${item.status === "review" ? "selected" : ""}>待確認</option>
        </select>
      </td>
      <td><input data-index="${index}" data-field="note" type="text" value="${escapeHtml(item.note)}"></td>
      <td><button class="secondary-button admin-delete-button" type="button" data-delete-index="${index}">刪除</button></td>
    </tr>
  `).join("");
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
    if (item.isPrintingFabric && item.category !== "印花用布") {
      item.category = "印花用布";
    } else if (!item.isPrintingFabric && item.category === "印花用布") {
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
  newUseTextEl.value = "";
  newDescriptionTextEl.value = "";
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
  const useText = newUseTextEl.value.trim();
  const descriptionText = newDescriptionTextEl.value.trim();
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
    useText,
    descriptionText,
    featuredImage,
    fabricType,
    pattern,
    composition,
    width,
    weightPerYard,
    kg,
    yards,
    location,
    status,
    note,
    image: featuredImage
  });
}

async function loadAdminInventory() {
  const response = await fetch("/api/inventory", {
    credentials: "include"
  });
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
  adminMessageEl.textContent = "這筆布料已從待儲存清單移除，記得按儲存全部變更。";
});

addButtonEl.addEventListener("click", () => {
  try {
    adminInventory = readFormData();
    const newItem = buildNewItem();
    const exists = adminInventory.some((item) => item.code === newItem.code);
    if (exists) {
      throw new Error("這個編號已存在，請直接在下方修改。");
    }

    adminInventory.unshift(newItem);
    renderAdminRows();
    clearAddForm();
    adminMessageEl.textContent = "新布料已加入清單，記得按儲存全部變更。";
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
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({ items: adminInventory })
  });

  const data = await response.json();
  adminMessageEl.textContent = response.ok ? "資料已成功儲存。" : (data.message || "儲存失敗。");
});

resetButtonEl.addEventListener("click", async () => {
  await loadAdminInventory();
  adminMessageEl.textContent = "已重新載入最新資料。";
});

populateCategorySelect(newCategoryEl);
loadAdminInventory();
