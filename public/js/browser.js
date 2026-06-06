const urlBar = document.getElementById("urlBar");
const goBtn = document.getElementById("goBtn");
const backBtn = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");
const reloadBtn = document.getElementById("reloadBtn");
const proxyFrame = document.getElementById("proxyFrame");
const browserContent = document.getElementById("browserContent");
const loadingBar = document.getElementById("loadingBar");
const navLoading = document.getElementById("navLoading");
const navLoadingMsg = document.getElementById("navLoadingMsg");
const browserToolbar = document.getElementById("browserToolbar");
const toolbarPeek = document.getElementById("toolbarPeek");

let tbShowTimer = null;
let tbHideTimer = null;

function openToolbar() {
  clearTimeout(tbShowTimer); clearTimeout(tbHideTimer);
  browserToolbar.classList.add("tb-open");
  toolbarPeek.classList.add("tb-open");
}

function closeToolbar() {
  browserToolbar.classList.remove("tb-open");
  toolbarPeek.classList.remove("tb-open");
}

toolbarPeek.addEventListener("mouseenter", () => {
  clearTimeout(tbHideTimer);
  tbShowTimer = setTimeout(openToolbar, 400);
});
toolbarPeek.addEventListener("mouseleave", () => clearTimeout(tbShowTimer));
browserToolbar.addEventListener("mouseenter", () => clearTimeout(tbHideTimer));
browserToolbar.addEventListener("mouseleave", () => {
  tbHideTimer = setTimeout(closeToolbar, 300);
});

const LOADING_MSGS = [
  "loading the loading...",
  "if this takes more than 1 minute u should probably refresh 💀",
  "bro the servers are literally napping rn",
  "its loading i promise (maybe)",
  "ok so the wifi might be cooked",
  "ur internet said 'give me a sec'",
  "certified loading moment",
  "the hamsters are running as fast as they can",
  "almost there (no promises)",
  "buffering... buffering... buffering...",
  "your patience is actually insane rn",
  "technically this counts as loading",
  "one sec bro the server is on break",
  "loading... loading... loaded? nope still loading",
  "im gonna take a nap if this doesnt load",
];

let msgInterval = null;

function showNavLoading() {
  navLoadingMsg.textContent = LOADING_MSGS[Math.floor(Math.random() * LOADING_MSGS.length)];
  navLoading.classList.remove("hidden");
  msgInterval = setInterval(() => {
    navLoadingMsg.style.animation = "none";
    navLoadingMsg.offsetHeight;
    navLoadingMsg.style.animation = "";
    navLoadingMsg.textContent = LOADING_MSGS[Math.floor(Math.random() * LOADING_MSGS.length)];
  }, 2500);
}

function hideNavLoading() {
  clearInterval(msgInterval);
  navLoading.classList.add("hidden");
}

let ready = false;
let pendingUrl = null;
let controller = null;

async function initProxy() {
  if (!("serviceWorker" in navigator)) {
    document.getElementById("browserBlocked").classList.remove("hidden");
    return;
  }

  try {
    const localWisp = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/wisp/`;
    const hasLocalWisp = await fetch("/api/wisp-available").then(r => r.ok).catch(() => false);
    const WISP = hasLocalWisp ? localWisp : "wss://anura.pro/wisp/";

    const { ScramjetController } = await import("/scramjet/scramjet.bundle.js");
    const { BareMuxConnection } = await import("/bare-mux/index.mjs");

    controller = new ScramjetController({
      prefix: "/scramjet/",
      files: {
        wasm: "/scramjet/scramjet.wasm.wasm",
        all:  "/scramjet/scramjet.all.js",
        sync: "/scramjet/scramjet.sync.js",
      },
    });

    const existing = await navigator.serviceWorker.getRegistrations();
    await Promise.all(existing.map((r) => r.unregister()));
    if (existing.length > 0) await new Promise((r) => setTimeout(r, 600));

    await controller.init();

    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/scramjet/" });

    await new Promise((resolve) => {
      if (reg.active) { resolve(); return; }
      const sw = reg.installing || reg.waiting;
      if (!sw) { resolve(); return; }
      sw.addEventListener("statechange", function handler() {
        if (this.state === "activated") { this.removeEventListener("statechange", handler); resolve(); }
      });
    });

    const conn = new BareMuxConnection("/bare-mux/worker.js");
    await conn.setTransport("/epoxy/index.mjs", [{ wisp: WISP }]);

    ready = true;

    if (pendingUrl) {
      navigate(pendingUrl);
      pendingUrl = null;
    }
  } catch (err) {
    console.error("Proxy init failed:", err);
    document.getElementById("browserBlocked").classList.remove("hidden");
  }
}

function resolveUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
}

function navigate(url) {
  if (!ready) { pendingUrl = url; return; }

  const encoded = controller.encodeUrl(url);
  urlBar.value = url;
  showLoadingBar();
  showNavLoading();

  browserContent.style.display = "none";
  proxyFrame.classList.remove("hidden");
  proxyFrame.src = encoded;
  tbHideTimer = setTimeout(closeToolbar, 600);
}

function showLoadingBar() {
  loadingBar.style.width = "0";
  loadingBar.style.transition = "none";
  requestAnimationFrame(() => {
    loadingBar.style.transition = "width 0.8s ease";
    loadingBar.style.width = "85%";
  });
}

function finishLoadingBar() {
  loadingBar.style.width = "100%";
  setTimeout(() => { loadingBar.style.width = "0"; }, 400);
}

function showError(message) {
  hideNavLoading();
  browserContent.style.display = "flex";
  proxyFrame.classList.add("hidden");
  browserContent.innerHTML = `
    <div class="error-page">
      <span style="font-size:2.5rem">⚠️</span>
      <h3>Proxy Unavailable</h3>
      <p>${message.replace(/</g, "&lt;")}</p>
    </div>`;
}

goBtn.addEventListener("click", () => {
  const url = resolveUrl(urlBar.value);
  if (url) navigate(url);
});

urlBar.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const url = resolveUrl(urlBar.value);
    if (url) navigate(url);
  }
});

backBtn.addEventListener("click", () => {
  try { proxyFrame.contentWindow?.history.back(); } catch {}
});

forwardBtn.addEventListener("click", () => {
  try { proxyFrame.contentWindow?.history.forward(); } catch {}
});

reloadBtn.addEventListener("click", () => {
  if (!proxyFrame.classList.contains("hidden")) {
    showLoadingBar();
    proxyFrame.contentWindow?.location.reload();
  }
});

proxyFrame.addEventListener("load", () => {
  finishLoadingBar();
  hideNavLoading();
  try {
    const frameUrl = proxyFrame.contentWindow?.location.href;
    if (frameUrl && frameUrl !== "about:blank") {
      urlBar.value = controller.decodeUrl(frameUrl) || frameUrl;
    }
    const title = proxyFrame.contentDocument?.title;
    if (title) document.title = `${title} — Photon`;
  } catch {}
});

document.querySelectorAll(".quick-link").forEach((btn) => {
  btn.addEventListener("click", () => navigate(btn.dataset.url));
});

initProxy();
