const adminRowsEl = document.getElementById("adminRows");
const adminMessageEl = document.getElementById("adminMessage");
const saveButtonEl = document.getElementById("saveInventoryButton");
const resetButtonEl = document.getElementById("resetInventoryButton");
const addButtonEl = document.getElementById("addInventoryButton");
const clearFormButtonEl = document.getElementById("clearInventoryFormButton");

const newCodeEl = document.getElementById("newCode");
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

function renderAdminRows() {
  adminRowsEl.innerHTML = adminInventory.map((item, index) => `
    <tr>
      <td>${escapeHtml(item.code || "")}</td>
      <td><input data-index="${index}" data-field="width" type="number" value="${item.width || ""}"></td>
      <td><input data-index="${index}" data-field="weightPerYard" type="number" value="${item.weightPerYard || ""}"></td>
      <td><input data-index="${index}" data-field="kg" type="number" step="0.1" value="${item.kg || ""}"></td>
      <td><input data-index="${index}" data-field="yards" type="number" step="0.1" value="${item.yards || ""}"></td>
      <td><input data-index="${index}" data-field="location" type="text" value="${escapeHtml(item.location || "")}"></td>
      <td>
        <select data-index="${index}" data-field="status">
          <option value="confirmed" ${item.status === "confirmed" ? "selected" : ""}>現貨中</option>
          <option value="sold" ${item.status === "sold" ? "selected" : ""}>已售出</option>
          <option value="review" ${item.status === "review" ? "selected" : ""}>待確認</option>
          <option value="reserved" ${item.status === "reserved" ? "selected" : ""}>保留中</option>
        </select>
      </td>
      <td><input data-index="${index}" data-field="note" type="text" value="${escapeHtml(item.note || "")}"></td>
      <td><button class="secondary-button admin-delete-button" type="button" data-delete-index="${index}">刪除</button></td>
    </tr>
  `).join("");
}

function readFormData() {
  const next = JSON.parse(JSON.stringify(adminInventory));
  document.querySelectorAll("[data-index][data-field]").forEach((element) => {
    const index = Number(element.dataset.index);
    const field = element.dataset.field;
    let value = element.value;

    if (["width", "weightPerYard", "kg", "yards"].includes(field)) {
      value = value === "" ? 0 : Number(value);
    }

    next[index][field] = value;
  });

  next.forEach((item) => {
    if (item.kg && item.weightPerYard && !item.yards) {
      item.yards = yardsFromKg(item.kg, item.weightPerYard);
    } else if (item.yards && item.weightPerYard && !item.kg) {
      item.kg = kgFromYards(item.yards, item.weightPerYard);
    }
  });

  return next;
}

function clearAddForm() {
  newCodeEl.value = "";
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

  return {
    code,
    width,
    weightPerYard,
    kg,
    yards,
    location,
    side: "manual",
    status,
    note,
    image: ""
  };
}

async function loadAdminInventory() {
  const response = await fetch("/api/inventory", {
    credentials: "include"
  });
  const data = await response.json();
  adminInventory = data.items || [];
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
  adminMessageEl.textContent = "已刪除這筆，記得按儲存全部變更。";
});

addButtonEl.addEventListener("click", () => {
  try {
    adminInventory = readFormData();

    const newItem = buildNewItem();
    const exists = adminInventory.some((item) => item.code === newItem.code);
    if (exists) {
      throw new Error("這個編號已經存在。");
    }

    adminInventory.unshift(newItem);
    renderAdminRows();
    clearAddForm();
    adminMessageEl.textContent = "已新增一筆資料，記得按儲存全部變更。";
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
  adminMessageEl.textContent = response.ok ? "已儲存全部變更。" : (data.message || "儲存失敗。");
});

resetButtonEl.addEventListener("click", async () => {
  await loadAdminInventory();
  adminMessageEl.textContent = "已重新載入已儲存資料。";
});

loadAdminInventory();
