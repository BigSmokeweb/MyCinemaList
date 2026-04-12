const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_URL = 'https://image.tmdb.org/t/p/w1280';
const API_KEY = '411eb787500b2a68f84396d235f4ddc6';

const GENRES = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

let state = {
  theme: 'light',
  savedMovies: {},
  favorites: {},
  status: {},
  progress: {},
  pinned: {},
  customLists: {},
  recentlyViewed: [],

  currentApiResults: [],
  tab: 'all',
  activeCustomList: null,
  searchTimeout: null,
  heroInterval: null,
  heroIndex: 0,

  filters: { rating: 0, year: 1950, genres: [] },
  draggedMovieId: null,

  history: null,
};

const DOM = {
  html: document.documentElement,
  grid: document.getElementById('grid'),
  searchInput: document.getElementById('searchInput'),
  searchPredictions: document.getElementById('searchPredictions'),
  themeToggle: document.getElementById('themeToggle'),
  filterToggle: document.getElementById('filterToggle'),
  filterPanel: document.getElementById('filterPanel'),
  clearFiltersBtn: document.getElementById('clearFiltersBtn'),
  genreFilters: document.getElementById('genreFilters'),
  advRatingFilter: document.getElementById('advRatingFilter'),
  advYearFilter: document.getElementById('advYearFilter'),
  ratingVal: document.getElementById('ratingVal'),
  yearVal: document.getElementById('yearVal'),

  tabsContainer: document.getElementById('tabs'),
  customListsToggle: document.getElementById('customListsToggle'),
  customListsDropdown: document.getElementById('customListsDropdown'),
  customListsMenu: document.getElementById('customListsMenu'),
  newListName: document.getElementById('newListName'),
  createListBtn: document.getElementById('createListBtn'),

  heroCarousel: document.getElementById('heroCarousel'),
  carouselTrack: document.getElementById('carouselTrack'),

  continueWatchingSec: document.getElementById('continueWatchingSec'),
  continueWatchingList: document.getElementById('continueWatchingList'),
  recommendedSec: document.getElementById('recommendedSec'),
  recommendedList: document.getElementById('recommendedList'),
  recentlyViewedSec: document.getElementById('recentlyViewedSec'),
  recentlyViewedList: document.getElementById('recentlyViewedList'),

  toastContainer: document.getElementById('toast-container'),
  modal: document.getElementById('modal'),
  modalClose: document.getElementById('modalClose'),
  watchTimeBadge: document.getElementById('watchTimeBadge'),
  statWatchlist: document.getElementById('stat-watchlist'),
  statWatching: document.getElementById('stat-watching'),
  statWatched: document.getElementById('stat-watched'),
  statPinned: document.getElementById('stat-pinned'),
};

const init = () => {
  loadStateFromStorage();
  applyTheme();
  buildFilterUI();
  buildCustomListsUI();
  setupEventListeners();
  fetchPopularMovies();
};

const loadStateFromStorage = () => {
  try {
    const ls = JSON.parse(localStorage.getItem('myCinemaList_v2_data'));
    if (ls) Object.assign(state, ls);
    if (!state.customLists) state.customLists = {};
    if (!state.recentlyViewed) state.recentlyViewed = [];
    if (!state.pinned) state.pinned = {};
  } catch (e) {}
};

const saveStateToStorage = () => {
  try {
    const toSave = { ...state };
    delete toSave.currentApiResults;
    delete toSave.tab;
    delete toSave.history;
    localStorage.setItem('myCinemaList_v2_data', JSON.stringify(toSave));
    updateStatsRow();
  } catch (e) {}
};

const takeSnapshot = () => {
  state.history = JSON.stringify({
    savedMovies: state.savedMovies,
    favorites: state.favorites,
    status: state.status,
    progress: state.progress,
    pinned: state.pinned,
    customLists: state.customLists,
    recentlyViewed: state.recentlyViewed,
  });
};

