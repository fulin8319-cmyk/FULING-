const rollRowsEl = document.getElementById("rollRows");
const rollEntryFormEl = document.getElementById("rollEntryForm");
const addRollRowButtonEl = document.getElementById("addRollRowButton");
const clearRollFormButtonEl = document.getElementById("clearRollFormButton");
const clearPhotoButtonEl = document.getElementById("clearPhotoButton");
const rollEntryMessageEl = document.getElementById("rollEntryMessage");

const baseCodeEl = document.getElementById("baseCode");
const fabricNameEl = document.getElementById("fabricName");
const fabricTypeSelectEl = document.getElementById("fabricTypeSelect");
const fabricTypeCustomWrapEl = document.getElementById("fabricTypeCustomWrap");
const fabricTypeCustomEl = document.getElementById("fabricTypeCustom");
const patternEl = document.getElementById("pattern");
const compositionEl = document.getElementById("composition");
const widthEl = document.getElementById("width");
const weightPerYardEl = document.getElementById("weightPerYard");
const imageEl = document.getElementById("image");
const noteEl = document.getElementById("note");
const uploadedByEl = document.getElementById("uploadedBy");
const imageFileEl = document.getElementById("imageFile");
const photoPreviewEl = document.getElementById("photoPreview");
const photoHintEl = document.getElementById("photoHint");

let uploadedImageDataUrl = "";

function roundOne(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function yardsFromKg(kg, weightPerYard) {
  if (!kg || !weightPerYard) return 0;
  return roundOne((Number(kg) * 1000) / Number(weightPerYard));
}

function kgFromYards(yards, weightPerYard) {
  if (!yards || !weightPerYard) return 0;
  return roundOne((Number(yards) * Number(weightPerYard)) / 1000);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeBaseCode(value) {
  const raw = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return "";
  return raw.startsWith("A") ? raw : `A${raw}`;
}

function syncFabricTypeCustomVisibility() {
  const isCustom = fabricTypeSelectEl.value === "其他";
  fabricTypeCustomWrapEl.hidden = !isCustom;
  fabricTypeCustomEl.required = isCustom;

  if (!isCustom) {
    fabricTypeCustomEl.value = "";
  }
}

function getFabricTypeValue() {
  return fabricTypeSelectEl.value === "其他"
    ? fabricTypeCustomEl.value.trim()
    : fabricTypeSelectEl.value.trim();
}

function updatePhotoPreview(src) {
  uploadedImageDataUrl = src || "";

  if (uploadedImageDataUrl) {
    photoPreviewEl.src = uploadedImageDataUrl;
    photoPreviewEl.hidden = false;
    photoHintEl.textContent = "照片已載入，送出後會一起寫入庫存。";
    return;
  }

  photoPreviewEl.removeAttribute("src");
  photoPreviewEl.hidden = true;
  photoHintEl.textContent = "可以直接拍照或選擇照片，系統會先壓縮再上傳。";
}

function dataUrlSizeBytes(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  return Math.floor(base64.length * 0.75);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("無法讀取圖片，請改用 JPG 或 PNG。"));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error("讀取照片失敗，請重新選擇。"));
    reader.readAsDataURL(file);
  });
}

async function compressImageFile(file) {
  const image = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  const maxDimension = 1600;
  let { width, height } = image;

  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.86;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  while (dataUrlSizeBytes(dataUrl) > 1300 * 1024 && quality > 0.4) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  return dataUrl;
}

function createRollRow(values = {}) {
  const row = document.createElement("div");
  row.className = "roll-row";
  row.innerHTML = `
    <div class="roll-grid">
      <label class="field">
        支號
        <input type="text" data-roll-field="rollNo" placeholder="例如 1" value="${escapeHtml(values.rollNo || "")}">
      </label>
      <label class="field">
        公斤數
        <input type="number" step="0.1" data-roll-field="kg" placeholder="例如 12.5" value="${escapeHtml(values.kg || "")}">
      </label>
      <label class="field">
        碼數
        <input type="number" step="0.1" data-roll-field="yards" placeholder="例如 39.1" value="${escapeHtml(values.yards || "")}">
      </label>
      <label class="field">
        庫位
        <input type="text" data-roll-field="location" placeholder="例如 A-12" value="${escapeHtml(values.location || "")}">
      </label>
      <label class="field">
        狀態
        <select data-roll-field="status">
          <option value="confirmed" ${values.status === "confirmed" || !values.status ? "selected" : ""}>現貨中</option>
          <option value="reserved" ${values.status === "reserved" ? "selected" : ""}>保留中</option>
          <option value="sold" ${values.status === "sold" ? "selected" : ""}>已售出</option>
          <option value="review" ${values.status === "review" ? "selected" : ""}>待確認</option>
        </select>
      </label>
      <label class="field roll-note-field">
        單支備註
        <input type="text" data-roll-field="note" placeholder="例如 印花用 / 已對樣" value="${escapeHtml(values.note || "")}">
      </label>
    </div>
    <div class="roll-row-actions">
      <button class="secondary-button" type="button" data-remove-roll>刪除這支</button>
    </div>
  `;

  row.querySelector("[data-remove-roll]").addEventListener("click", () => {
    row.remove();
    if (!rollRowsEl.children.length) {
      rollRowsEl.appendChild(createRollRow({ rollNo: "1" }));
    }
  });

  return row;
}

