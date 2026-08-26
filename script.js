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

// ─── Global State ─────────────────────────────────────────────
let state = {
  theme: 'light',
  user: null,           // Authenticated user object or null
  token: null,          // JWT access token
  
  savedMovies: {},      // id -> movie object
  favorites: {},        // id -> boolean
  status: {},           // id -> 'watchlist' | 'watching' | 'watched'
  progress: {},         // id -> number
  pinned: {},           // id -> boolean
  customLists: {},      // listName -> [movieId]
  recentlyViewed: [],   // [movieId]

  // Journaling / Movie Logs
  journalEntries: {},   // id -> { feeling, personal_notes, started_at, ended_at, user_rating }

  currentApiResults: [],
  tab: 'all',
  activeCustomList: null,
  searchTimeout: null,
  heroInterval: null,
  heroIndex: 0,

  filters: { rating: 0, year: 1950, genres: [] },
  draggedMovieId: null,
  currentModalMovie: null,
  history: null,
};

// ─── DOM Elements Cache ───────────────────────────────────────
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
  statJournal: document.getElementById('stat-journal'),
  statJournalPill: document.getElementById('statJournalPill'),

  // Auth & Profile
  authBtn: document.getElementById('authBtn'),
  authBtnText: document.getElementById('authBtnText'),
  authBtnIcon: document.getElementById('authBtnIcon'),
  authModal: document.getElementById('authModal'),
  authModalClose: document.getElementById('authModalClose'),
  authModalTitle: document.getElementById('authModalTitle'),
  authModalSubtitle: document.getElementById('authModalSubtitle'),
  tabSignIn: document.getElementById('tabSignIn'),
  tabSignUp: document.getElementById('tabSignUp'),
  authAlert: document.getElementById('authAlert'),
  authForm: document.getElementById('authForm'),
  authUsername: document.getElementById('authUsername'),
  authEmail: document.getElementById('authEmail'),
  authPassword: document.getElementById('authPassword'),
  usernameField: document.getElementById('usernameField'),
  emailField: document.getElementById('emailField'),
  authSubmitBtn: document.getElementById('authSubmitBtn'),
  authSwitchBtn: document.getElementById('authSwitchBtn'),
  authSwitchPrompt: document.getElementById('authSwitchPrompt'),

  profileModal: document.getElementById('profileModal'),
  profileModalClose: document.getElementById('profileModalClose'),
  profileUsername: document.getElementById('profileUsername'),
  profileEmail: document.getElementById('profileEmail'),
  profileJoinDate: document.getElementById('profileJoinDate'),
  profileBioInput: document.getElementById('profileBioInput'),
  saveBioBtn: document.getElementById('saveBioBtn'),
  pStatWatchlist: document.getElementById('pStatWatchlist'),
  pStatWatching: document.getElementById('pStatWatching'),
  pStatWatched: document.getElementById('pStatWatched'),
  pStatJournal: document.getElementById('pStatJournal'),
  logoutBtn: document.getElementById('logoutBtn'),

  // Journal View & Modal Fields
  journalSection: document.getElementById('journalSection'),
  journalGrid: document.getElementById('journalGrid'),
  tabJournal: document.getElementById('tabJournal'),
  feelingsGroup: document.getElementById('feelingsGroup'),
  watchStartedAt: document.getElementById('watchStartedAt'),
  watchEndedAt: document.getElementById('watchEndedAt'),
  userPersonalRating: document.getElementById('userPersonalRating'),
  userScoreDisplay: document.getElementById('userScoreDisplay'),
  personalNotesInput: document.getElementById('personalNotesInput'),
  saveJournalBtn: document.getElementById('saveJournalBtn'),
  saveStatusIndicator: document.getElementById('saveStatusIndicator'),
  journalSyncStatus: document.getElementById('journalSyncStatus'),
};

let currentAuthMode = 'signin'; // 'signin' or 'signup'
let selectedFeeling = null;

// ─── Initialization ──────────────────────────────────────────
const init = async () => {
  loadStateFromStorage();
  applyTheme();
  buildFilterUI();
  buildCustomListsUI();
  setupEventListeners();
  setupAuthEventListeners();
  setupJournalEventListeners();

  // Try auto-login if token stored
  if (state.token) {
    await fetchUserProfileAndSync();
  }

  fetchPopularMovies();
};