const triggerUndo = () => {
  if (state.history) {
    const backup = JSON.parse(state.history);
    Object.assign(state, backup);
    state.history = null;
    saveStateToStorage();
    renderAllViews();
    showToast('Action Undone', '↩️');
  }
};

const applyTheme = () => {
  DOM.html.setAttribute('data-theme', state.theme);
  DOM.themeToggle.textContent = state.theme === 'dark' ? '☀️' : '🌙';
};

const toggleTheme = () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  saveStateToStorage();
  applyTheme();
};

const fetchFromTMDB = async (endpoint) => {
  if (!API_KEY) throw new Error('API Key Missing.');
  const url = `${BASE_URL}${endpoint}&api_key=${API_KEY}&language=en-US`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Fetch failed');
    return (await res.json()).results || [];
  } catch (err) {
    console.error(err);
    throw err;
  }
};

const fetchPopularMovies = async () => {
  renderSkeletonState();
  try {
    const res = await fetchFromTMDB('/movie/popular?page=1');
    state.currentApiResults = res;

    res.forEach((m) => (state.savedMovies[m.id] = m));
    renderAllViews();
  } catch (e) {
    renderErrorMsg(e.message);
  }
};

const renderAllViews = () => {
  renderGrid();
  renderHeroCarousel();
  renderContextualRows();
  updateStatsRow();
};

const getFilteredMovies = () => {
  let source = [];
  if (state.activeCustomList) {
    source = (state.customLists[state.activeCustomList] || [])
      .map((id) => state.savedMovies[id])
      .filter(Boolean);
  } else if (state.tab === 'all') {
    source = state.currentApiResults;
  } else if (state.tab === 'favorites') {
    source = Object.keys(state.favorites)
      .map((id) => state.savedMovies[id])
      .filter(Boolean);
  } else {
    source = Object.keys(state.status)
      .filter((id) => state.status[id] === state.tab)
      .map((id) => state.savedMovies[id])
      .filter(Boolean);
  }

  source = source.filter((m) => {
    if (m.vote_average < state.filters.rating) return false;
    const y = m.release_date ? parseInt(m.release_date.split('-')[0]) : 0;
    if (y < state.filters.year) return false;
    if (state.filters.genres.length > 0) {
      if (
        !m.genre_ids ||
        !state.filters.genres.some((g) => m.genre_ids.includes(g))
      )
        return false;
    }
    return true;
  });

  source.sort((a, b) => {
    const pinA = state.pinned[a.id] ? 1 : 0;
    const pinB = state.pinned[b.id] ? 1 : 0;
    return pinB - pinA;
  });

  return source;
};

const renderGrid = () => {
  const movies = getFilteredMovies();
  DOM.grid.innerHTML = '';
  if (!movies.length) {
    renderErrorMsg('No movies match.');
    return;
  }
  const frag = document.createDocumentFragment();
  movies.forEach((m) => frag.appendChild(createMovieCard(m)));
  DOM.grid.appendChild(frag);
};

const buildCustomListsUI = () => {
  DOM.customListsMenu.innerHTML = '';
  Object.keys(state.customLists).forEach((listName) => {
    const div = document.createElement('div');
    div.className = 'custom-list-item ripple-target';
    div.textContent = listName;
    div.onclick = () => {
      document
        .querySelectorAll('.tab')
        .forEach((t) => t.classList.remove('active'));
      DOM.customListsToggle.classList.add('active');
      DOM.customListsToggle.textContent = `${listName} ▾`;
      state.activeCustomList = listName;
      state.tab = null;
      renderAllViews();
    };
    DOM.customListsMenu.appendChild(div);
  });
};

