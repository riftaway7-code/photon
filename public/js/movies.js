const API_KEY = '805a6a6661151cfd3927e1186c1f444e';
const BASE_URL = 'https://api.themoviedb.org/3';

const moviesGrid = document.getElementById('moviesGrid');
const searchInput = document.getElementById('searchInput');
const typeSelect = document.getElementById('typeSelect');
const genreSelect = document.getElementById('genreSelect');
const modal = document.getElementById('modal');
const loadingIndicator = document.getElementById('loadingIndicator');
const emptyState = document.getElementById('emptyState');

let currentPage = 1;
let isLoading = false;
let isSearching = false;
let allMovies = [];
let movieGenres = {};
let tvGenres = {};

async function loadGenres() {
  const [movieRes, tvRes] = await Promise.all([
    fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`).then(r => r.json()),
    fetch(`${BASE_URL}/genre/tv/list?api_key=${API_KEY}`).then(r => r.json()),
  ]);
  movieGenres = Object.fromEntries((movieRes.genres || []).map(g => [g.name, g.id]));
  tvGenres = Object.fromEntries((tvRes.genres || []).map(g => [g.name, g.id]));
  populateGenreSelect();
}

function populateGenreSelect() {
  const type = typeSelect.value;
  const source = type === 'tv' ? tvGenres : type === 'movie' ? movieGenres : { ...movieGenres, ...tvGenres };
  const current = genreSelect.value;
  genreSelect.innerHTML = '<option value="">All Genres</option>';
  Object.keys(source).sort().forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === current) opt.selected = true;
    genreSelect.appendChild(opt);
  });
}

async function fetchMovies(page = 1, type = 'all', genreName = '') {
  try {
    const movieGenreId = genreName ? movieGenres[genreName] : null;
    const tvGenreId = genreName ? tvGenres[genreName] : null;

    const movieEndpoint = movieGenreId
      ? `${BASE_URL}/discover/movie?api_key=${API_KEY}&page=${page}&with_genres=${movieGenreId}`
      : `${BASE_URL}/movie/popular?api_key=${API_KEY}&page=${page}`;
    const tvEndpoint = tvGenreId
      ? `${BASE_URL}/discover/tv?api_key=${API_KEY}&page=${page}&with_genres=${tvGenreId}`
      : `${BASE_URL}/tv/popular?api_key=${API_KEY}&page=${page}`;

    if (type === 'all') {
      const movieFetch = (!genreName || movieGenreId) ? fetch(movieEndpoint).then(r => r.json()) : Promise.resolve({ results: [] });
      const tvFetch = (!genreName || tvGenreId) ? fetch(tvEndpoint).then(r => r.json()) : Promise.resolve({ results: [] });
      const [moviesRes, tvRes] = await Promise.all([movieFetch, tvFetch]);
      return [...(moviesRes.results || []).map(i => ({ ...i, media_type: 'movie' })), ...(tvRes.results || []).map(i => ({ ...i, media_type: 'tv' }))];
    } else {
      const endpoint = type === 'movie' ? movieEndpoint : tvEndpoint;
      const res = await fetch(endpoint).then(r => r.json());
      return (res.results || []).map(item => ({ ...item, media_type: type }));
    }
  } catch (err) {
    console.error('Fetch error:', err);
    return [];
  }
}

async function searchMovies(query) {
  try {
    const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`).then(r => r.json());
    return (res.results || []).filter(item => item.media_type === 'movie' || item.media_type === 'tv');
  } catch (err) {
    return [];
  }
}

async function autoSelectSource(sources, sourceSelect) {
  const iframe = document.getElementById('modalIframe');
  iframe.src = '';

  async function probe(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
      await fetch(url, { mode: 'no-cors', signal: ctrl.signal });
      clearTimeout(timer);
      return url;
    } catch {
      clearTimeout(timer);
      throw new Error('unreachable');
    }
  }

  const winner = await Promise.any(sources.map(probe)).catch(() => null);
  const best = winner || sources[0];

  for (const opt of sourceSelect.options) {
    if (opt.value === best) { opt.selected = true; break; }
  }
  iframe.src = best;
}