// ─── Local & Remote State Management ─────────────────────────
const loadStateFromStorage = () => {
  try {
    const token = localStorage.getItem('myCinemaList_token');
    if (token) state.token = token;

    const user = JSON.parse(localStorage.getItem('myCinemaList_user'));
    if (user) state.user = user;

    const ls = JSON.parse(localStorage.getItem('myCinemaList_v2_data'));
    if (ls) Object.assign(state, ls);
    if (!state.customLists) state.customLists = {};
    if (!state.recentlyViewed) state.recentlyViewed = [];
    if (!state.pinned) state.pinned = {};
    if (!state.journalEntries) state.journalEntries = {};

    updateUserAuthUI();
  } catch (e) {
    console.error('Local state load error', e);
  }
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

// ─── API Helper Service ──────────────────────────────────────
const apiFetch = async (endpoint, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  const res = await fetch(endpoint, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'API Error' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
};

// ─── Authentication Handlers ─────────────────────────────────
const updateUserAuthUI = () => {
  if (state.user) {
    DOM.authBtn.classList.add('logged-in');
    DOM.authBtnIcon.textContent = '👤';
    DOM.authBtnText.textContent = state.user.username;
    DOM.statJournalPill.style.display = 'inline-flex';
    DOM.journalSyncStatus.textContent = '☁️ Synced to your profile';
  } else {
    DOM.authBtn.classList.remove('logged-in');
    DOM.authBtnIcon.textContent = '👤';
    DOM.authBtnText.textContent = 'Sign In';
    DOM.statJournalPill.style.display = 'none';
    DOM.journalSyncStatus.textContent = 'Saved locally (Sign in to sync)';
  }
};

const fetchUserProfileAndSync = async () => {
  try {
    const data = await apiFetch('/api/user/sync');
    state.user = data.user;
    localStorage.setItem('myCinemaList_user', JSON.stringify(state.user));

    // Populate state with remote data
    if (data.movie_logs) {
      data.movie_logs.forEach((log) => {
        const mid = log.movie_id;
        if (log.status) state.status[mid] = log.status;
        if (log.is_pinned) state.pinned[mid] = true;
        if (log.is_favorite) state.favorites[mid] = true;

        state.journalEntries[mid] = {
          feeling: log.feeling,
          personal_notes: log.personal_notes,
          started_at: log.started_at,
          ended_at: log.ended_at,
          user_rating: log.user_rating || 0,
        };

        if (log.movie_meta_json) {
          try {
            state.savedMovies[mid] = JSON.parse(log.movie_meta_json);
          } catch (e) {}
        }
      });
    }

    if (data.custom_lists) {
      state.customLists = {};
      data.custom_lists.forEach((cl) => {
        state.customLists[cl.name] = (cl.items || []).map((i) => i.movie_id);
      });
    }

    saveStateToStorage();
    updateUserAuthUI();
    buildCustomListsUI();
    renderAllViews();
  } catch (err) {
    console.warn('Sync failed (token might be expired):', err.message);
    logoutUser(false);
  }
};

const logoutUser = (notify = true) => {
  state.token = null;
  state.user = null;
  localStorage.removeItem('myCinemaList_token');
  localStorage.removeItem('myCinemaList_user');
  updateUserAuthUI();
  DOM.profileModal.style.display = 'none';
  if (notify) showToast('Logged out successfully', '👋');
  renderAllViews();
};

const setupAuthEventListeners = () => {
  DOM.authBtn.addEventListener('click', () => {
    if (state.user) {
      openProfileModal();
    } else {
      openAuthModal('signin');
    }
  });

  DOM.authModalClose.addEventListener('click', () => {
    DOM.authModal.style.display = 'none';
  });

  DOM.profileModalClose.addEventListener('click', () => {
    DOM.profileModal.style.display = 'none';
  });

  DOM.tabSignIn.addEventListener('click', () => switchAuthMode('signin'));
  DOM.tabSignUp.addEventListener('click', () => switchAuthMode('signup'));
  DOM.authSwitchBtn.addEventListener('click', () => {
    switchAuthMode(currentAuthMode === 'signin' ? 'signup' : 'signin');
  });

  DOM.authForm.addEventListener('submit', handleAuthSubmit);
  DOM.logoutBtn.addEventListener('click', () => logoutUser(true));

  DOM.saveBioBtn.addEventListener('click', async () => {
    const bio = DOM.profileBioInput.value.trim();
    try {
      const updated = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ bio }),
      });
      state.user = updated;
      localStorage.setItem('myCinemaList_user', JSON.stringify(state.user));
      showToast('Bio updated', '✨');
    } catch (err) {
      showToast(err.message, '⚠️');
    }
  });
};

