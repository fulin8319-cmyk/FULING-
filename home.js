const featuredCards = document.querySelectorAll(".featured-card[data-image]");
const featuredModal = document.getElementById("featuredModal");
const featuredModalImage = document.getElementById("featuredModalImage");
const featuredModalTitle = document.getElementById("featuredModalTitle");
const featuredModalUse = document.getElementById("featuredModalUse");
const featuredModalSpec = document.getElementById("featuredModalSpec");
const closeFeaturedModal = document.getElementById("closeFeaturedModal");

if (featuredCards.length && featuredModal) {
  featuredCards.forEach((card) => {
    card.addEventListener("click", () => {
      featuredModalImage.style.background = `center / contain no-repeat #fff url("${card.dataset.image}")`;
      featuredModalTitle.textContent = card.dataset.title || "";
      featuredModalUse.textContent = card.dataset.use || "";
      featuredModalSpec.textContent = card.dataset.spec || "";
      featuredModal.showModal();
    });
  });

  closeFeaturedModal.addEventListener("click", () => {
    featuredModal.close();
  });

  featuredModal.addEventListener("click", (event) => {
    const rect = featuredModal.getBoundingClientRect();
    const isInside =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;
    if (!isInside) {
      featuredModal.close();
    }
  });
}
