(function () {
  "use strict";

  const STORAGE_KEY = "fulin_analytics_session";
  const SESSION_TIMEOUT = 30 * 60 * 1000;
  const ENDPOINT = "/api/analytics/event";

  function newSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID().replace(/-/g, "");
    }
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
  }

  function detectSource() {
    const utmSource = new URLSearchParams(window.location.search).get("utm_source") || "";
    const value = utmSource.toLowerCase();
    if (value.includes("google")) return "Google";
    if (value.includes("facebook") || value === "fb" || value.includes("instagram")) return "Facebook";
    if (value.includes("line")) return "LINE";

    if (!document.referrer) return "直接進入";
    try {
      const referrerHost = new URL(document.referrer).hostname.toLowerCase();
      if (referrerHost === window.location.hostname) return "直接進入";
      if (referrerHost.includes("google")) return "Google";
      if (referrerHost.includes("facebook") || referrerHost.includes("instagram")) return "Facebook";
      if (referrerHost.includes("line.me") || referrerHost.includes("line-apps")) return "LINE";
    } catch {}
    return "其他";
  }

  function loadSession() {
    const now = Date.now();
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (stored && stored.id && now - Number(stored.lastActivity || 0) < SESSION_TIMEOUT) {
        stored.lastActivity = now;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        return stored;
      }
    } catch {}

    const session = { id: newSessionId(), source: detectSource(), lastActivity: now };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {}
    return session;
  }

  const session = loadSession();

  function touchSession() {
    session.lastActivity = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {}
  }

  function sendEvent(payload, useBeacon = false) {
    touchSession();
    const body = JSON.stringify({
      sessionId: session.id,
      path: window.location.pathname,
      source: session.source,
      ...payload
    });
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      return;
    }
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true
    }).catch(() => {});
  }

  sendEvent({
    type: "page_view",
    path: window.location.pathname,
    source: session.source
  });

  let visibleSince = document.visibilityState === "visible" ? Date.now() : 0;

  function flushEngagement(useBeacon = false) {
    if (!visibleSince) return;
    const seconds = Math.floor((Date.now() - visibleSince) / 1000);
    visibleSince = document.visibilityState === "visible" ? Date.now() : 0;
    if (seconds < 5) return;
    sendEvent({ type: "engagement", seconds }, useBeacon);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      visibleSince = Date.now();
    } else {
      flushEngagement(true);
    }
  });

  window.addEventListener("pagehide", () => flushEngagement(true));
  window.setInterval(() => flushEngagement(false), 15 * 1000);

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    const href = String(link.getAttribute("href") || "");
    const text = String(link.textContent || "").trim();
    let action = "";

    if (link.dataset.analyticsAction === "product" || /詢問這款|商品詢問/.test(text)) {
      action = "product";
    } else if (/^tel:/i.test(href)) {
      action = "phone";
    } else if (/line\.me|qr-official\.line\.me/i.test(href)) {
      action = "line";
    }

    if (action) {
      sendEvent({ type: "cta_click", action });
    }
  });
})();