const openAuthModal = (mode = 'signin') => {
  DOM.authAlert.style.display = 'none';
  switchAuthMode(mode);
  DOM.authModal.style.display = 'flex';
};

const switchAuthMode = (mode) => {
  currentAuthMode = mode;
  DOM.authAlert.style.display = 'none';
  if (mode === 'signin') {
    DOM.tabSignIn.classList.add('active');
    DOM.tabSignUp.classList.remove('active');
    DOM.authModalTitle.textContent = 'Welcome Back';
    DOM.authModalSubtitle.textContent = 'Sign in to access your cloud watchlist and journal entries.';
    DOM.emailField.style.display = 'none';
    DOM.authSubmitBtn.textContent = 'Sign In';
    DOM.authSwitchPrompt.textContent = "Don't have an account?";
    DOM.authSwitchBtn.textContent = 'Sign Up';
  } else {
    DOM.tabSignUp.classList.add('active');
    DOM.tabSignIn.classList.remove('active');
    DOM.authModalTitle.textContent = 'Create Profile';
    DOM.authModalSubtitle.textContent = 'Create an account to start logging films, reviews, and notes.';
    DOM.emailField.style.display = 'flex';
    DOM.authSubmitBtn.textContent = 'Create Account';
    DOM.authSwitchPrompt.textContent = 'Already have an account?';
    DOM.authSwitchBtn.textContent = 'Sign In';
  }
};

const handleAuthSubmit = async (e) => {
  e.preventDefault();
  DOM.authAlert.style.display = 'none';
  const username = DOM.authUsername.value.trim();
  const email = DOM.authEmail.value.trim();
  const password = DOM.authPassword.value;

  if (!username || !password || (currentAuthMode === 'signup' && !email)) {
    DOM.authAlert.textContent = 'Please fill in all required fields.';
    DOM.authAlert.style.display = 'block';
    return;
  }

  DOM.authSubmitBtn.disabled = true;
  DOM.authSubmitBtn.textContent = 'Processing...';

  try {
    let resp;
    if (currentAuthMode === 'signup') {
      resp = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });
    } else {
      resp = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username_or_email: username, password }),
      });
    }

    state.token = resp.access_token;
    state.user = resp.user;
    localStorage.setItem('myCinemaList_token', state.token);
    localStorage.setItem('myCinemaList_user', JSON.stringify(state.user));

    DOM.authModal.style.display = 'none';
    DOM.authForm.reset();
    showToast(`Welcome, ${state.user.username}!`, '🎉');

    await fetchUserProfileAndSync();
  } catch (err) {
    DOM.authAlert.textContent = err.message;
    DOM.authAlert.style.display = 'block';
  } finally {
    DOM.authSubmitBtn.disabled = false;
    DOM.authSubmitBtn.textContent = currentAuthMode === 'signup' ? 'Create Account' : 'Sign In';
  }
};

