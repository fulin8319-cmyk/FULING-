const printingGridEl = document.getElementById("printingGrid");
const printingCountEl = document.getElementById("printingCount");
const printingModalEl = document.getElementById("printingModal");
const printingModalSwatchEl = document.getElementById("printingModalSwatch");
const printingModalInfoEl = document.getElementById("printingModalInfo");
const closePrintingModalEl = document.getElementById("closePrintingModal");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function openPrintingModal(item) {
  const image = item.featuredImage || item.image || "";
  printingModalSwatchEl.style.background = `center / cover no-repeat url("${image}")`;
  printingModalInfoEl.innerHTML = `
    <div>
      <p class="eyebrow">Fabric Detail</p>
      <h3>${escapeHtml(item.displayTitle || item.code)}</h3>
    </div>
    <div class="modal-grid">
      <div class="detail-card"><span>布號</span><strong>${escapeHtml(item.code || "-")}</strong></div>
      <div class="detail-card"><span>幅寬</span><strong>${item.width ? `${item.width}"` : "-"}</strong></div>
      <div class="detail-card"><span>碼重</span><strong>${item.weightPerYard || "-"}</strong></div>
      <div class="detail-card"><span>公斤數</span><strong>${item.kg || "-"}</strong></div>
    </div>
    <div class="note">${escapeHtml(item.useText || "可聯絡確認實際用途與規格。")}</div>
    <div class="note">${escapeHtml(item.descriptionText || item.note || "")}</div>
  `;
  printingModalEl.showModal();
}

function bindPrintingCards(items) {
  document.querySelectorAll("[data-printing-code]").forEach((element) => {
    element.addEventListener("click", () => {
      const code = element.dataset.printingCode;
      const item = items.find((entry) => entry.code === code);
      if (item) {
        openPrintingModal(item);
      }
    });
  });
}

async function loadPrintingPage() {
  try {
    const response = await fetch("/api/inventory");
    const data = await response.json();
    const items = (data.items || [])
      .filter((item) => item.featuredOnHome || item.featuredImage || item.category || item.useText)
      .filter((item) => item.featuredImage || item.image)
      .slice(0, 24);

    printingCountEl.textContent = items.length;
    printingGridEl.innerHTML = items.map((item) => {
      const image = item.featuredImage || item.image || "";
      return `
        <article class="featured-card" data-printing-code="${escapeHtml(item.code)}">
          <img class="featured-photo" src="${escapeHtml(image)}" alt="${escapeHtml(item.displayTitle || item.code)}">
          <div class="featured-copy">
            <strong>${escapeHtml(item.displayTitle || item.code)}</strong>
            <span>${escapeHtml(item.useText || "適合：印花、團體服、運動服")}</span>
            <small>${escapeHtml(item.descriptionText || item.note || "規格可另外確認")}</small>
          </div>
        </article>
      `;
    }).join("");

    bindPrintingCards(items);
  } catch (error) {
    printingGridEl.innerHTML = `<article class="category-card"><h3>載入失敗</h3><p>${escapeHtml(error.message)}</p></article>`;
  }
}

closePrintingModalEl.addEventListener("click", () => printingModalEl.close());
printingModalEl.addEventListener("click", (event) => {
  const rect = printingModalEl.getBoundingClientRect();
  const isInside =
    rect.top <= event.clientY &&
    event.clientY <= rect.top + rect.height &&
    rect.left <= event.clientX &&
    event.clientX <= rect.left + rect.width;
  if (!isInside) printingModalEl.close();
});

loadPrintingPage();