const renderHeroCarousel = () => {
  if (
    state.tab !== 'all' ||
    state.currentApiResults.length === 0 ||
    state.activeCustomList ||
    hasFiltersActive()
  ) {
    DOM.heroCarousel.style.display = 'none';
    clearInterval(state.heroInterval);
    return;
  }

  DOM.heroCarousel.style.display = 'block';
  const topMovies = state.currentApiResults.slice(0, 5);
  DOM.carouselTrack.innerHTML = '';

  topMovies.forEach((m) => {
    const slide = document.createElement('div');
    slide.className = 'hero-slide';
    const bg = m.backdrop_path
      ? BACKDROP_URL + m.backdrop_path
      : IMG_URL + m.poster_path;
    slide.innerHTML = `
      <img src="${bg}" class="hero-banner-img">
      <div class="hero-overlay">
        <h1 class="hero-title">${m.title}</h1>
        <p class="hero-desc">${m.overview}</p>
        <div>
          <button class="btn ripple-target" onclick="tempAddToCart(${m.id})" style="background:var(--accent);color:#fff;border:none;padding:0.75rem 1.5rem;border-radius:99px;font-weight:700;cursor:pointer;">+ Watchlist</button>
        </div>
      </div>
    `;
    DOM.carouselTrack.appendChild(slide);
  });

  clearInterval(state.heroInterval);
  state.heroIndex = 0;
  updateCarouselParams();
  state.heroInterval = setInterval(() => {
    moveHero(1);
  }, 5000);
};

window.tempAddToCart = (id) => {
  takeSnapshot();
  state.status[id] = 'watchlist';
  saveStateToStorage();
  renderAllViews();
  showToastWithUndo('Added to Watchlist');
};

const moveHero = (dir) => {
  const slides = DOM.carouselTrack.children.length;
  if (!slides) return;
  state.heroIndex = (state.heroIndex + dir + slides) % slides;
  updateCarouselParams();
};

const updateCarouselParams = () => {
  DOM.carouselTrack.style.transform = `translateX(-${state.heroIndex * 100}%)`;
};

const renderContextualRows = () => {
  renderContinueWatching();
  renderRecommendations();
  renderRecentlyViewed();
};

const createMiniCard = (m) => {
  if (!m) return '';
  const isFav = state.favorites[m.id] ? '❤️' : '';
  const img = m.poster_path
    ? IMG_URL + m.poster_path
    : 'https://via.placeholder.com/200';
  const div = document.createElement('div');
  div.className = 'mini-card ripple-target';
  div.innerHTML = `<img src="${img}" class="mini-poster"><div class="mini-info">${isFav} ${m.title}</div>`;
  div.onclick = () => {
    if (!state.savedMovies[m.id]) state.savedMovies[m.id] = m;
    openModal(m);
  };
  return div;
};

const renderContinueWatching = () => {
  if (state.tab !== 'watching' && state.tab !== 'all') {
    DOM.continueWatchingSec.style.display = 'none';
    return;
  }
  const activeIds = Object.keys(state.progress).filter(
    (id) =>
      state.progress[id] > 0 &&
      state.progress[id] < 100 &&
      state.status[id] === 'watching'
  );
  if (!activeIds.length) {
    DOM.continueWatchingSec.style.display = 'none';
    return;
  }

  DOM.continueWatchingSec.style.display = 'block';
  DOM.continueWatchingList.innerHTML = '';
  activeIds.forEach((id) => {
    const c = createMiniCard(state.savedMovies[id]);
    if (c) DOM.continueWatchingList.appendChild(c);
  });
};

const renderRecentlyViewed = () => {
  if (!state.recentlyViewed.length || hasFiltersActive()) {
    DOM.recentlyViewedSec.style.display = 'none';
    return;
  }
  DOM.recentlyViewedSec.style.display = 'block';
  DOM.recentlyViewedList.innerHTML = '';
  state.recentlyViewed.forEach((id) => {
    const c = createMiniCard(state.savedMovies[id]);
    if (c) DOM.recentlyViewedList.appendChild(c);
  });
};