const openProfileModal = () => {
  if (!state.user) return;
  DOM.profileUsername.textContent = state.user.username;
  DOM.profileEmail.textContent = state.user.email;
  DOM.profileBioInput.value = state.user.bio || '';
  
  if (state.user.created_at) {
    const d = new Date(state.user.created_at);
    DOM.profileJoinDate.textContent = `Member since ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  }

  // Count stats
  const watchlistCount = Object.values(state.status).filter((s) => s === 'watchlist').length;
  const watchingCount = Object.values(state.status).filter((s) => s === 'watching').length;
  const watchedCount = Object.values(state.status).filter((s) => s === 'watched').length;
  const journalCount = Object.values(state.journalEntries).filter((j) => j && (j.personal_notes || j.feeling)).length;

  DOM.pStatWatchlist.textContent = watchlistCount;
  DOM.pStatWatching.textContent = watchingCount;
  DOM.pStatWatched.textContent = watchedCount;
  DOM.pStatJournal.textContent = journalCount;

  DOM.profileModal.style.display = 'flex';
};

// ─── Journal & Movie Notes Handling ──────────────────────────
const setupJournalEventListeners = () => {
  // Feeling Pill Selection
  DOM.feelingsGroup.querySelectorAll('.feeling-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const feeling = btn.dataset.feeling;
      if (selectedFeeling === feeling) {
        selectedFeeling = null;
        btn.classList.remove('active');
      } else {
        selectedFeeling = feeling;
        DOM.feelingsGroup.querySelectorAll('.feeling-pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      }
    });
  });

  // User personal score range slider
  DOM.userPersonalRating.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    DOM.userScoreDisplay.textContent = v > 0 ? `⭐ ${v.toFixed(1)} / 10` : 'Not Rated';
  });

  // Save Journal Entry Button
  DOM.saveJournalBtn.addEventListener('click', saveCurrentMovieJournal);
};

const populateJournalModalFields = (movie) => {
  state.currentModalMovie = movie;
  const journal = state.journalEntries[movie.id] || {};

  // Reset & Set Feelings
  selectedFeeling = journal.feeling || null;
  DOM.feelingsGroup.querySelectorAll('.feeling-pill').forEach((b) => {
    b.classList.toggle('active', b.dataset.feeling === selectedFeeling);
  });

  // Dates
  DOM.watchStartedAt.value = journal.started_at || '';
  DOM.watchEndedAt.value = journal.ended_at || '';

  // Rating
  const rating = journal.user_rating || 0;
  DOM.userPersonalRating.value = rating;
  DOM.userScoreDisplay.textContent = rating > 0 ? `⭐ ${rating.toFixed(1)} / 10` : 'Not Rated';

  // Notes
  DOM.personalNotesInput.value = journal.personal_notes || '';
  DOM.saveStatusIndicator.textContent = '';
};

const saveCurrentMovieJournal = async () => {
  const movie = state.currentModalMovie;
  if (!movie) return;

  const notes = DOM.personalNotesInput.value.trim();
  const startedAt = DOM.watchStartedAt.value || null;
  const endedAt = DOM.watchEndedAt.value || null;
  const rating = parseFloat(DOM.userPersonalRating.value) || 0;

  const journalData = {
    feeling: selectedFeeling,
    personal_notes: notes,
    started_at: startedAt,
    ended_at: endedAt,
    user_rating: rating,
  };

  // Local state update
  state.journalEntries[movie.id] = journalData;
  state.savedMovies[movie.id] = movie;
  saveStateToStorage();

  DOM.saveStatusIndicator.textContent = '💾 Saving...';

  // Cloud API sync if user is logged in
  if (state.token) {
    try {
      await apiFetch('/api/journal/movies', {
        method: 'POST',
        body: JSON.stringify({
          movie_id: movie.id,
          status: state.status[movie.id] || 'watchlist',
          is_pinned: !!state.pinned[movie.id],
          is_favorite: !!state.favorites[movie.id],
          user_rating: rating,
          feeling: selectedFeeling,
          personal_notes: notes,
          started_at: startedAt,
          ended_at: endedAt,
          movie_meta_json: JSON.stringify({
            id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            backdrop_path: movie.backdrop_path,
            release_date: movie.release_date,
            vote_average: movie.vote_average,
            genre_ids: movie.genre_ids,
            overview: movie.overview,
          }),
        }),
      });
      DOM.saveStatusIndicator.textContent = '✅ Synced to cloud!';
    } catch (e) {
      DOM.saveStatusIndicator.textContent = 'Saved locally (offline)';
    }
  } else {
    DOM.saveStatusIndicator.textContent = '✅ Saved locally!';
  }

  showToast('Journal entry saved!', '📝');
  renderAllViews();
  setTimeout(() => {
    DOM.saveStatusIndicator.textContent = '';
  }, 2500);
};

// ─── Dedicated Journal Feed / Diary View ──────────────────────
const renderJournalFeed = () => {
  DOM.journalGrid.innerHTML = '';
  const loggedIds = Object.keys(state.journalEntries).filter((id) => {
    const j = state.journalEntries[id];
    return j && (j.personal_notes || j.feeling || j.started_at || j.ended_at || j.user_rating > 0);
  });

  if (loggedIds.length === 0) {
    DOM.journalGrid.innerHTML = `
      <div class="journal-empty-state">
        <div class="icon">📖</div>
        <h3>Your Movie Journal is Empty</h3>
        <p>Search for movies, open their details, and write notes or record how you felt watching them!</p>
      </div>
    `;
    return;
  }

  loggedIds.reverse().forEach((id) => {
    const movie = state.savedMovies[id] || { id: Number(id), title: `Movie #${id}` };
    const j = state.journalEntries[id];

    const card = document.createElement('div');
    card.className = 'journal-card ripple-target';
    
    const posterSrc = movie.poster_path ? IMG_URL + movie.poster_path : '';
    const dateText = [
      j.started_at ? `Started: ${j.started_at}` : '',
      j.ended_at ? `Finished: ${j.ended_at}` : ''
    ].filter(Boolean).join(' • ');

    card.innerHTML = `
      <div class="journal-card-top">
        ${posterSrc ? `<img src="${posterSrc}" alt="${movie.title}" class="journal-card-poster" />` : ''}
        <div class="journal-card-meta">
          <div class="journal-card-title">${movie.title || 'Unknown Title'}</div>
          ${j.feeling ? `<span class="journal-feeling-badge">${j.feeling}</span>` : ''}
          ${j.user_rating > 0 ? `<span style="font-size:0.85rem;color:var(--yellow);font-weight:700;">⭐ ${j.user_rating.toFixed(1)} / 10</span>` : ''}
          ${dateText ? `<div class="journal-card-dates">${dateText}</div>` : ''}
        </div>
      </div>
      <div class="journal-card-body">
        ${j.personal_notes ? j.personal_notes : '<em style="color:var(--subtext)">No notes written yet.</em>'}
      </div>
    `;

    card.onclick = () => openModal(movie);
    DOM.journalGrid.appendChild(card);
  });
};

