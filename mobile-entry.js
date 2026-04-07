const rollRowsEl = document.getElementById("rollRows");
const rollEntryFormEl = document.getElementById("rollEntryForm");
const addRollRowButtonEl = document.getElementById("addRollRowButton");
const clearRollFormButtonEl = document.getElementById("clearRollFormButton");
const rollEntryMessageEl = document.getElementById("rollEntryMessage");

const baseCodeEl = document.getElementById("baseCode");
const fabricNameEl = document.getElementById("fabricName");
const fabricTypeEl = document.getElementById("fabricType");
const patternEl = document.getElementById("pattern");
const compositionEl = document.getElementById("composition");
const widthEl = document.getElementById("width");
const weightPerYardEl = document.getElementById("weightPerYard");
const imageEl = document.getElementById("image");
const noteEl = document.getElementById("note");
const uploadedByEl = document.getElementById("uploadedBy");

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

function createRollRow(values = {}) {
  const row = document.createElement("div");
  row.className = "roll-row";
  row.innerHTML = `
    <div class="roll-grid">
      <label class="field">
        支號
        <input type="text" data-roll-field="rollNo" placeholder="例如 1" value="${values.rollNo || ""}">
      </label>
      <label class="field">
        公斤數
        <input type="number" step="0.1" data-roll-field="kg" placeholder="例如 12.5" value="${values.kg || ""}">
      </label>
      <label class="field">
        碼數
        <input type="number" step="0.1" data-roll-field="yards" placeholder="例如 39.1" value="${values.yards || ""}">
      </label>
      <label class="field">
        庫位
        <input type="text" data-roll-field="location" placeholder="例如 A-12" value="${values.location || ""}">
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
        <input type="text" data-roll-field="note" placeholder="例如 客戶保留 / 待確認" value="${values.note || ""}">
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
  rollRowsEl.innerHTML = "";
  rollRowsEl.appendChild(createRollRow({ rollNo: "1" }));
  rollEntryMessageEl.textContent = "表單已清空，可以開始輸入新的布號與多支庫存。";
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

rollEntryFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();

  const weightPerYard = Number(weightPerYardEl.value || 0);
  const payload = {
    code: baseCodeEl.value.trim(),
    name: fabricNameEl.value.trim(),
    fabricType: fabricTypeEl.value.trim(),
    pattern: patternEl.value.trim(),
    composition: compositionEl.value.trim(),
    width: Number(widthEl.value || 0),
    weightPerYard,
    image: imageEl.value.trim(),
    note: noteEl.value.trim(),
    uploadedBy: uploadedByEl.value.trim(),
    rolls: collectRolls(weightPerYard)
  };

  if (!payload.code) {
    rollEntryMessageEl.textContent = "請先填布號。";
    return;
  }

  if (!payload.weightPerYard) {
    rollEntryMessageEl.textContent = "請先填碼重。";
    return;
  }

  if (!payload.rolls.length) {
    rollEntryMessageEl.textContent = "請至少填一支庫存明細。";
    return;
  }

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
    rollEntryMessageEl.textContent = data.message || "入庫失敗，請再試一次。";
    return;
  }

  rollEntryMessageEl.textContent = `已成功新增 ${data.imported} 支庫存，目前總筆數 ${data.total}。`;
  resetForm();
});

resetForm();