const renderRecommendations = async () => {
  if (state.tab !== 'all' && state.tab !== 'watched') {
    DOM.recommendedSec.style.display = 'none';
    return;
  }
  const watchedIds = Object.keys(state.status).filter(
    (id) => state.status[id] === 'watched'
  );
  if (!watchedIds.length) {
    DOM.recommendedSec.style.display = 'none';
    return;
  }

  const genreCounts = {};
  watchedIds.forEach((id) => {
    const m = state.savedMovies[id];
    if (m && m.genre_ids)
      m.genre_ids.forEach((g) => (genreCounts[g] = (genreCounts[g] || 0) + 1));
  });

  const sortedGenres = Object.keys(genreCounts).sort(
    (a, b) => genreCounts[b] - genreCounts[a]
  );
  if (!sortedGenres.length) return;
  const topGenre = sortedGenres[0];

  DOM.recommendedSec.style.display = 'block';

  if (DOM.recommendedList.dataset.topGenre === topGenre) return;
  DOM.recommendedList.innerHTML = 'Loading...';

  try {
    const res = await fetchFromTMDB(
      `/discover/movie?with_genres=${topGenre}&sort_by=vote_average.desc&vote_count.gte=1000&page=1`
    );
    DOM.recommendedList.innerHTML = '';
    DOM.recommendedList.dataset.topGenre = topGenre;

    const toRec = res
      .filter((m) => !watchedIds.includes(m.id.toString()))
      .slice(0, 10);
    toRec.forEach((m) => {
      state.savedMovies[m.id] = m;
      const c = createMiniCard(m);
      DOM.recommendedList.appendChild(c);
    });
  } catch (e) {
    DOM.recommendedSec.style.display = 'none';
  }
};

const hasFiltersActive = () =>
  state.filters.rating > 0 ||
  state.filters.year > 1950 ||
  state.filters.genres.length > 0;

const buildFilterUI = () => {
  Object.keys(GENRES).forEach((gid) => {
    const btn = document.createElement('button');
    btn.className = 'genre-pill';
    btn.textContent = GENRES[gid];
    btn.onclick = () => {
      btn.classList.toggle('active');
      const iId = parseInt(gid);
      if (btn.classList.contains('active')) state.filters.genres.push(iId);
      else state.filters.genres = state.filters.genres.filter((g) => g !== iId);
      renderAllViews();
    };
    DOM.genreFilters.appendChild(btn);
  });
};

const createMovieCard = (movie) => {
  const status = state.status[movie.id] || '';
  const isFav = state.favorites[movie.id] ? 'favorited' : '';
  const isPinned = state.pinned[movie.id] ? 'pinned-btn' : '';
  const posterUrl = movie.poster_path
    ? IMG_URL + movie.poster_path
    : 'https://via.placeholder.com/500x750/333/555?text=No+Poster';

  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = movie.id;
  card.dataset.status = status;
  card.dataset.pinned = state.pinned[movie.id] ? 'true' : 'false';
  card.dataset.movieStr = encodeURIComponent(JSON.stringify(movie));
  card.setAttribute('draggable', 'true');

  let progHTML = '';
  if (status === 'watching') {
    const v = state.progress[movie.id] || 0;
    progHTML = `<div class="progress-container"><p>Progr: <span class="p-text">${v}%</span></p><input type="range" class="progress-slider" min="0" max="100" value="${v}"></div>`;
  }

  card.innerHTML = `
    <div class="card-poster">
      <div class="pin-badge">📌 PINNED</div>
      <div class="rating-badge">⭐ ${(movie.vote_average || 0).toFixed(1)}</div>
      <div class="controls-overlay">
        <button class="overlay-btn ${isFav}" data-action="fav">❤️</button>
        <button class="overlay-btn ${isPinned}" data-action="pin">📌</button>
      </div>
      <div class="card-hover-overlay"><p>${movie.overview || 'N/A'}</p></div>
      <img src="${posterUrl}" loading="lazy">
    </div>
    ${progHTML}
    <div class="card-content">
      <h3 class="card-title">${movie.title}</h3>
      <div class="card-year">${movie.release_date ? movie.release_date.substring(0, 4) : 'N/A'}</div>
      <div class="card-actions">
        <button class="action-btn btn-watchlist ripple-target" data-action="status" data-val="watchlist">Watchlist</button>
        <button class="action-btn btn-watching ripple-target" data-action="status" data-val="watching">Watching</button>
        <button class="action-btn btn-watched ripple-target" data-action="status" data-val="watched">Watched</button>
      </div>
    </div>
  `;

  const slider = card.querySelector('.progress-slider');
  if (slider) {
    slider.style.background = `linear-gradient(to right, var(--yellow) ${slider.value}%, var(--bg) ${slider.value}%)`;
    slider.addEventListener('input', (e) => {
      card.querySelector('.p-text').textContent = `${e.target.value}%`;
      e.target.style.background = `linear-gradient(to right, var(--yellow) ${e.target.value}%, var(--bg) ${e.target.value}%)`;
    });
    slider.addEventListener('change', (e) => {
      state.progress[movie.id] = parseInt(e.target.value);
      saveStateToStorage();
    });
  }

  card.addEventListener('dragstart', (e) => {
    state.draggedMovieId = movie.id;
    e.target.style.opacity = '0.5';
  });
  card.addEventListener('dragend', (e) => (e.target.style.opacity = '1'));

  return card;
};