// ─── Standard Views, Filter & Grid Rendering ─────────────────
const takeSnapshot = () => {
  state.history = JSON.stringify({
    savedMovies: state.savedMovies,
    favorites: state.favorites,
    status: state.status,
    progress: state.progress,
    pinned: state.pinned,
    customLists: state.customLists,
    recentlyViewed: state.recentlyViewed,
    journalEntries: state.journalEntries,
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
  try {
    // Attempt to fetch from backend proxy first
    const proxyUrl = endpoint.startsWith('/search/movie')
      ? `/api/movies/search?query=${encodeURIComponent(new URLSearchParams(endpoint.split('?')[1]).get('query') || '')}`
      : endpoint.startsWith('/movie/popular')
      ? '/api/movies/popular'
      : `${BASE_URL}${endpoint}&api_key=${API_KEY}&language=en-US`;

    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error('Proxy fetch failed');
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    // Fallback to direct TMDB API if proxy has network issues
    const directUrl = `${BASE_URL}${endpoint}&api_key=${API_KEY}&language=en-US`;
    const res = await fetch(directUrl);
    return (await res.json()).results || [];
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
  if (state.tab === 'journal') {
    DOM.grid.style.display = 'none';
    DOM.heroCarousel.style.display = 'none';
    DOM.continueWatchingSec.style.display = 'none';
    DOM.recommendedSec.style.display = 'none';
    DOM.recentlyViewedSec.style.display = 'none';
    DOM.journalSection.style.display = 'block';
    renderJournalFeed();
  } else {
    DOM.grid.style.display = 'grid';
    DOM.journalSection.style.display = 'none';
    renderGrid();
    renderHeroCarousel();
    renderContextualRows();
  }
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
      if (!m.genre_ids || !state.filters.genres.some((g) => m.genre_ids.includes(g)))
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
    renderErrorMsg('No movies match the current tab/filter.');
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
      state.activeCustomList = listName;
      state.tab = null;
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      DOM.customListsDropdown.classList.remove('active');
      renderAllViews();
    };
    DOM.customListsMenu.appendChild(div);
  });
};

