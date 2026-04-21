const featuredCards = Array.from(document.querySelectorAll(".printing-gallery .featured-card"));

function isLogoImage(url) {
  const lower = String(url || "").toLowerCase();
  return (
    lower.includes("logo.jpg") ||
    lower.includes("logo.jpeg") ||
    lower.includes("logo.png") ||
    lower.includes("fulin-logo")
  );
}

function renderFeaturedCards(items) {
  const featuredItems = items
    .filter((item) => item.featuredOnHome)
    .filter((item) => !isLogoImage(item.featuredImage || item.image))
    .slice(0, featuredCards.length);

  featuredItems.forEach((item, index) => {
    const card = featuredCards[index];
    if (!card) return;

    const imageEl = card.querySelector(".featured-photo");
    const titleEl = card.querySelector(".featured-copy strong");
    const useEl = card.querySelector(".featured-copy span");
    const descriptionEl = card.querySelector(".featured-copy small");

    const imagePath = item.featuredImage || item.image || imageEl?.getAttribute("src") || "";
    const titleText = item.displayTitle || item.name || item.code || "布料";
    const useText = item.useText || `${item.fabricType || "布料"} / ${item.pattern || "未分類"}`;
    const descriptionText = item.descriptionText || item.note || "可聯繫福麟商行詢問庫存與對樣。";

    if (imageEl && imagePath) {
      imageEl.src = imagePath;
      imageEl.alt = titleText;
    }
    if (titleEl) titleEl.textContent = titleText;
    if (useEl) useEl.textContent = useText;
    if (descriptionEl) descriptionEl.textContent = descriptionText;
  });
}

async function loadFeaturedCards() {
  if (!featuredCards.length) return;

  try {
    const response = await fetch("/api/inventory");
    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : payload.items || [];
    renderFeaturedCards(items);
  } catch (error) {
    console.error("Failed to load featured fabrics:", error);
  }
}

loadFeaturedCards();