const updateStatsRow = () => {
  const wlCount = Object.values(state.status).filter(
    (v) => v === 'watchlist'
  ).length;
  DOM.statWatchlist.textContent = wlCount;
  DOM.statWatching.textContent = Object.values(state.status).filter(
    (v) => v === 'watching'
  ).length;
  DOM.statWatched.textContent = Object.values(state.status).filter(
    (v) => v === 'watched'
  ).length;
  DOM.statPinned.textContent = Object.keys(state.pinned).length;

  const hrs = Math.floor((wlCount * 120) / 60);
  DOM.watchTimeBadge.textContent = `${hrs}h Total`;
};

const renderSkeletonState = () => {
  DOM.grid.innerHTML = Array(12)
    .fill(
      '<div class="skeleton-card"><div class="skeleton-img"></div><div class="skeleton-content"><div class="skeleton-line title"></div><div class="skeleton-line year"></div><div class="skeleton-box"></div></div></div>'
    )
    .join('');
};
const renderErrorMsg = (m) =>
  (DOM.grid.innerHTML = `<div class="message-container error"><h2>Oops</h2><p>${m}</p></div>`);

const setupEventListeners = () => {
  DOM.themeToggle.addEventListener('click', toggleTheme);

  DOM.filterToggle.addEventListener('click', () =>
    DOM.filterPanel.classList.toggle('collapsed')
  );
  DOM.advRatingFilter.addEventListener(
    'input',
    (e) => (DOM.ratingVal.textContent = e.target.value)
  );
  DOM.advRatingFilter.addEventListener('change', (e) => {
    state.filters.rating = parseFloat(e.target.value);
    renderAllViews();
  });
  DOM.advYearFilter.addEventListener(
    'input',
    (e) => (DOM.yearVal.textContent = e.target.value)
  );
  DOM.advYearFilter.addEventListener('change', (e) => {
    state.filters.year = parseInt(e.target.value);
    renderAllViews();
  });
  DOM.clearFiltersBtn.addEventListener('click', () => {
    state.filters = { rating: 0, year: 1950, genres: [] };
    DOM.advRatingFilter.value = 0;
    DOM.ratingVal.textContent = 0;
    DOM.advYearFilter.value = 1950;
    DOM.yearVal.textContent = 'All Time';
    document
      .querySelectorAll('.genre-pill')
      .forEach((p) => p.classList.remove('active'));
    renderAllViews();
  });

  document.getElementById('carouselPrev').onclick = () => moveHero(-1);
  document.getElementById('carouselNext').onclick = () => moveHero(1);

  document.querySelectorAll('.tab').forEach((btn) => {
    if (btn.classList.contains('special-tab')) return;
    btn.addEventListener('click', (e) => {
      document
        .querySelectorAll('.tab')
        .forEach((t) => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      DOM.customListsToggle.textContent = 'Lists ▾';
      state.tab = e.currentTarget.dataset.tab;
      state.activeCustomList = null;
      renderAllViews();
    });
    if (btn.classList.contains('dropzone')) {
      btn.addEventListener('dragover', (e) => e.preventDefault());
      btn.addEventListener('dragenter', (e) =>
        e.currentTarget.classList.add('drag-over')
      );
      btn.addEventListener('dragleave', (e) =>
        e.currentTarget.classList.remove('drag-over')
      );
      btn.addEventListener('drop', (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        if (state.draggedMovieId) {
          takeSnapshot();
          state.status[state.draggedMovieId] = e.currentTarget.dataset.tab;
          saveStateToStorage();
          renderAllViews();
          showToastWithUndo(`Moved to ${e.currentTarget.dataset.tab}`);
        }
      });
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-lists-container'))
      DOM.customListsDropdown.classList.remove('active');
    else DOM.customListsDropdown.classList.add('active');
  });
  DOM.createListBtn.onclick = (e) => {
    e.stopPropagation();
    const val = DOM.newListName.value.trim();
    if (val && !state.customLists[val]) {
      state.customLists[val] = [];
      DOM.newListName.value = '';
      saveStateToStorage();
      buildCustomListsUI();
      showToast(`Created List: ${val}`, '📝');
    }
  };

  DOM.grid.addEventListener('click', handleGridClick);
  DOM.modalClose.addEventListener('click', closeModal);
  DOM.modal.addEventListener('click', (e) => {
    if (e.target === DOM.modal) closeModal();
  });

  DOM.searchInput.addEventListener('input', (e) => {
    clearTimeout(state.searchTimeout);
    const q = e.target.value.trim();
    if (!q) {
      DOM.searchPredictions.classList.remove('active');
      DOM.searchPredictions.innerHTML = '';
      fetchPopularMovies();
      return;
    }
    state.searchTimeout = setTimeout(() => fetchSearchResults(q), 350);
  });

  DOM.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      DOM.searchInput.value = '';
      DOM.searchPredictions.classList.remove('active');
      DOM.searchPredictions.innerHTML = '';
      fetchPopularMovies();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.input-wrapper')) {
      DOM.searchPredictions.classList.remove('active');
    }
  });

  document.addEventListener('click', (e) => applyRipple(e));
};