const updateStatsRow = () => {
  let watchlist = 0, watching = 0, watched = 0, pinned = 0, journalCount = 0;
  Object.values(state.status).forEach((s) => {
    if (s === 'watchlist') watchlist++;
    if (s === 'watching') watching++;
    if (s === 'watched') watched++;
  });
  pinned = Object.keys(state.pinned).length;
  journalCount = Object.values(state.journalEntries).filter((j) => j && (j.personal_notes || j.feeling)).length;

  DOM.statWatchlist.textContent = watchlist;
  DOM.statWatching.textContent = watching;
  DOM.statWatched.textContent = watched;
  DOM.statPinned.textContent = pinned;
  if (DOM.statJournal) DOM.statJournal.textContent = journalCount;
  DOM.watchTimeBadge.textContent = `${watched * 2}h`;
};

const createMovieCard = (m) => {
  const card = document.createElement('div');
  card.className = 'card ripple-target';
  card.dataset.id = m.id;
  card.draggable = true;

  const isFav = !!state.favorites[m.id];
  const isPin = !!state.pinned[m.id];
  const curStatus = state.status[m.id] || '';
  const journal = state.journalEntries[m.id];

  const posterPath = m.poster_path ? IMG_URL + m.poster_path : '';
  const year = m.release_date ? m.release_date.split('-')[0] : 'N/A';
  const rating = (m.vote_average || 0).toFixed(1);

  card.innerHTML = `
    <div class="poster-box">
      ${posterPath ? `<img src="${posterPath}" alt="${m.title}" loading="lazy" />` : '<div style="height:100%;display:flex;align-items:center;justify-content:center;">No Image</div>'}
      ${isPin ? '<span class="pinned-badge">📌 Pinned</span>' : ''}
      ${journal && journal.feeling ? `<span class="pinned-badge" style="top:auto;bottom:8px;background:rgba(0,0,0,0.75);">${journal.feeling}</span>` : ''}
      <div class="card-overlay">
        <button class="icon-btn ripple-target ${isFav ? 'active-fav' : ''}" data-action="fav" title="Favorite">❤️</button>
        <button class="icon-btn ripple-target ${isPin ? 'active-pin' : ''}" data-action="pin" title="Pin">📌</button>
      </div>
    </div>
    <div class="card-info">
      <div class="card-title">${m.title}</div>
      <div class="card-meta">
        <span>${year}</span>
        <span class="card-rating">⭐ ${rating}</span>
      </div>
      <div class="status-btn-group">
        <button class="btn-status ripple-target ${curStatus === 'watchlist' ? 'active' : ''}" data-action="status" data-val="watchlist">Watchlist</button>
        <button class="btn-status ripple-target ${curStatus === 'watching' ? 'active' : ''}" data-action="status" data-val="watching">Watching</button>
        <button class="btn-status ripple-target ${curStatus === 'watched' ? 'active' : ''}" data-action="status" data-val="watched">Watched</button>
      </div>
    </div>
  `;

  card.addEventListener('dragstart', (e) => {
    state.draggedMovieId = m.id;
    e.dataTransfer.setData('text/plain', m.id);
  });

  return card;
};

const renderHeroCarousel = () => {
  if (state.tab !== 'all' || !state.currentApiResults.length) {
    DOM.heroCarousel.style.display = 'none';
    clearInterval(state.heroInterval);
    return;
  }
  DOM.heroCarousel.style.display = 'block';
  DOM.carouselTrack.innerHTML = '';
  const topMovies = state.currentApiResults.slice(0, 5);

  topMovies.forEach((m, idx) => {
    const slide = document.createElement('div');
    slide.className = `carousel-slide ${idx === 0 ? 'active' : ''}`;
    slide.style.backgroundImage = `url(${BACKDROP_URL + m.backdrop_path})`;
    slide.innerHTML = `
      <div class="hero-content">
        <h1 class="hero-title">${m.title}</h1>
        <p class="hero-desc">${m.overview ? m.overview.slice(0, 150) + '...' : ''}</p>
      </div>
    `;
    slide.onclick = () => openModal(m);
    DOM.carouselTrack.appendChild(slide);
  });

  clearInterval(state.heroInterval);
  state.heroInterval = setInterval(nextHeroSlide, 6000);
};