function getPosterUrl(posterPath) {
  if (!posterPath) return null;
  if (posterPath.startsWith('http') || posterPath.startsWith('_thumbs/')) return posterPath;
  return `https://image.tmdb.org/t/p/w500${posterPath}`;
}

function createCard(item) {
  const card = document.createElement('div');
  card.className = 'movie-card';
  const title = item.title || item.name || 'Unknown';
  const year = (item.release_date || item.first_air_date || '').split('-')[0];
  const posterUrl = getPosterUrl(item.poster_path);

  card.innerHTML = `
    <div class="movie-poster">
      <img src="${posterUrl}" alt="${title}" onerror="this.src='/images/placeholder.png'" />
    </div>
    <div class="movie-info">
      <div class="movie-title">${title}</div>
      <div class="movie-year">${year}</div>
    </div>
  `;

  card.addEventListener('click', () => openModal(item));
  moviesGrid.appendChild(card);
}

function openModal(item) {
  const title = item.title || item.name || 'Unknown';
  const year = (item.release_date || item.first_air_date || '').split('-')[0];
  const isTV = item.media_type === 'tv';
  const posterUrl = getPosterUrl(item.poster_path);
  const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';

  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalYear').textContent = year;
  document.getElementById('modalType').textContent = isTV ? 'TV Series' : 'Movie';
  document.getElementById('modalRating').textContent = `⭐ ${rating}`;
  document.getElementById('modalPoster').src = posterUrl;
  document.getElementById('modalDescription').textContent = item.overview || 'No description available.';

  const controls = document.getElementById('modalControls');
  controls.innerHTML = '';

  const movieSources = [
    `https://vidsrc.xyz/embed/movie?tmdb=${item.id}`,
    `https://player.vidsrc.co/embed/movie/${item.id}`,
    `https://vidsrc.win/embed/movie?tmdb=${item.id}`,
    `https://vidlink.pro/movie/${item.id}`,
  ];

  const tvSources = [
    `https://vidsrc.xyz/embed/tv?tmdb=${item.id}`,
    `https://player.vidsrc.co/embed/tv/${item.id}`,
    `https://vidsrc.win/embed/tv?tmdb=${item.id}`,
  ];

  if (isTV) {
    const seasonSelect = document.createElement('select');
    seasonSelect.id = 'seasonSelect';
    seasonSelect.innerHTML = '<option value="">Select Season</option>';

    const episodeSelect = document.createElement('select');
    episodeSelect.id = 'episodeSelect';
    episodeSelect.innerHTML = '<option value="">Select Episode</option>';
    episodeSelect.style.display = 'none';

    const sourceSelect = document.createElement('select');
    sourceSelect.id = 'sourceSelect';
    tvSources.forEach(url => {
      const opt = document.createElement('option');
      opt.value = url;
      try {
        opt.textContent = new URL(url).hostname.replace('www.', '');
      } catch {
        opt.textContent = 'Source';
      }
      sourceSelect.appendChild(opt);
    });

    seasonSelect.addEventListener('change', () => {
      const season = seasonSelect.value;
      if (!season) return;
      fetchEpisodes(item.id, season, episodeSelect);
    });

    episodeSelect.addEventListener('change', () => {
      const season = seasonSelect.value;
      const episode = episodeSelect.value;
      if (season && episode) {
        updateTvSources(item.id, season, episode, sourceSelect);
      }
    });

    sourceSelect.addEventListener('change', () => {
      document.getElementById('modalIframe').src = sourceSelect.value;
    });

    controls.appendChild(seasonSelect);
    controls.appendChild(episodeSelect);
    controls.appendChild(sourceSelect);

    fetchSeasons(item.id, seasonSelect);
  } else {
    const sourceSelect = document.createElement('select');
    movieSources.forEach(url => {
      const opt = document.createElement('option');
      opt.value = url;
      try {
        opt.textContent = new URL(url).hostname.replace('www.', '');
      } catch {
        opt.textContent = 'Source';
      }
      sourceSelect.appendChild(opt);
    });

    sourceSelect.addEventListener('change', () => {
      document.getElementById('modalIframe').src = sourceSelect.value;
    });

    controls.appendChild(sourceSelect);
    autoSelectSource(movieSources, sourceSelect);
  }

  modal.classList.add('active');
}

