function proxyUrl(url) {
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    return `/api/fetch?url=${encodeURIComponent(url)}`;
  }
  return url;
}

const grid = document.getElementById("gamesGrid");
const searchInput = document.getElementById("searchInput");
const categoryPills = document.getElementById("categoryPills");

let allGames = [];
let activeCategory = "all";

async function loadGames() {
  try {
    const res = await fetch("/api/games");
    const data = await res.json();
    allGames = Array.isArray(data) ? data : [];
  } catch {
    allGames = [];
  }
  if (allGames.length === 0) {
    try {
      const res = await fetch("/games-list.json");
      const data = await res.json();
      allGames = Array.isArray(data) ? data : [];
    } catch {}
  }

  if (allGames.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <span style="font-size:3rem">🎮</span>
        <p>No games yet. Add game folders to <code>public/games/</code>.</p>
      </div>`;
    return;
  }

  buildCategoryPills();
  renderGames();
}

function buildCategoryPills() {
  const cats = ["All", ...new Set(allGames.map((g) => g.category || "Other"))];
  categoryPills.innerHTML = cats
    .map(
      (c) =>
        `<button class="pill${c === "All" ? " active" : ""}" data-category="${c.toLowerCase()}">${c}</button>`
    )
    .join("");

  categoryPills.querySelectorAll(".pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      categoryPills.querySelectorAll(".pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeCategory = btn.dataset.category;
      renderGames();
    });
  });
}

function renderGames() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = allGames.filter((g) => {
    const matchCat = activeCategory === "all" || (g.category || "Other").toLowerCase() === activeCategory;
    const matchSearch = !query || g.title.toLowerCase().includes(query);
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state"><p>No games match your search.</p></div>`;
    return;
  }

  grid.innerHTML = filtered
    .map(
      (g) => `
    <div class="game-card" data-url="${escHtml(g.url)}" data-title="${escHtml(g.title)}">
      ${
        g.thumbnail
          ? `<img class="game-thumbnail" src="${escHtml(g.thumbnail)}" alt="${escHtml(g.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(makePlaceholder('vro ur blocker blocked thumbnails 😭'))">`
          : `<div class="game-thumbnail-placeholder">vro ur blocker blocked thumbnails 😭</div>`
      }
      <div class="game-info">
        <div class="game-title">${escHtml(g.title)}</div>
        <div class="game-category">${escHtml(g.category || "Other")}</div>
      </div>
    </div>`
    )
    .join("");

  grid.querySelectorAll(".game-card").forEach((card) => {
    card.addEventListener("click", () => openGame(card.dataset.url, card.dataset.title));
  });
}

function openGame(url, title) {
  location.href = `/game.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

window.makePlaceholder = function (emoji) {
  const el = document.createElement("div");
  el.className = "game-thumbnail-placeholder";
  el.textContent = emoji;
  return el;
};

searchInput.addEventListener("input", renderGames);

loadGames();
