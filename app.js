let inventory = [];

const rowsEl = document.getElementById("inventoryRows");
const cardGridEl = document.getElementById("cardGrid");
const searchInputEl = document.getElementById("searchInput");
const statusFilterEl = document.getElementById("statusFilter");
const sortSelectEl = document.getElementById("sortSelect");
const summaryStripEl = document.getElementById("summaryStrip");
const recordCountEl = document.getElementById("recordCount");
const reviewCountEl = document.getElementById("reviewCount");
const modalEl = document.getElementById("previewModal");
const modalSwatchEl = document.getElementById("modalSwatch");
const modalInfoEl = document.getElementById("modalInfo");
const closeModalEl = document.getElementById("closeModal");

function formatNumber(value, digits = 1) {
  return Number(value).toFixed(digits);
}

function statusLabel(status) {
  if (status === "review") return "Review";
  if (status === "sold") return "Sold";
  if (status === "reserved") return "Reserved";
  return "Confirmed";
}

function getFilteredRecords() {
  const keyword = searchInputEl.value.trim().toLowerCase();
  const status = statusFilterEl.value;
  const sortKey = sortSelectEl.value;

  const filtered = inventory.filter((item) => {
    const haystack = [
      item.code,
      item.baseCode,
      item.rollNo,
      String(item.width),
      String(item.weightPerYard),
      String(item.kg),
      item.side,
      item.location
    ].join(" ").toLowerCase();

    const matchesStatus = status === "all" || item.status === status;
    const matchesSearch = !keyword || haystack.includes(keyword);
    return matchesStatus && matchesSearch;
  });

  filtered.sort((a, b) => {
    if (sortKey === "code") return a.code.localeCompare(b.code);
    return (b[sortKey] || 0) - (a[sortKey] || 0);
  });

  return filtered;
}

function buildSummary(records) {
  const totalKg = records.reduce((sum, item) => sum + (item.kg || 0), 0);
  const totalYards = records.reduce((sum, item) => sum + (item.yards || 0), 0);
  const maxWidth = records.reduce((max, item) => Math.max(max, item.width || 0), 0);
  const reviewItems = records.filter((item) => item.status === "review").length;

  summaryStripEl.innerHTML = [
    { label: "Total KG", value: `${formatNumber(totalKg)} kg` },
    { label: "Total Yards", value: `${formatNumber(totalYards)} yd` },
    { label: "Max Width", value: `${maxWidth}"` },
    { label: "Review Items", value: reviewItems }
  ].map((card) => `
    <article class="summary-card">
      <span>${card.label}</span>
      <strong>${card.value}</strong>
    </article>
  `).join("");
}

function openPreview(item) {
  modalSwatchEl.style.background = `center / cover no-repeat url("${item.image}")`;
  modalInfoEl.innerHTML = `
    <div>
      <p class="eyebrow">Fabric Detail</p>
      <h3>${item.code}</h3>
      <p>${item.baseCode && item.baseCode !== item.code ? `Base code ${item.baseCode}${item.rollNo ? ` / Roll ${item.rollNo}` : ""}` : (item.rollNo ? `Roll ${item.rollNo}` : "")}</p>
    </div>
    <div class="modal-grid">
      <div class="detail-card"><span>Width</span><strong>${item.width}"</strong></div>
      <div class="detail-card"><span>Weight</span><strong>${item.weightPerYard}</strong></div>
      <div class="detail-card"><span>KG</span><strong>${item.kg ? `${formatNumber(item.kg)} kg` : "Sold out"}</strong></div>
      <div class="detail-card"><span>Yards</span><strong>${item.yards ? `${formatNumber(item.yards)} yd` : "Sold out"}</strong></div>
      <div class="detail-card"><span>Page Slot</span><strong>${item.side}</strong></div>
      <div class="detail-card"><span>Stock Slot</span><strong>${item.location || "Pending"}</strong></div>
    </div>
    <div class="note">${item.note || ""}</div>
  `;
  modalEl.showModal();
}

function bindPreviewClicks() {
  document.querySelectorAll("[data-code]").forEach((element) => {
    element.addEventListener("click", () => {
      const item = inventory.find((entry) => entry.code === element.dataset.code);
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
      <td><div class="mini-swatch" data-code="${item.code}" style="background:center / cover no-repeat url('${item.image}')"></div></td>
      <td>${item.code}</td>
      <td>${item.baseCode && item.baseCode !== item.code ? item.baseCode : "-"}</td>
      <td>${item.rollNo || "-"}</td>
      <td>${item.width}"</td>
      <td>${item.weightPerYard}</td>
      <td>${item.kg ? formatNumber(item.kg) : "-"}</td>
      <td>${item.yards ? formatNumber(item.yards) : "-"}</td>
      <td>${item.location || "-"}</td>
      <td><span class="status-pill status-${item.status}">${statusLabel(item.status)}</span></td>
    </tr>
  `).join("");

  cardGridEl.innerHTML = records.map((item) => `
    <article class="fabric-card fabric-card-${item.status}">
      <div class="swatch" data-code="${item.code}" style="background:center / cover no-repeat url('${item.image}')"></div>
      <div class="fabric-meta">
        <strong>${item.code}</strong>
        <span>${item.baseCode && item.baseCode !== item.code ? `Base ${item.baseCode}` : "Single roll"}${item.rollNo ? ` / Roll ${item.rollNo}` : ""}</span>
        <span>Width ${item.width}" / Weight ${item.weightPerYard}</span>
        <span>${item.kg ? formatNumber(item.kg) : "-"} kg / ${item.yards ? formatNumber(item.yards) : "-"} yd</span>
        <span>${item.side} / ${statusLabel(item.status)}</span>
      </div>
    </article>
  `).join("");

  bindPreviewClicks();
}

async function loadInventory() {
  const response = await fetch("/api/inventory");
  const data = await response.json();
  inventory = data.items || [];
  render();
}

searchInputEl.addEventListener("input", render);
statusFilterEl.addEventListener("change", render);
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