const fetchSearchResults = async (query) => {
  try {
    const res = await fetchFromTMDB(
      `/search/movie?query=${encodeURIComponent(query)}&page=1`
    );
    state.currentApiResults = res;
    res.forEach((m) => (state.savedMovies[m.id] = m));

    DOM.searchPredictions.innerHTML = '';
    const top5 = res.slice(0, 5);
    if (top5.length) {
      top5.forEach((m) => {
        const item = document.createElement('div');
        item.className = 'prediction-item';
        const img = m.poster_path
          ? IMG_URL + m.poster_path
          : 'https://via.placeholder.com/30x45/333/555?text=?';
        const year = m.release_date ? m.release_date.substring(0, 4) : 'N/A';
        item.innerHTML = `<img class="prediction-img" src="${img}" loading="lazy"><div class="prediction-info"><span class="prediction-title">${m.title}</span><span class="prediction-year">${year}</span></div>`;
        item.addEventListener('click', () => {
          DOM.searchInput.value = m.title;
          DOM.searchPredictions.classList.remove('active');
          openModal(m);
        });
        DOM.searchPredictions.appendChild(item);
      });
      DOM.searchPredictions.classList.add('active');
    } else {
      DOM.searchPredictions.classList.remove('active');
    }

    renderGrid();
  } catch (e) {
    renderErrorMsg('Search failed. Please try again.');
  }
};