function closeModal() {
  modal.classList.remove('active');
  document.getElementById('modalIframe').src = '';
}

async function fetchSeasons(tvId, seasonSelect) {
  try {
    const res = await fetch(`${BASE_URL}/tv/${tvId}?api_key=${API_KEY}`).then(r => r.json());
    const seasons = (res.seasons || []).filter(s => s.season_number > 0);

    seasonSelect.innerHTML = '<option value="">Select Season</option>';
    seasons.forEach(season => {
      const opt = document.createElement('option');
      opt.value = season.season_number;
      opt.textContent = `Season ${season.season_number}`;
      seasonSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Error fetching seasons:', err);
  }
}

async function fetchEpisodes(tvId, seasonNum, episodeSelect) {
  try {
    const res = await fetch(`${BASE_URL}/tv/${tvId}/season/${seasonNum}?api_key=${API_KEY}`).then(r => r.json());
    const episodes = res.episodes || [];

    episodeSelect.innerHTML = '<option value="">Select Episode</option>';
    episodes.forEach(ep => {
      const opt = document.createElement('option');
      opt.value = ep.episode_number;
      opt.textContent = `Episode ${ep.episode_number}`;
      episodeSelect.appendChild(opt);
    });

    episodeSelect.style.display = 'inline-block';
  } catch (err) {
    console.error('Error fetching episodes:', err);
  }
}

function updateTvSources(tvId, season, episode, sourceSelect) {
  const sources = [
    `https://vidsrc.xyz/embed/tv?tmdb=${tvId}&season=${season}&episode=${episode}`,
    `https://player.vidsrc.co/embed/tv/${tvId}/${season}/${episode}`,
    `https://vidsrc.win/embed/tv?tmdb=${tvId}&season=${season}&episode=${episode}`,
  ];

  sourceSelect.innerHTML = '';
  sources.forEach(url => {
    const opt = document.createElement('option');
    opt.value = url;
    try {
      opt.textContent = new URL(url).hostname.replace('www.', '');
    } catch {
      opt.textContent = 'Source';
    }
    sourceSelect.appendChild(opt);
  });
  autoSelectSource(sources, sourceSelect);
}

async function loadMore() {
  if (isLoading || isSearching) return;
  isLoading = true;
  loadingIndicator.style.display = 'flex';

  const type = typeSelect.value;
  const genre = genreSelect.value;
  const items = await fetchMovies(currentPage, type, genre);
  allMovies.push(...items);
  items.forEach(createCard);

  currentPage++;
  loadingIndicator.style.display = 'none';
  isLoading = false;
}

async function handleSearch() {
  const query = searchInput.value.trim();
  isSearching = true;
  moviesGrid.innerHTML = '';
  emptyState.style.display = 'none';
  loadingIndicator.style.display = 'flex';

  if (!query) {
    isSearching = false;
    loadingIndicator.style.display = 'none';
    currentPage = 1;
    allMovies = [];
    await loadMore();
    return;
  }

  const type = typeSelect.value;
  let results = await searchMovies(query);

  if (type !== 'all') {
    results = results.filter(item => item.media_type === type);
  }

  allMovies = results;

  if (results.length === 0) {
    emptyState.style.display = 'block';
  } else {
    results.forEach(createCard);
  }

  loadingIndicator.style.display = 'none';
  isSearching = false;
}

searchInput.addEventListener('input', () => {
  clearTimeout(searchInput.debounceTimer);
  searchInput.debounceTimer = setTimeout(handleSearch, 500);
});

typeSelect.addEventListener('change', () => {
  populateGenreSelect();
  if (searchInput.value.trim()) {
    handleSearch();
  } else {
    moviesGrid.innerHTML = '';
    allMovies = [];
    currentPage = 1;
    loadMore();
  }
});

genreSelect.addEventListener('change', () => {
  if (searchInput.value.trim()) {
    handleSearch();
  } else {
    moviesGrid.innerHTML = '';
    allMovies = [];
    currentPage = 1;
    loadMore();
  }
});

window.addEventListener('scroll', () => {
  if (isSearching) return;
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
    loadMore();
  }
});

window.closeModal = closeModal;

loadGenres().then(() => loadMore());
