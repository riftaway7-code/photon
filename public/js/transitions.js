const MSGS = [
  "loading the loading...",
  "if this takes more than 1 minute u should probably refresh 💀",
  "bro the servers are literally napping rn",
  "its loading i promise (maybe)",
  "ok so the wifi might be cooked",
  "spinning wheel of destiny 🎡",
  "ur internet said 'give me a sec'",
  "certified loading moment",
  "the hamsters are running as fast as they can",
  "almost there (no promises)",
  "buffering... buffering... buffering...",
  "we sent a carrier pigeon. its slow.",
  "loading takes time. time is fake. we're all fine.",
  "your patience is actually insane rn",
  "technically this counts as loading",
  "404 loading screen not found jk its right here",
  "dial up era vibes rn",
  "one sec bro the server is on break",
  "if u stare at this long enough it loads faster (lie)",
  "loading... loading... loaded? nope still loading",
  "im gonna take a nap if this doesnt load",
];

function randMsg() {
  return MSGS[Math.floor(Math.random() * MSGS.length)];
}

const overlay = document.createElement("div");
overlay.id = "page-transition";
overlay.innerHTML = `
  <div class="pt-spinner">
    <div class="pt-ring"></div>
    <div class="pt-ring pt-ring2"></div>
    <span class="material-symbols-rounded pt-icon">flare</span>
  </div>
  <p class="pt-msg"></p>
`;
document.body.appendChild(overlay);

const msgEl = overlay.querySelector(".pt-msg");
let msgTimer = null;

function startMsgs() {
  msgEl.textContent = randMsg();
  msgTimer = setInterval(() => {
    msgEl.classList.remove("pt-msg-in");
    void msgEl.offsetWidth;
    msgEl.classList.add("pt-msg-in");
    msgEl.textContent = randMsg();
  }, 2200);
}

function stopMsgs() {
  clearInterval(msgTimer);
}

function showTransition() {
  startMsgs();
  overlay.classList.add("pt-visible");
}

function hideTransition() {
  stopMsgs();
  overlay.classList.add("pt-out");
  overlay.addEventListener("animationend", () => overlay.remove(), { once: true });
}

showTransition();
window.addEventListener("load", () => {
  setTimeout(hideTransition, 80);
});

document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href]");
  if (!a) return;
  const href = a.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("javascript")) return;
  try {
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) return;
  } catch { return; }
  showTransition();
});