const handleGridClick = (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  const btn = e.target.closest('button[data-action]');
  const id = Number(card.dataset.id);

  if (btn) {
    e.stopPropagation();
    takeSnapshot();
    const act = btn.dataset.action;
    if (act === 'fav') {
      if (state.favorites[id]) delete state.favorites[id];
      else state.favorites[id] = true;
      showToastWithUndo('Favorites updated');
    } else if (act === 'pin') {
      if (state.pinned[id]) delete state.pinned[id];
      else state.pinned[id] = true;
      showToastWithUndo('Pins updated');
    } else if (act === 'status') {
      const v = btn.dataset.val;
      if (state.status[id] === v) delete state.status[id];
      else state.status[id] = v;
      showToastWithUndo(`Status updated`);
    }
    saveStateToStorage();
    renderAllViews();
    return;
  }
  if (e.target.closest('.progress-container')) return;

  openModal(state.savedMovies[id]);
};

const showToastWithUndo = (msg) => showToast(msg, '✅', true);
const showToast = (msg, icon, undoable = false) => {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${msg}</span>`;
  if (undoable) {
    const btn = document.createElement('button');
    btn.className = 'undo-btn ripple-target';
    btn.textContent = 'Undo';
    btn.onclick = () => {
      triggerUndo();
      t.remove();
    };
    t.appendChild(btn);
  }
  DOM.toastContainer.appendChild(t);
  setTimeout(() => {
    if (t.parentElement) {
      t.classList.add('hide');
      setTimeout(() => t.remove(), 300);
    }
  }, 5000);
};

const openModal = (m) => {
  state.recentlyViewed = [
    m.id,
    ...state.recentlyViewed.filter((i) => i !== m.id),
  ].slice(0, 10);
  saveStateToStorage();

  DOM.modal.classList.add('active');
  document.getElementById('m-img').src = m.poster_path
    ? IMG_URL + m.poster_path
    : '';
  document.getElementById('m-title').textContent = m.title;
  document.getElementById('m-year').textContent = m.release_date
    ? m.release_date.split('-')[0]
    : '';
  document.getElementById('m-rating').textContent =
    `⭐ ${(m.vote_average || 0).toFixed(1)}`;
  document.getElementById('m-genres').textContent = m.genre_ids
    ? m.genre_ids
        .map((g) => GENRES[g])
        .filter(Boolean)
        .join(', ')
    : 'Unknown';
  document.getElementById('m-desc').textContent = m.overview || 'NA';

  const listCont = document.getElementById('m-custom-lists');
  listCont.innerHTML = `<h4 style="margin-bottom:0.5rem;color:var(--text)">Add to Lists:</h4>`;
  Object.keys(state.customLists).forEach((listName) => {
    const inList = state.customLists[listName].includes(m.id);
    const box = document.createElement('div');
    box.className = 'modal-list-toggle';
    box.innerHTML = `<span>${listName}</span> <button class="btn ${inList ? 'added' : ''}" style="padding:0.2rem 0.5rem;font-size:0.7rem;background:var(--bg);border:1px solid var(--border);border-radius:4px;cursor:pointer;color:var(--text)">${inList ? 'Remove' : 'Add'}</button>`;
    box.querySelector('button').onclick = () => {
      if (inList)
        state.customLists[listName] = state.customLists[listName].filter(
          (x) => x !== m.id
        );
      else state.customLists[listName].push(m.id);
      saveStateToStorage();
      openModal(m);
    };
    listCont.appendChild(box);
  });
};
const closeModal = () => {
  DOM.modal.classList.remove('active');
  renderAllViews();
};

function applyRipple(e) {
  const target = e.target.closest('.ripple-target');
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const circle = document.createElement('span');
  const diameter = Math.max(rect.width, rect.height);
  const radius = diameter / 2;
  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${e.clientX - rect.left - radius}px`;
  circle.style.top = `${e.clientY - rect.top - radius}px`;
  circle.classList.add('ripple');
  const existing = target.querySelector('.ripple');
  if (existing) existing.remove();
  target.appendChild(circle);
}

document.addEventListener('DOMContentLoaded', init);
