const state = {
  media: [],
  posts: [],
  credentials: {},
  capabilities: {}
};

const els = {
  platforms: document.getElementById("platforms"),
  postContent: document.getElementById("postContent"),
  scheduledAt: document.getElementById("scheduledAt"),
  mediaInput: document.getElementById("mediaInput"),
  mediaPreview: document.getElementById("mediaPreview"),
  savePostButton: document.getElementById("savePostButton"),
  refreshButton: document.getElementById("refreshButton"),
  socialMessage: document.getElementById("socialMessage"),
  credentialStatus: document.getElementById("credentialStatus"),
  postList: document.getElementById("postList"),
  logoutButton: document.getElementById("logoutButton")
};

function setMessage(text, type = "") {
  els.socialMessage.textContent = text;
  els.socialMessage.dataset.type = type;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "Request failed.");
  }
  return data;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function selectedPlatforms() {
  return Array.from(els.platforms.querySelectorAll("input:checked")).map((input) => input.value);
}

function renderMedia() {
  if (!state.media.length) {
    els.mediaPreview.className = "social-media-preview is-empty";
    els.mediaPreview.textContent = "尚未上傳媒體";
    return;
  }

  els.mediaPreview.className = "social-media-preview";
  els.mediaPreview.innerHTML = state.media
    .map((item, index) => {
      const preview = item.type === "video"
        ? `<video src="${item.url}" controls muted></video>`
        : `<img src="${item.url}" alt="">`;
      return `<div class="social-media-item">${preview}<button type="button" data-remove-media="${index}">移除</button><span>${item.name || item.type}</span></div>`;
    })
    .join("");
}

function platformMeta(key) {
  const labels = {
    facebook: "Facebook Page",
    x: "X",
    tiktok: "TikTok",
    instagram: "Instagram",
    buffer: "Buffer"
  };
  const capability = state.capabilities[key] || {};
  const ready = Boolean(capability.ready ?? state.credentials[key]);
  const selectable = capability.selectable !== false && ready;
  const reason = capability.reason || (ready ? "" : "尚未設定 API 權限");
  return { label: labels[key] || key, ready, selectable, reason };
}

function applyPlatformAvailability() {
  els.platforms.querySelectorAll("label").forEach((label) => {
    const input = label.querySelector("input");
    if (!input) return;
    const meta = platformMeta(input.value);
    label.classList.toggle("is-disabled", !meta.selectable);
    label.title = meta.reason || "";
    input.disabled = !meta.selectable;
    if (!meta.selectable) {
      input.checked = false;
    }
  });
  const hasChecked = Array.from(els.platforms.querySelectorAll("input:checked")).some((input) => !input.disabled);
  const facebook = els.platforms.querySelector('input[value="facebook"]');
  if (!hasChecked && facebook && !facebook.disabled) {
    facebook.checked = true;
  }
}

function renderCredentials() {
  const order = ["facebook", "buffer", "x", "tiktok", "instagram"];
  els.credentialStatus.innerHTML = order
    .map((key) => {
      const meta = platformMeta(key);
      const status = meta.selectable ? "可發布" : meta.ready ? "已設定但暫停" : "未就緒";
      return `<div class="credential-pill ${meta.selectable ? "is-ready" : ""}"><span></span>${meta.label}<strong>${status}</strong>${meta.reason ? `<small>${meta.reason}</small>` : ""}</div>`;
    })
    .join("");
  applyPlatformAvailability();
}

function renderPosts() {
  if (!state.posts.length) {
    els.postList.innerHTML = `<div class="empty-state">還沒有社群貼文。</div>`;
    return;
  }

  els.postList.innerHTML = state.posts
    .map((post) => {
      const platforms = (post.platforms || []).join(", ");
      const mediaCount = (post.media || []).length;
      const resultText = post.results
        ? Object.entries(post.results).map(([platform, result]) => `${platform}: ${result.ok ? "OK" : result.message}`).join(" / ")
        : "";
      return `
        <article class="social-post-card">
          <div>
            <strong>${post.status || "draft"}</strong>
            <span>${platforms || "未選平台"} · ${mediaCount} 個媒體</span>
          </div>
          <p>${post.content || "(只有媒體)"}</p>
          <small>${post.scheduledAt ? `排程 ${post.scheduledAt}` : `建立 ${post.createdAt || ""}`}</small>
          ${resultText ? `<small>${resultText}</small>` : ""}
          <button class="secondary-button" type="button" data-publish="${post.id}">立即送出</button>
        </article>
      `;
    })
    .join("");
}

async function uploadMedia(files) {
  for (const file of files) {
    if (file.size > 80 * 1024 * 1024) {
      throw new Error(`${file.name} 超過 80MB。`);
    }
    const data = await fileToBase64(file);
    const uploaded = await api("/api/admin/upload-social-media", {
      method: "POST",
      body: JSON.stringify({ name: file.name, mimeType: file.type, data })
    });
    state.media.push({ url: uploaded.url, type: uploaded.type, name: uploaded.name || file.name });
  }
  renderMedia();
}

async function loadAll() {
  const [status, posts] = await Promise.all([
    api("/api/admin/social/status"),
    api("/api/admin/social/posts")
  ]);
  state.credentials = status.credentials || {};
  state.capabilities = status.capabilities || {};
  state.posts = posts.posts || [];
  renderCredentials();
  renderPosts();
}

async function savePost() {
  const payload = {
    platforms: selectedPlatforms(),
    content: els.postContent.value,
    scheduledAt: els.scheduledAt.value,
    media: state.media
  };
  const saved = await api("/api/admin/social/posts", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  state.posts.unshift(saved.post);
  state.media = [];
  els.postContent.value = "";
  els.scheduledAt.value = "";
  els.mediaInput.value = "";
  renderMedia();
  renderPosts();
  setMessage("已儲存草稿。", "success");
}

async function publishPost(id) {
  setMessage("正在送出...", "");
  await api(`/api/admin/social/posts/${id}/publish`, { method: "POST", body: "{}" });
  await loadAll();
  setMessage("送出完成。", "success");
}

els.mediaInput.addEventListener("change", async () => {
  try {
    setMessage("正在上傳媒體...", "");
    await uploadMedia(Array.from(els.mediaInput.files || []));
    setMessage("媒體已上傳。", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

els.mediaPreview.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-media]");
  if (!button) return;
  state.media.splice(Number(button.dataset.removeMedia), 1);
  renderMedia();
});

els.postList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-publish]");
  if (!button) return;
  try {
    await publishPost(button.dataset.publish);
  } catch (error) {
    setMessage(error.message, "error");
    await loadAll().catch(() => {});
  }
});

els.savePostButton.addEventListener("click", () => savePost().catch((error) => setMessage(error.message, "error")));
els.refreshButton.addEventListener("click", () => loadAll().catch((error) => setMessage(error.message, "error")));
els.logoutButton?.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "./login.html";
});

renderMedia();
loadAll().catch((error) => setMessage(error.message, "error"));