const nextHeroSlide = () => {
  const slides = DOM.carouselTrack.querySelectorAll('.carousel-slide');
  if (!slides.length) return;
  slides[state.heroIndex].classList.remove('active');
  state.heroIndex = (state.heroIndex + 1) % slides.length;
  slides[state.heroIndex].classList.add('active');
};

const prevHeroSlide = () => {
  const slides = DOM.carouselTrack.querySelectorAll('.carousel-slide');
  if (!slides.length) return;
  slides[state.heroIndex].classList.remove('active');
  state.heroIndex = (state.heroIndex - 1 + slides.length) % slides.length;
  slides[state.heroIndex].classList.add('active');
};

const renderContextualRows = () => {
  if (state.tab !== 'all') {
    DOM.continueWatchingSec.style.display = 'none';
    DOM.recommendedSec.style.display = 'none';
    DOM.recentlyViewedSec.style.display = 'none';
    return;
  }

  // Continue Watching
  const watchingIds = Object.keys(state.status).filter((id) => state.status[id] === 'watching');
  if (watchingIds.length > 0) {
    DOM.continueWatchingSec.style.display = 'block';
    DOM.continueWatchingList.innerHTML = '';
    watchingIds.forEach((id) => {
      const m = state.savedMovies[id];
      if (m) DOM.continueWatchingList.appendChild(createMiniCard(m));
    });
  } else {
    DOM.continueWatchingSec.style.display = 'none';
  }

  // Recently Viewed
  if (state.recentlyViewed.length > 0) {
    DOM.recentlyViewedSec.style.display = 'block';
    DOM.recentlyViewedList.innerHTML = '';
    state.recentlyViewed.forEach((id) => {
      const m = state.savedMovies[id];
      if (m) DOM.recentlyViewedList.appendChild(createMiniCard(m));
    });
  } else {
    DOM.recentlyViewedSec.style.display = 'none';
  }
};

const createMiniCard = (m) => {
  const div = document.createElement('div');
  div.className = 'mini-card ripple-target';
  div.innerHTML = `
    <img src="${IMG_URL + m.poster_path}" alt="${m.title}" class="mini-poster" loading="lazy" />
    <div class="mini-info">
      <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.title}</div>
    </div>
  `;
  div.onclick = () => openModal(m);
  return div;
};

const renderSkeletonState = () => {
  DOM.grid.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const sk = document.createElement('div');
    sk.className = 'skeleton-card';
    DOM.grid.appendChild(sk);
  }
};

const renderErrorMsg = (msg) => {
  DOM.grid.innerHTML = `<div class="empty-state"><h3>${msg}</h3></div>`;
};

const buildFilterUI = () => {
  DOM.genreFilters.innerHTML = '';
  Object.entries(GENRES).forEach(([id, name]) => {
    const pill = document.createElement('span');
    pill.className = 'pill ripple-target';
    pill.textContent = name;
    pill.dataset.id = id;
    pill.onclick = () => {
      pill.classList.toggle('active');
      const gId = parseInt(id);
      if (state.filters.genres.includes(gId)) {
        state.filters.genres = state.filters.genres.filter((g) => g !== gId);
      } else {
        state.filters.genres.push(gId);
      }
      renderAllViews();
    };
    DOM.genreFilters.appendChild(pill);
  });
};

