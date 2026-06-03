const productCardsEl = document.getElementById("productCards");
const lightboxEl = document.getElementById("productLightbox");
const lightboxImageEl = document.getElementById("productLightboxImage");
const lightboxCloseEl = document.getElementById("productLightboxClose");
const lightboxPrevEl = document.getElementById("productLightboxPrev");
const lightboxNextEl = document.getElementById("productLightboxNext");

let productGallery = [];
let productGalleryIndex = 0;

function isLogoImage(url) {
  const lower = String(url || "").toLowerCase();
  return lower.includes("logo.jpg") || lower.includes("logo.jpeg") || lower.includes("logo.png") || lower.includes("fulin-logo");
}

function resolveImage(src) {
  const text = String(src || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text) || text.startsWith("data:")) return text;
  return new URL(text, location.origin + "/").href;
}

function optimizedImage(src) {
  const absolute = resolveImage(src);
  if (!absolute) return "";
  const url = new URL(absolute, location.href);
  if (url.origin !== location.origin) return absolute;
  if (!url.pathname.startsWith("/assets/") || url.pathname.startsWith("/assets/uploads/")) return absolute;
  if (!/\.(jpe?g|png)$/i.test(url.pathname)) return absolute;
  url.pathname = url.pathname.replace(/^\/assets\//, "/assets/optimized/").replace(/\.(jpe?g|png)$/i, ".jpg");
  return url.href;
}

function uniqueImages(item) {
  const values = [
    ...(Array.isArray(item.images) ? item.images : []),
    item.featuredImage,
    item.imagePrimary,
    item.image,
    item.imageSecondary
  ];
  return [...new Set(values.map(resolveImage).filter((src) => src && !isLogoImage(src)))];
}

function featuredOrder(item) {
  const order = Number(item.featuredOrder || 0);
  return Number.isFinite(order) && order > 0 ? order : Number.MAX_SAFE_INTEGER;
}

function sortFeatured(items) {
  return [...items].sort((a, b) => {
    const diff = featuredOrder(a) - featuredOrder(b);
    if (diff) return diff;
    return String(a.code || "").localeCompare(String(b.code || ""), "zh-Hant");
  });
}

function productTitle(item) {
  return item.displayTitle || item.name || item.fabricType || item.code || "主力布料";
}

function productDescription(item) {
  const note = String(item.note || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const specs = [
    item.width ? `${item.width}"` : "",
    item.weightPerYard ? `${item.weightPerYard}g` : ""
  ].filter(Boolean).join(" / ");
  return [
    specs,
    item.fabricType,
    note[0],
    item.descriptionText,
    item.useText
  ].filter(Boolean).join("。");
}

function galleryKey(item, index) {
  return `product-${String(item.code || productTitle(item) || index).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function openLightbox(images, index = 0, alt = "布料圖片") {
  productGallery = images;
  productGalleryIndex = index;
  lightboxImageEl.src = productGallery[productGalleryIndex];
  lightboxImageEl.alt = alt;
  const hasMany = productGallery.length > 1;
  lightboxPrevEl.hidden = !hasMany;
  lightboxNextEl.hidden = !hasMany;
  lightboxEl.classList.add("active");
}

function tuneImageLoading(image, eager = false) {
  image.decoding = "async";
  image.loading = eager ? "eager" : "lazy";
}

function moveLightbox(step) {
  if (!productGallery.length) return;
  productGalleryIndex = (productGalleryIndex + step + productGallery.length) % productGallery.length;
  lightboxImageEl.src = productGallery[productGalleryIndex];
}

function enhanceStaticCards() {
  productCardsEl.querySelectorAll(".product-card").forEach((card, index) => {
    const image = card.querySelector("img");
    if (!image) return;
    const src = resolveImage(image.getAttribute("src"));
    image.src = optimizedImage(src);
    tuneImageLoading(image, index === 0);
    image.dataset.productGallery = `static-${index}`;
    image.style.cursor = "zoom-in";
    image.addEventListener("click", () => openLightbox([src], 0, image.alt || "布料圖片"));
  });
}

function renderProductCards(items) {
  productCardsEl.innerHTML = "";
  sortFeatured(items).forEach((item, index) => {
    const images = uniqueImages(item);
    const title = productTitle(item);
    const card = document.createElement("article");
    card.className = "panel product-card";

    const imageWrap = document.createElement("button");
    imageWrap.className = "product-image-button";
    imageWrap.type = "button";
    imageWrap.setAttribute("aria-label", `放大檢視 ${title}`);

    const image = document.createElement("img");
    image.src = optimizedImage(images[0]);
    image.alt = `${title}樣品圖`;
    tuneImageLoading(image, index === 0);
    imageWrap.appendChild(image);
    imageWrap.addEventListener("click", () => openLightbox(images, 0, image.alt));
    card.appendChild(imageWrap);

    if (images.length > 1) {
      const thumbs = document.createElement("div");
      thumbs.className = "product-thumbs";
      images.forEach((src, imageIndex) => {
        const thumbButton = document.createElement("button");
        thumbButton.type = "button";
        thumbButton.setAttribute("aria-label", `放大檢視 ${title} 圖片 ${imageIndex + 1}`);
        const thumb = document.createElement("img");
        thumb.src = optimizedImage(src);
        thumb.alt = `${title}樣品圖 ${imageIndex + 1}`;
        tuneImageLoading(thumb);
        thumbButton.appendChild(thumb);
        thumbButton.addEventListener("click", () => openLightbox(images, imageIndex, thumb.alt));
        thumbs.appendChild(thumbButton);
      });
      card.appendChild(thumbs);
    }

    const h3 = document.createElement("h3");
    h3.textContent = title;
    card.appendChild(h3);

    const desc = document.createElement("p");
    desc.textContent = productDescription(item) || "後台可編輯主力布料圖片、規格與說明。";
    card.appendChild(desc);

    const links = document.createElement("div");
    links.className = "quick-links";
    const inventoryLink = document.createElement("a");
    inventoryLink.className = "chip";
    inventoryLink.href = "https://line.me/R/ti/p/@424tvsxa";
    inventoryLink.textContent = "詢問現貨布";
    const lineLink = document.createElement("a");
    lineLink.className = "chip";
    lineLink.href = "https://line.me/R/ti/p/@424tvsxa";
    lineLink.textContent = "LINE詢價";
    links.append(inventoryLink, lineLink);
    card.appendChild(links);

    card.dataset.galleryKey = galleryKey(item, index);
    productCardsEl.appendChild(card);
  });
}

async function loadSyncedProducts() {
  try {
    const response = await fetch("/api/inventory");
    if (!response.ok) {
      enhanceStaticCards();
      return;
    }
    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : payload.items || [];
    const featured = items
      .filter((item) => item && item.featuredOnHome === true)
      .filter((item) => uniqueImages(item).length);

    if (!featured.length) {
      enhanceStaticCards();
      return;
    }

    renderProductCards(featured);
  } catch (error) {
    console.error("Failed to load synced product images:", error);
    enhanceStaticCards();
  }
}

lightboxCloseEl.addEventListener("click", () => lightboxEl.classList.remove("active"));
lightboxPrevEl.addEventListener("click", () => moveLightbox(-1));
lightboxNextEl.addEventListener("click", () => moveLightbox(1));
lightboxEl.addEventListener("click", (event) => {
  if (event.target === lightboxEl) lightboxEl.classList.remove("active");
});
document.addEventListener("keydown", (event) => {
  if (!lightboxEl.classList.contains("active")) return;
  if (event.key === "Escape") lightboxEl.classList.remove("active");
  if (event.key === "ArrowLeft") moveLightbox(-1);
  if (event.key === "ArrowRight") moveLightbox(1);
});

loadSyncedProducts();