function resetForm() {
  rollEntryFormEl.reset();
  widthEl.value = "60";
  rollRowsEl.innerHTML = "";
  rollRowsEl.appendChild(createRollRow({ rollNo: "1" }));
  updatePhotoPreview("");
  syncFabricTypeCustomVisibility();
  rollEntryMessageEl.textContent = "登入後即可在這裡新增同布號多支庫存。";
}

function collectRolls(weightPerYard) {
  return Array.from(rollRowsEl.querySelectorAll(".roll-row"))
    .map((row, index) => {
      const get = (name) => row.querySelector(`[data-roll-field="${name}"]`).value.trim();
      let kg = Number(get("kg") || 0);
      let yards = Number(get("yards") || 0);

      if (!yards && kg && weightPerYard) {
        yards = yardsFromKg(kg, weightPerYard);
      } else if (!kg && yards && weightPerYard) {
        kg = kgFromYards(yards, weightPerYard);
      }

      return {
        rollNo: get("rollNo") || String(index + 1),
        kg,
        yards,
        location: get("location"),
        status: get("status") || "confirmed",
        note: get("note")
      };
    })
    .filter((roll) => roll.kg || roll.yards || roll.location || roll.note);
}

addRollRowButtonEl.addEventListener("click", () => {
  rollRowsEl.appendChild(createRollRow({ rollNo: String(rollRowsEl.children.length + 1) }));
});

clearRollFormButtonEl.addEventListener("click", resetForm);

clearPhotoButtonEl.addEventListener("click", () => {
  imageFileEl.value = "";
  updatePhotoPreview("");
});

fabricTypeSelectEl.addEventListener("change", syncFabricTypeCustomVisibility);

imageFileEl.addEventListener("change", async () => {
  const [file] = imageFileEl.files || [];
  if (!file) {
    updatePhotoPreview("");
    return;
  }

  rollEntryMessageEl.textContent = "正在壓縮照片...";

  try {
    const compressed = await compressImageFile(file);
    updatePhotoPreview(compressed);
    rollEntryMessageEl.textContent = "照片已準備完成，可以送出入庫。";
  } catch (error) {
    updatePhotoPreview("");
    rollEntryMessageEl.textContent = error.message || "照片處理失敗，請重新嘗試。";
  }
});

rollEntryFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();

  const weightPerYard = Number(weightPerYardEl.value || 0);
  const payload = {
    code: normalizeBaseCode(baseCodeEl.value),
    name: fabricNameEl.value.trim(),
    fabricType: getFabricTypeValue(),
    pattern: patternEl.value.trim(),
    composition: compositionEl.value.trim(),
    width: Number(widthEl.value || 60),
    weightPerYard,
    image: uploadedImageDataUrl || imageEl.value.trim(),
    note: noteEl.value.trim(),
    uploadedBy: uploadedByEl.value.trim(),
    rolls: collectRolls(weightPerYard)
  };

  if (!payload.code) {
    rollEntryMessageEl.textContent = "請先輸入布號。";
    return;
  }

  if (!payload.fabricType) {
    rollEntryMessageEl.textContent = "請先選擇布種，若沒有可用選項可改用自訂。";
    return;
  }

  if (!payload.weightPerYard) {
    rollEntryMessageEl.textContent = "請先輸入碼重。";
    return;
  }

  if (!payload.rolls.length) {
    rollEntryMessageEl.textContent = "請至少填入一支庫存明細。";
    return;
  }

  rollEntryMessageEl.textContent = "正在送出入庫資料...";

  const response = await fetch("/api/admin/inventory-rolls", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    rollEntryMessageEl.textContent = data.message || "入庫失敗，請稍後再試。";
    return;
  }

  resetForm();
  rollEntryMessageEl.textContent = `已成功新增 ${data.imported} 支庫存，目前總筆數 ${data.total}。`;
});

resetForm();