const setupEventListeners = () => {
  DOM.themeToggle.addEventListener('click', toggleTheme);

  DOM.filterToggle.addEventListener('click', () => {
    DOM.filterPanel.classList.toggle('collapsed');
  });

  DOM.clearFiltersBtn.addEventListener('click', () => {
    state.filters = { rating: 0, year: 1950, genres: [] };
    DOM.advRatingFilter.value = 0;
    DOM.advYearFilter.value = 1950;
    DOM.ratingVal.textContent = '0';
    DOM.yearVal.textContent = 'All Time';
    DOM.genreFilters.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
    renderAllViews();
  });

  DOM.advRatingFilter.addEventListener('input', (e) => {
    state.filters.rating = parseFloat(e.target.value);
    DOM.ratingVal.textContent = e.target.value;
    renderAllViews();
  });

  DOM.advYearFilter.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    state.filters.year = val;
    DOM.yearVal.textContent = val === 1950 ? 'All Time' : val;
    renderAllViews();
  });

  DOM.searchInput.addEventListener('input', handleSearch);

  DOM.tabsContainer.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab || tab.id === 'customListsToggle') return;

    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    state.activeCustomList = null;
    state.tab = tab.dataset.tab;
    renderAllViews();
  });

  DOM.customListsToggle.addEventListener('click', () => {
    DOM.customListsDropdown.classList.toggle('active');
  });

  DOM.createListBtn.addEventListener('click', () => {
    const name = DOM.newListName.value.trim();
    if (name && !state.customLists[name]) {
      state.customLists[name] = [];
      saveStateToStorage();
      buildCustomListsUI();
      DOM.newListName.value = '';
      showToast(`Created list "${name}"`, '📁');
    }
  });

  document.getElementById('carouselPrev').onclick = prevHeroSlide;
  document.getElementById('carouselNext').onclick = nextHeroSlide;

  DOM.grid.addEventListener('click', handleGridClick);
  DOM.modalClose.addEventListener('click', closeModal);
  document.addEventListener('click', applyRipple);
};

const handleSearch = (e) => {
  const query = e.target.value.trim();
  clearTimeout(state.searchTimeout);

  if (!query) {
    DOM.searchPredictions.classList.remove('active');
    fetchPopularMovies();
    return;
  }

  state.searchTimeout = setTimeout(async () => {
    try {
      const results = await fetchFromTMDB(`/search/movie?query=${encodeURIComponent(query)}`);
      state.currentApiResults = results;
      results.forEach((m) => (state.savedMovies[m.id] = m));

      // Predictions dropdown
      if (results.length > 0) {
        DOM.searchPredictions.innerHTML = '';
        results.slice(0, 5).forEach((m) => {
          const item = document.createElement('div');
          item.className = 'prediction-item';
          item.textContent = m.title;
          item.onclick = () => {
            openModal(m);
            DOM.searchPredictions.classList.remove('active');
          };
          DOM.searchPredictions.appendChild(item);
        });
        DOM.searchPredictions.classList.add('active');
      } else {
        DOM.searchPredictions.classList.remove('active');
      }

      renderGrid();
    } catch (err) {
      renderErrorMsg('Search failed.');
    }
  }, 350);
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
      showToastWithUndo(`Status set to ${v}`);
    }
    saveStateToStorage();
    renderAllViews();
    return;
  }

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
  if (!m) return;
  state.recentlyViewed = [m.id, ...state.recentlyViewed.filter((i) => i !== m.id)].slice(0, 10);
  saveStateToStorage();

  DOM.modal.classList.add('active');
  document.getElementById('m-img').src = m.poster_path ? IMG_URL + m.poster_path : '';
  document.getElementById('m-title').textContent = m.title;
  document.getElementById('m-year').textContent = m.release_date ? m.release_date.split('-')[0] : '';
  document.getElementById('m-rating').textContent = `⭐ ${(m.vote_average || 0).toFixed(1)}`;
  document.getElementById('m-genres').textContent = m.genre_ids
    ? m.genre_ids.map((g) => GENRES[g]).filter(Boolean).join(', ')
    : 'Unknown';
  document.getElementById('m-desc').textContent = m.overview || 'No overview available.';

  // Populate Journal Fields for this movie
  populateJournalModalFields(m);

  // Custom Lists container
  const listCont = document.getElementById('m-custom-lists');
  listCont.innerHTML = `<h4 style="margin-bottom:0.5rem;color:var(--text)">Add to Lists:</h4>`;
  Object.keys(state.customLists).forEach((listName) => {
    const inList = state.customLists[listName].includes(m.id);
    const box = document.createElement('div');
    box.className = 'modal-list-toggle';
    box.innerHTML = `<span>${listName}</span> <button class="btn ${inList ? 'added' : ''}" style="padding:0.2rem 0.5rem;font-size:0.7rem;background:var(--bg);border:1px solid var(--border);border-radius:4px;cursor:pointer;color:var(--text)">${inList ? 'Remove' : 'Add'}</button>`;
    box.querySelector('button').onclick = () => {
      if (inList)
        state.customLists[listName] = state.customLists[listName].filter((x) => x !== m.id);
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
