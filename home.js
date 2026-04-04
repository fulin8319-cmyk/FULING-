const featuredCards = Array.from(document.querySelectorAll(".printing-gallery .featured-card"));

function renderFeaturedCards(items) {
  const featuredItems = items
    .filter((item) => item.featuredOnHome)
    .slice(0, featuredCards.length);

  featuredItems.forEach((item, index) => {
    const card = featuredCards[index];
    if (!card) return;

    const imageEl = card.querySelector(".featured-photo");
    const titleEl = card.querySelector(".featured-copy strong");
    const useEl = card.querySelector(".featured-copy span");
    const descriptionEl = card.querySelector(".featured-copy small");

    const imagePath = item.featuredImage || item.image || imageEl?.getAttribute("src") || "";
    const titleText = item.displayTitle || item.code || "印花用布";
    const useText = item.useText || "適合：熱昇華印花 / 團體服 / 運動服";
    const descriptionText = item.descriptionText || item.note || "規格與成份可依實際布號確認。";

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
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Load failed");
    }
    renderFeaturedCards(data.items || []);
  } catch (error) {
    console.error("Failed to load featured fabrics:", error);
  }
}

loadFeaturedCards();
