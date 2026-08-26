'use strict';

// ─── Config ───────────────────────────────────────────────────
const IMG_URL     = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_URL= 'https://image.tmdb.org/t/p/w1280';
const API_KEY     = typeof TMDB_API_KEY !== 'undefined' ? TMDB_API_KEY : '411eb787500b2a68f84396d235f4ddc6';
const BASE_URL    = 'https://api.themoviedb.org/3';

const GENRES = {
  28:'Action', 12:'Adventure', 16:'Animation', 35:'Comedy', 80:'Crime',
  99:'Documentary', 18:'Drama', 10751:'Family', 14:'Fantasy', 36:'History',
  27:'Horror', 10402:'Music', 9648:'Mystery', 10749:'Romance', 878:'Sci-Fi',
  10770:'TV Movie', 53:'Thriller', 10752:'War', 37:'Western',
};

// ─── State ────────────────────────────────────────────────────
let state = {
  theme: 'dark',
  user: null,
  token: null,
  savedMovies: {},
  favorites: {},
  status: {},
  progress: {},
  pinned: {},
  customLists: {},
  recentlyViewed: [],
  journalEntries: {},
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

// ─── DOM Cache ────────────────────────────────────────────────
const DOM = {};

const cacheDOM = () => {
  const ids = [
    'grid','searchInput','searchPredictions','themeToggle','themeIcon','filterToggle',
    'filterPanel','clearFiltersBtn','genreFilters','advRatingFilter','advYearFilter',
    'ratingVal','yearVal','tabs','customListsToggle','customListsDropdown','customListsMenu',
    'newListName','createListBtn','heroCarousel','carouselTrack','carouselDots',
    'carouselPrev','carouselNext','continueWatchingSec','continueWatchingList',
    'recommendedSec','recommendedList','recentlyViewedSec','recentlyViewedList',
    'toast-container','modal','modalClose','watchTimeBadge','stat-watchlist',
    'stat-watching','stat-watched','stat-pinned','stat-journal','statJournalPill',
    'authBtn','authBtnIcon','authBtnText','authModal','authModalClose','authModalTitle',
    'authModalSubtitle','tabSignIn','tabSignUp','authAlert','authForm','authUsername',
    'authEmail','authPassword','usernameField','emailField','authSubmitBtn',
    'authSwitchBtn','authSwitchPrompt','profileModal','profileModalClose',
    'profileUsername','profileEmail','profileJoinDate','profileBioInput','saveBioBtn',
    'pStatWatchlist','pStatWatching','pStatWatched','pStatJournal','logoutBtn',
    'journalSection','journalGrid','tabJournal','feelingsGroup','watchStartedAt',
    'watchEndedAt','userPersonalRating','userScoreDisplay','personalNotesInput',
    'saveJournalBtn','saveStatusIndicator','journalSyncStatus',
    'm-img','m-title','m-year','m-rating','m-genres','m-desc',
    'm-status-row','m-custom-lists','m-btn-watchlist','m-btn-watching','m-btn-watched',
  ];
  ids.forEach(id => { DOM[id.replace(/-([a-z])/g, (_,c) => c.toUpperCase())] = document.getElementById(id); });
  DOM.html = document.documentElement;
  DOM.toastContainer = document.getElementById('toast-container');
  DOM.tabsContainer  = document.getElementById('tabs');
  DOM.statWatchlist  = document.getElementById('stat-watchlist');
  DOM.statWatching   = document.getElementById('stat-watching');
  DOM.statWatched    = document.getElementById('stat-watched');
  DOM.statPinned     = document.getElementById('stat-pinned');
  DOM.statJournal    = document.getElementById('stat-journal');
  DOM.mBtnWatchlist  = document.getElementById('m-btn-watchlist');
  DOM.mBtnWatching   = document.getElementById('m-btn-watching');
  DOM.mBtnWatched    = document.getElementById('m-btn-watched');
  DOM.mStatusRow     = document.getElementById('m-status-row');
  DOM.mCustomLists   = document.getElementById('m-custom-lists');
  DOM.mImg           = document.getElementById('m-img');
  DOM.mTitle         = document.getElementById('m-title');
  DOM.mYear          = document.getElementById('m-year');
  DOM.mRating        = document.getElementById('m-rating');
  DOM.mGenres        = document.getElementById('m-genres');
  DOM.mDesc          = document.getElementById('m-desc');
};

let currentAuthMode = 'signin';
let selectedFeeling = null;

// ─── Init ─────────────────────────────────────────────────────
const init = async () => {
  cacheDOM();
  loadStateFromStorage();
  applyTheme();
  buildFilterUI();
  buildCustomListsUI();
  setupEventListeners();
  setupAuthEventListeners();
  setupJournalEventListeners();
  setupDragDrop();

  if (state.token) await fetchUserProfileAndSync();

  fetchPopularMovies();
  if (state.user) fetchRecommendations();
};

// ─── Storage ──────────────────────────────────────────────────
const loadStateFromStorage = () => {
  try {
    const token = localStorage.getItem('myCinemaList_token');
    if (token) state.token = token;
    const user = JSON.parse(localStorage.getItem('myCinemaList_user') || 'null');
    if (user) state.user = user;
    const ls = JSON.parse(localStorage.getItem('myCinemaList_v2_data') || 'null');
    if (ls) Object.assign(state, ls);
    if (!state.customLists)    state.customLists    = {};
    if (!state.recentlyViewed) state.recentlyViewed = [];
    if (!state.pinned)         state.pinned         = {};
    if (!state.journalEntries) state.journalEntries = {};
    updateUserAuthUI();
  } catch (e) { console.error('State load error', e); }
};

const saveStateToStorage = () => {
  try {
    const skip = new Set(['currentApiResults','tab','history','token','user']);
    const toSave = Object.fromEntries(Object.entries(state).filter(([k]) => !skip.has(k)));
    localStorage.setItem('myCinemaList_v2_data', JSON.stringify(toSave));
    updateStatsRow();
  } catch (e) {}
};

// ─── API ──────────────────────────────────────────────────────
const apiFetch = async (endpoint, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(endpoint, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Network or server error' }));
    let msg = 'Request failed';
    if (typeof err.detail === 'string') {
      msg = err.detail;
    } else if (Array.isArray(err.detail) && err.detail.length > 0) {
      msg = err.detail.map(d => d.msg || d.message || JSON.stringify(d)).join(', ');
    } else if (err.message) {
      msg = err.message;
    }
    throw new Error(msg);
  }
  return res.json();
};

const fetchFromTMDB = async (endpoint) => {
  // Prefer backend proxy, fallback to direct TMDB
  try {
    let url;
    if (endpoint.includes('/search/movie')) {
      const q = new URLSearchParams(endpoint.split('?')[1] || '').get('query') || '';
      url = `/api/movies/search?query=${encodeURIComponent(q)}`;
    } else if (endpoint.includes('/movie/popular')) {
      url = '/api/movies/popular';
    } else {
      url = `${BASE_URL}${endpoint}&api_key=${API_KEY}&language=en-US`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const data = await res.json();
    return data.results || [];
  } catch {
    const res = await fetch(`${BASE_URL}${endpoint}&api_key=${API_KEY}&language=en-US`);
    return (await res.json()).results || [];
  }
};

// ─── Auth ─────────────────────────────────────────────────────
const updateUserAuthUI = () => {
  const loggedIn = !!state.user;
  DOM.authBtn.classList.toggle('logged-in', loggedIn);
  DOM.authBtnText.textContent = loggedIn ? state.user.username : 'Sign In';
  if (DOM.statJournalPill) DOM.statJournalPill.style.display = loggedIn ? 'flex' : 'none';
  if (DOM.journalSyncStatus) {
    DOM.journalSyncStatus.textContent = loggedIn ? '☁️ Synced to cloud' : 'Saved locally';
  }
};

const fetchUserProfileAndSync = async () => {
  try {
    const data = await apiFetch('/api/user/sync');
    state.user = data.user;
    localStorage.setItem('myCinemaList_user', JSON.stringify(state.user));

    state.status = {};
    state.pinned = {};
    state.favorites = {};
    state.journalEntries = {};
    state.customLists = {};

    if (data.movie_logs) {
      data.movie_logs.forEach(log => {
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
          try { state.savedMovies[mid] = JSON.parse(log.movie_meta_json); } catch {}
        }
      });
    }

    if (data.custom_lists) {
      state.customLists = {};
      data.custom_lists.forEach(cl => {
        state.customLists[cl.name] = (cl.items || []).map(i => i.movie_id);
      });
    }

    saveStateToStorage();
    updateUserAuthUI();
    buildCustomListsUI();
    renderAllViews();
    fetchRecommendations();
  } catch (err) {
    console.warn('Sync failed:', err.message);
    logoutUser(false);
  }
};

const logoutUser = (notify = true) => {
  state.token = null;
  state.user = null;
  state.status = {};
  state.favorites = {};
  state.pinned = {};
  state.journalEntries = {};
  state.customLists = {};
  state.recentlyViewed = [];
  localStorage.removeItem('myCinemaList_token');
  localStorage.removeItem('myCinemaList_user');
  localStorage.removeItem('myCinemaList_v2_data');
  updateUserAuthUI();
  buildCustomListsUI();
  if (DOM.profileModal) DOM.profileModal.style.display = 'none';
  if (notify) showToast('Logged out', 'success');
  DOM.recommendedSec.style.display = 'none';
  renderAllViews();
};

const setupAuthEventListeners = () => {
  DOM.authBtn.addEventListener('click', () => {
    state.user ? openProfileModal() : openAuthModal('signin');
  });

  DOM.authModalClose.addEventListener('click', () => { DOM.authModal.style.display = 'none'; });
  DOM.profileModalClose.addEventListener('click', () => { DOM.profileModal.style.display = 'none'; });

  // Click outside to close modals
  [DOM.authModal, DOM.profileModal, DOM.modal].forEach(m => {
    m && m.addEventListener('click', e => { if (e.target === m) m.classList.contains('open') ? closeModal() : (m.style.display = 'none'); });
  });

  DOM.tabSignIn.addEventListener('click', () => switchAuthMode('signin'));
  DOM.tabSignUp.addEventListener('click', () => switchAuthMode('signup'));
  DOM.authSwitchBtn.addEventListener('click', () => switchAuthMode(currentAuthMode === 'signin' ? 'signup' : 'signin'));
  DOM.authForm.addEventListener('submit', handleAuthSubmit);
  DOM.logoutBtn.addEventListener('click', () => logoutUser(true));

  const togglePassBtn = document.getElementById('togglePasswordBtn');
  const eyeIcon = document.getElementById('eyeIcon');
  if (togglePassBtn) {
    togglePassBtn.addEventListener('click', () => {
      const isPass = DOM.authPassword.type === 'password';
      DOM.authPassword.type = isPass ? 'text' : 'password';
      if (eyeIcon) {
        eyeIcon.innerHTML = isPass
          ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>'
          : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
      }
    });
  }

  DOM.saveBioBtn.addEventListener('click', async () => {
    const bio = DOM.profileBioInput.value.trim();
    try {
      const updated = await apiFetch('/api/auth/profile', { method: 'PUT', body: JSON.stringify({ bio }) });
      state.user = updated;
      localStorage.setItem('myCinemaList_user', JSON.stringify(state.user));
      showToast('Bio updated', 'success');
    } catch (err) { showToast(err.message, 'error'); }
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
  const isSignIn = mode === 'signin';
  DOM.tabSignIn.classList.toggle('active', isSignIn);
  DOM.tabSignUp.classList.toggle('active', !isSignIn);
  DOM.tabSignIn.setAttribute('aria-selected', isSignIn);
  DOM.tabSignUp.setAttribute('aria-selected', !isSignIn);
  DOM.authModalTitle.textContent = isSignIn ? 'Welcome Back' : 'Create Profile';
  DOM.authModalSubtitle.textContent = isSignIn
    ? 'Sign in to access your cloud watchlist and journal.'
    : 'Create an account to start logging films and getting recommendations.';
  DOM.emailField.style.display = isSignIn ? 'none' : 'flex';
  DOM.authSubmitBtn.textContent = isSignIn ? 'Sign In' : 'Create Account';
  DOM.authSwitchPrompt.textContent = isSignIn ? "Don't have an account?" : 'Already have an account?';
  DOM.authSwitchBtn.textContent = isSignIn ? 'Sign Up' : 'Sign In';
};

const handleAuthSubmit = async (e) => {
  e.preventDefault();
  DOM.authAlert.style.display = 'none';
  const username = DOM.authUsername.value.trim();
  const email    = DOM.authEmail.value.trim();
  const password = DOM.authPassword.value;

  if (!username || !password || (currentAuthMode === 'signup' && !email)) {
    DOM.authAlert.textContent = 'Please fill in all required fields.';
    DOM.authAlert.style.display = 'block';
    return;
  }

  DOM.authSubmitBtn.disabled = true;
  DOM.authSubmitBtn.textContent = 'Processing...';

  try {
    const body = currentAuthMode === 'signup'
      ? JSON.stringify({ username, email, password })
      : JSON.stringify({ username_or_email: username, password });
    const endpoint = currentAuthMode === 'signup' ? '/api/auth/register' : '/api/auth/login';
    const resp = await apiFetch(endpoint, { method: 'POST', body });

    state.token = resp.access_token;
    state.user  = resp.user;
    localStorage.setItem('myCinemaList_token', state.token);
    localStorage.setItem('myCinemaList_user', JSON.stringify(state.user));
    DOM.authModal.style.display = 'none';
    DOM.authForm.reset();
    showToast(`Welcome, ${state.user.username}!`, 'success');
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
  DOM.profileEmail.textContent    = state.user.email;
  DOM.profileBioInput.value       = state.user.bio || '';
  if (state.user.created_at) {
    const d = new Date(state.user.created_at);
    DOM.profileJoinDate.textContent = `Member since ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  }
  DOM.pStatWatchlist.textContent = Object.values(state.status).filter(s => s === 'watchlist').length;
  DOM.pStatWatching.textContent  = Object.values(state.status).filter(s => s === 'watching').length;
  DOM.pStatWatched.textContent   = Object.values(state.status).filter(s => s === 'watched').length;
  DOM.pStatJournal.textContent   = Object.values(state.journalEntries).filter(j => j && (j.personal_notes || j.feeling)).length;
  DOM.profileModal.style.display = 'flex';
};

// ─── Journal ──────────────────────────────────────────────────
const setupJournalEventListeners = () => {
  DOM.feelingsGroup.querySelectorAll('.feeling-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.feeling;
      if (selectedFeeling === f) {
        selectedFeeling = null;
        btn.classList.remove('active');
      } else {
        selectedFeeling = f;
        DOM.feelingsGroup.querySelectorAll('.feeling-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
    });
  });

  DOM.userPersonalRating.addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    DOM.userScoreDisplay.textContent = v > 0 ? `★ ${v.toFixed(1)} / 10` : 'Not Rated';
  });

  DOM.saveJournalBtn.addEventListener('click', saveCurrentMovieJournal);
};

const populateJournalModalFields = (movie) => {
  state.currentModalMovie = movie;
  const j = state.journalEntries[movie.id] || {};
  selectedFeeling = j.feeling || null;
  DOM.feelingsGroup.querySelectorAll('.feeling-pill').forEach(b => {
    b.classList.toggle('active', b.dataset.feeling === selectedFeeling);
  });
  DOM.watchStartedAt.value    = j.started_at || '';
  DOM.watchEndedAt.value      = j.ended_at   || '';
  const rating = j.user_rating || 0;
  DOM.userPersonalRating.value = rating;
  DOM.userScoreDisplay.textContent = rating > 0 ? `★ ${rating.toFixed(1)} / 10` : 'Not Rated';
  DOM.personalNotesInput.value = j.personal_notes || '';
  DOM.saveStatusIndicator.textContent = '';
};

const saveCurrentMovieJournal = async () => {
  const movie = state.currentModalMovie;
  if (!movie) return;

  const notes    = DOM.personalNotesInput.value.trim();
  const startedAt= DOM.watchStartedAt.value || null;
  const endedAt  = DOM.watchEndedAt.value   || null;
  const rating   = parseFloat(DOM.userPersonalRating.value) || 0;

  state.journalEntries[movie.id] = { feeling: selectedFeeling, personal_notes: notes, started_at: startedAt, ended_at: endedAt, user_rating: rating };
  state.savedMovies[movie.id] = movie;
  saveStateToStorage();

  DOM.saveStatusIndicator.textContent = 'Saving...';

  if (state.token) {
    try {
      await apiFetch('/api/journal/movies', {
        method: 'POST',
        body: JSON.stringify({
          movie_id: movie.id,
          status: state.status[movie.id] || 'watchlist',
          is_pinned: !!state.pinned[movie.id],
          is_favorite: !!state.favorites[movie.id],
          user_rating: rating, feeling: selectedFeeling,
          personal_notes: notes, started_at: startedAt, ended_at: endedAt,
          movie_meta_json: JSON.stringify({
            id: movie.id, title: movie.title,
            poster_path: movie.poster_path, backdrop_path: movie.backdrop_path,
            release_date: movie.release_date, vote_average: movie.vote_average,
            genre_ids: movie.genre_ids, overview: movie.overview,
          }),
        }),
      });
      DOM.saveStatusIndicator.textContent = '✓ Synced to cloud';
    } catch { DOM.saveStatusIndicator.textContent = 'Saved locally'; }
  } else {
    DOM.saveStatusIndicator.textContent = '✓ Saved locally';
  }

  showToast('Journal entry saved', 'success');
  renderAllViews();
  setTimeout(() => { DOM.saveStatusIndicator.textContent = ''; }, 2500);
};

// ─── Journal Feed ─────────────────────────────────────────────
const renderJournalFeed = () => {
  DOM.journalGrid.innerHTML = '';
  const loggedIds = Object.keys(state.journalEntries).filter(id => {
    const j = state.journalEntries[id];
    return j && (j.personal_notes || j.feeling || j.started_at || j.ended_at || j.user_rating > 0);
  });

  if (!loggedIds.length) {
    DOM.journalGrid.innerHTML = `
      <div class="journal-empty-state">
        <div class="icon">📖</div>
        <h3>Your Cinema Journal is Empty</h3>
        <p>Open any movie, add feelings, dates, and write your thoughts to start building your journal.</p>
      </div>`;
    return;
  }

  loggedIds.reverse().forEach(id => {
    const movie = state.savedMovies[id] || { id: Number(id), title: `Movie #${id}` };
    const j = state.journalEntries[id];
    const card = document.createElement('div');
    card.className = 'journal-card ripple-target';
    const posterSrc = movie.poster_path ? IMG_URL + movie.poster_path : '';
    const dateText = [
      j.started_at ? `Started: ${j.started_at}` : '',
      j.ended_at   ? `Finished: ${j.ended_at}`  : '',
    ].filter(Boolean).join(' · ');

    card.innerHTML = `
      <div class="journal-card-top">
        ${posterSrc ? `<img src="${posterSrc}" alt="${movie.title}" class="journal-card-poster" loading="lazy" />` : ''}
        <div class="journal-card-meta">
          <div class="journal-card-title">${movie.title || 'Unknown Title'}</div>
          ${j.feeling ? `<span class="journal-feeling-badge">${j.feeling}</span>` : ''}
          ${j.user_rating > 0 ? `<div class="card-personal-rating">★ ${j.user_rating.toFixed(1)} / 10</div>` : ''}
          ${dateText ? `<div class="journal-card-dates">${dateText}</div>` : ''}
        </div>
      </div>
      <div class="journal-card-body">${j.personal_notes || '<em>No notes written yet.</em>'}</div>`;

    card.onclick = () => openModal(movie);
    DOM.journalGrid.appendChild(card);
  });
};

// ─── Recommendations ──────────────────────────────────────────
const fetchRecommendations = async () => {
  if (!state.token) return;
  try {
    const results = await apiFetch('/api/recommendations');
    if (!results || !results.length) return;
    DOM.recommendedSec.style.display = 'block';
    DOM.recommendedList.innerHTML = '';
    results.slice(0, 15).forEach(m => {
      state.savedMovies[m.id] = m;
      const card = createMiniCard(m, true);
      DOM.recommendedList.appendChild(card);
    });
  } catch (err) {
    console.warn('Recommendations failed:', err.message);
  }
};

// ─── Theme ────────────────────────────────────────────────────
const applyTheme = () => {
  DOM.html.setAttribute('data-theme', state.theme);
  // Swap icon
  if (DOM.themeIcon) {
    DOM.themeIcon.innerHTML = state.theme === 'dark'
      ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
      : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  }
};

const toggleTheme = () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  saveStateToStorage();
  applyTheme();
};

// ─── Data Fetch ───────────────────────────────────────────────
const fetchPopularMovies = async () => {
  renderSkeletonState();
  try {
    const results = await fetchFromTMDB('/movie/popular?page=1');
    state.currentApiResults = results;
    results.forEach(m => (state.savedMovies[m.id] = m));
    renderAllViews();
  } catch (e) {
    renderErrorMsg(e.message);
  }
};

// ─── Render All ───────────────────────────────────────────────
const renderAllViews = () => {
  const isJournal = state.tab === 'journal';
  DOM.grid.style.display          = isJournal ? 'none' : 'grid';
  DOM.heroCarousel.style.display  = (isJournal || state.tab !== 'all') ? 'none' : 'block';
  DOM.journalSection.style.display= isJournal ? 'block' : 'none';

  if (isJournal) {
    DOM.continueWatchingSec.style.display = 'none';
    DOM.recentlyViewedSec.style.display   = 'none';
    renderJournalFeed();
  } else {
    renderGrid();
    if (state.tab === 'all') {
      renderHeroCarousel();
      renderContextualRows();
    } else {
      DOM.continueWatchingSec.style.display = 'none';
      DOM.recentlyViewedSec.style.display   = 'none';
    }
  }
  updateStatsRow();
};

const getFilteredMovies = () => {
  let source;
  if (state.activeCustomList) {
    source = (state.customLists[state.activeCustomList] || []).map(id => state.savedMovies[id]).filter(Boolean);
  } else if (state.tab === 'all') {
    source = state.currentApiResults;
  } else {
    source = Object.keys(state.status).filter(id => state.status[id] === state.tab).map(id => state.savedMovies[id]).filter(Boolean);
  }

  source = (source || []).filter(m => {
    if (!m) return false;
    if (m.vote_average < state.filters.rating) return false;
    const y = m.release_date ? parseInt(m.release_date) : 0;
    if (y < state.filters.year && state.filters.year > 1950) return false;
    if (state.filters.genres.length > 0 && m.genre_ids) {
      if (!state.filters.genres.some(g => m.genre_ids.includes(g))) return false;
    }
    return true;
  });

  source.sort((a, b) => (state.pinned[b.id] ? 1 : 0) - (state.pinned[a.id] ? 1 : 0));
  return source;
};

const renderGrid = () => {
  const movies = getFilteredMovies();
  DOM.grid.innerHTML = '';
  if (!movies.length) {
    renderErrorMsg('No movies match the current filter.');
    return;
  }
  const frag = document.createDocumentFragment();
  movies.forEach(m => frag.appendChild(createMovieCard(m)));
  DOM.grid.appendChild(frag);
};

// ─── Movie Card ───────────────────────────────────────────────
const createMovieCard = (m) => {
  const card = document.createElement('div');
  card.className = 'card ripple-target';
  card.dataset.id = m.id;
  card.draggable  = true;
  card.setAttribute('role', 'listitem');

  const isFav    = !!state.favorites[m.id];
  const isPin    = !!state.pinned[m.id];
  const curStatus= state.status[m.id] || '';
  const journal  = state.journalEntries[m.id];
  const poster   = m.poster_path ? IMG_URL + m.poster_path : null;
  const year     = m.release_date ? m.release_date.split('-')[0] : 'N/A';
  const rating   = (m.vote_average || 0).toFixed(1);
  const genres   = m.genre_ids ? m.genre_ids.slice(0, 2).map(g => GENRES[g]).filter(Boolean).join(' · ') : '';

  card.setAttribute('data-pinned', isPin);

  card.innerHTML = `
    <span class="pin-badge" aria-label="Pinned">📌 Pinned</span>
    <div class="card-poster">
      ${poster
        ? `<img src="${poster}" alt="${m.title}" loading="lazy" />`
        : `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--subtext);font-size:2rem;">🎬</div>`}
      <div class="rating-badge" aria-hidden="true">
        <span class="rating-star">★</span>
        <span class="rating-val">${rating}</span>
        <span class="rating-year">${year}</span>
      </div>
      <div class="card-hover-overlay">
        <p>${m.overview || 'No overview available.'}</p>
      </div>
      <div class="controls-overlay">
        <button class="overlay-btn ripple-target ${isFav ? 'favorited' : ''}" data-action="fav" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}" title="Favorite">
          <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <button class="overlay-btn ripple-target ${isPin ? 'pinned-btn' : ''}" data-action="pin" aria-label="${isPin ? 'Unpin' : 'Pin to top'}" title="Pin">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg>
        </button>
      </div>
    </div>
    <div class="card-info">
      <div class="card-title">${m.title}</div>
      ${genres ? `<div class="card-genres">${genres}</div>` : ''}
      ${journal && journal.feeling ? `<span class="card-feeling">${journal.feeling}</span>` : ''}
      ${journal && journal.user_rating > 0 ? `<div class="card-personal-rating">My rating: ★ ${journal.user_rating.toFixed(1)}</div>` : ''}
      <div class="card-actions">
        <button class="status-btn ripple-target ${curStatus === 'watchlist' ? 'active-watchlist' : ''}" data-action="status" data-val="watchlist">List</button>
        <button class="status-btn ripple-target ${curStatus === 'watching'  ? 'active-watching'  : ''}" data-action="status" data-val="watching">Watching</button>
        <button class="status-btn ripple-target ${curStatus === 'watched'   ? 'active-watched'   : ''}" data-action="status" data-val="watched">Watched</button>
      </div>
    </div>`;

  // Drag
  card.addEventListener('dragstart', e => {
    state.draggedMovieId = m.id;
    e.dataTransfer.setData('text/plain', m.id);
    setTimeout(() => card.classList.add('dragging'), 0);
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  // Click (not on button)
  card.addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (btn) {
      e.stopPropagation();
      handleCardAction(m.id, btn.dataset.action, btn.dataset.val);
      return;
    }
    openModal(m);
  });

  return card;
};

const handleCardAction = (id, action, val) => {
  takeSnapshot();
  if (action === 'fav') {
    state.favorites[id] ? delete state.favorites[id] : (state.favorites[id] = true);
    syncMovieLog(id);
    showToast('Favorites updated', 'success', true);
  } else if (action === 'pin') {
    state.pinned[id] ? delete state.pinned[id] : (state.pinned[id] = true);
    syncMovieLog(id);
    showToast('Pins updated', 'success', true);
  } else if (action === 'status') {
    state.status[id] === val ? delete state.status[id] : (state.status[id] = val);
    syncMovieLog(id);
    showToast(`Status: ${val}`, 'success', true);
  }
  saveStateToStorage();
  renderAllViews();
};

const syncMovieLog = async (movieId) => {
  if (!state.token) return;
  const m = state.savedMovies[movieId];
  if (!m) return;
  const j = state.journalEntries[movieId] || {};
  try {
    await apiFetch('/api/journal/movies', {
      method: 'POST',
      body: JSON.stringify({
        movie_id: movieId,
        status: state.status[movieId] || null,
        is_pinned: !!state.pinned[movieId],
        is_favorite: !!state.favorites[movieId],
        user_rating: j.user_rating || 0,
        feeling: j.feeling || null,
        personal_notes: j.personal_notes || null,
        started_at: j.started_at || null,
        ended_at: j.ended_at || null,
        movie_meta_json: JSON.stringify({ id: m.id, title: m.title, poster_path: m.poster_path, backdrop_path: m.backdrop_path, release_date: m.release_date, vote_average: m.vote_average, genre_ids: m.genre_ids, overview: m.overview }),
      }),
    });
  } catch {}
};

// ─── Hero Carousel ────────────────────────────────────────────
const renderHeroCarousel = () => {
  if (!state.currentApiResults.length) {
    DOM.heroCarousel.style.display = 'none';
    return;
  }
  DOM.heroCarousel.style.display = 'block';
  DOM.carouselTrack.innerHTML = '';
  if (DOM.carouselDots) DOM.carouselDots.innerHTML = '';

  const topMovies = state.currentApiResults.filter(m => m.backdrop_path).slice(0, 6);
  if (!topMovies.length) { DOM.heroCarousel.style.display = 'none'; return; }

  topMovies.forEach((m, idx) => {
    const slide = document.createElement('div');
    slide.className = 'hero-slide';
    const year   = m.release_date ? m.release_date.split('-')[0] : '';
    const rating = (m.vote_average || 0).toFixed(1);
    const genres = m.genre_ids ? m.genre_ids.slice(0, 2).map(g => GENRES[g]).filter(Boolean).join(' · ') : '';
    slide.innerHTML = `
      <img class="hero-banner-img" src="${BACKDROP_URL + m.backdrop_path}" alt="${m.title}" loading="${idx === 0 ? 'eager' : 'lazy'}" />
      <div class="hero-overlay">
        <div class="hero-eyebrow">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4a2 2 0 0 0-2 2v1h20V6a2 2 0 0 0-2-2H4zm-2 5v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9H2z"/></svg>
          Now Trending
        </div>
        <h1 class="hero-title">${m.title}</h1>
        <div class="hero-meta">
          ${year ? `<span>${year}</span><span class="hero-meta-dot"></span>` : ''}
          ${genres ? `<span>${genres}</span><span class="hero-meta-dot"></span>` : ''}
          <span class="hero-rating-badge">★ ${rating}</span>
        </div>
        <p class="hero-desc">${m.overview ? m.overview.slice(0, 180) + '...' : ''}</p>
        <div class="hero-btns">
          <button class="hero-btn hero-btn-primary ripple-target" data-hero-open="${m.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
            View Details
          </button>
          <button class="hero-btn hero-btn-secondary ripple-target" data-hero-wl="${m.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2"/><rect x="3" y="6" width="18" height="14" rx="2"/></svg>
            Add to Watchlist
          </button>
        </div>
      </div>`;
    DOM.carouselTrack.appendChild(slide);

    // Dot
    if (DOM.carouselDots) {
      const dot = document.createElement('button');
      dot.className = `carousel-dot ${idx === 0 ? 'active' : ''}`;
      dot.setAttribute('aria-label', `Slide ${idx + 1}`);
      dot.onclick = () => goToSlide(idx);
      DOM.carouselDots.appendChild(dot);
    }
  });

  // Hero button events
  DOM.heroCarousel.querySelectorAll('[data-hero-open]').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); openModal(state.savedMovies[Number(btn.dataset.heroOpen)]); };
  });
  DOM.heroCarousel.querySelectorAll('[data-hero-wl]').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const id = Number(btn.dataset.heroWl);
      if (!state.status[id]) { state.status[id] = 'watchlist'; saveStateToStorage(); showToast('Added to Watchlist', 'success'); }
    };
  });

  clearInterval(state.heroInterval);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!reduced.matches) state.heroInterval = setInterval(nextHeroSlide, 5500);
};

const goToSlide = (idx) => {
  const slides = DOM.carouselTrack.querySelectorAll('.hero-slide');
  const dots   = DOM.carouselDots ? DOM.carouselDots.querySelectorAll('.carousel-dot') : [];
  if (!slides.length) return;
  state.heroIndex = ((idx % slides.length) + slides.length) % slides.length;
  DOM.carouselTrack.style.transform = `translateX(-${state.heroIndex * 100}%)`;
  dots.forEach((d, i) => d.classList.toggle('active', i === state.heroIndex));
};

const nextHeroSlide = () => goToSlide(state.heroIndex + 1);
const prevHeroSlide = () => goToSlide(state.heroIndex - 1);

// ─── Contextual Rows ──────────────────────────────────────────
const renderContextualRows = () => {
  // Continue Watching
  const watching = Object.keys(state.status).filter(id => state.status[id] === 'watching' && state.savedMovies[id]);
  DOM.continueWatchingSec.style.display = watching.length ? 'block' : 'none';
  if (watching.length) {
    DOM.continueWatchingList.innerHTML = '';
    watching.forEach(id => DOM.continueWatchingList.appendChild(createMiniCard(state.savedMovies[id])));
  }

  // Recently Viewed
  const recent = state.recentlyViewed.filter(id => state.savedMovies[id]);
  DOM.recentlyViewedSec.style.display = recent.length ? 'block' : 'none';
  if (recent.length) {
    DOM.recentlyViewedList.innerHTML = '';
    recent.forEach(id => DOM.recentlyViewedList.appendChild(createMiniCard(state.savedMovies[id])));
  }
};

const createMiniCard = (m, isRec = false) => {
  const div = document.createElement('div');
  div.className = 'mini-card ripple-target';
  const year = m.release_date ? m.release_date.split('-')[0] : '';
  div.innerHTML = `
    ${isRec ? '<span class="mini-rec-badge">For You</span>' : ''}
    ${m.poster_path
      ? `<img src="${IMG_URL + m.poster_path}" alt="${m.title}" class="mini-poster" loading="lazy" />`
      : `<div class="mini-poster" style="display:flex;align-items:center;justify-content:center;background:var(--muted);color:var(--subtext);font-size:2rem;">🎬</div>`}
    <div class="mini-info">
      <div class="mini-title">${m.title}</div>
      ${year ? `<div class="mini-year">${year}</div>` : ''}
    </div>`;
  div.onclick = () => openModal(m);
  return div;
};

// ─── Modal ────────────────────────────────────────────────────
const openModal = (m) => {
  if (!m) return;
  state.recentlyViewed = [m.id, ...state.recentlyViewed.filter(i => i !== m.id)].slice(0, 10);
  saveStateToStorage();

  DOM.modal.style.display = 'flex';
  DOM.modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  DOM.mImg.src = m.poster_path ? IMG_URL + m.poster_path : '';
  DOM.mImg.alt = m.title;
  DOM.mTitle.textContent = m.title;
  DOM.mYear.textContent  = m.release_date ? m.release_date.split('-')[0] : '';
  DOM.mRating.textContent= `★ ${(m.vote_average || 0).toFixed(1)}`;
  DOM.mGenres.textContent= m.genre_ids ? m.genre_ids.map(g => GENRES[g]).filter(Boolean).join(', ') : 'Unknown';
  DOM.mDesc.textContent  = m.overview || 'No overview available.';

  // Status buttons
  const curStatus = state.status[m.id] || '';
  [DOM.mBtnWatchlist, DOM.mBtnWatching, DOM.mBtnWatched].forEach(btn => {
    btn.className = `modal-status-btn ripple-target active-${btn.dataset.status === curStatus ? btn.dataset.status : 'none'}`;
    btn.onclick = () => {
      const s = btn.dataset.status;
      state.status[m.id] === s ? delete state.status[m.id] : (state.status[m.id] = s);
      syncMovieLog(m.id);
      saveStateToStorage();
      openModal(m); // re-render modal state
    };
  });
  // Apply active classes properly
  DOM.mBtnWatchlist.className = `modal-status-btn ripple-target${curStatus === 'watchlist' ? ' active-watchlist' : ''}`;
  DOM.mBtnWatching.className  = `modal-status-btn ripple-target${curStatus === 'watching'  ? ' active-watching'  : ''}`;
  DOM.mBtnWatched.className   = `modal-status-btn ripple-target${curStatus === 'watched'   ? ' active-watched'   : ''}`;

  // Custom list chips
  DOM.mCustomLists.innerHTML = '';
  Object.keys(state.customLists).forEach(listName => {
    const inList = state.customLists[listName].includes(m.id);
    const chip = document.createElement('button');
    chip.className = `list-chip ripple-target${inList ? ' in-list' : ''}`;
    chip.textContent = listName;
    chip.onclick = () => {
      if (inList) state.customLists[listName] = state.customLists[listName].filter(x => x !== m.id);
      else state.customLists[listName].push(m.id);
      saveStateToStorage();
      openModal(m);
    };
    DOM.mCustomLists.appendChild(chip);
  });

  populateJournalModalFields(m);
};

const closeModal = () => {
  DOM.modal.style.display = 'none';
  DOM.modal.classList.remove('open');
  document.body.style.overflow = '';
  renderAllViews();
};

// ─── Stats ────────────────────────────────────────────────────
const updateStatsRow = () => {
  let wl = 0, wg = 0, wd = 0, pin = 0, j = 0;
  Object.values(state.status).forEach(s => {
    if (s === 'watchlist') wl++;
    if (s === 'watching')  wg++;
    if (s === 'watched')   wd++;
  });
  pin = Object.values(state.pinned).filter(Boolean).length;
  j   = Object.values(state.journalEntries).filter(e => e && (e.personal_notes || e.feeling)).length;
  DOM.statWatchlist.textContent = wl;
  DOM.statWatching.textContent  = wg;
  DOM.statWatched.textContent   = wd;
  DOM.statPinned.textContent    = pin;
  if (DOM.statJournal) DOM.statJournal.textContent = j;
  if (DOM.watchTimeBadge) DOM.watchTimeBadge.textContent = `~${Math.round(wd * 1.75)}h`;
};

// ─── Custom Lists ─────────────────────────────────────────────
const buildCustomListsUI = () => {
  DOM.customListsMenu.innerHTML = '';
  Object.keys(state.customLists).forEach(name => {
    const div = document.createElement('div');
    div.className = 'custom-list-item ripple-target';
    div.setAttribute('role', 'menuitem');
    div.textContent = name;
    div.onclick = () => {
      state.activeCustomList = name;
      state.tab = null;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      DOM.customListsDropdown.classList.remove('active');
      renderAllViews();
    };
    DOM.customListsMenu.appendChild(div);
  });
};

// ─── Filters ─────────────────────────────────────────────────
const buildFilterUI = () => {
  DOM.genreFilters.innerHTML = '';
  Object.entries(GENRES).forEach(([id, name]) => {
    const pill = document.createElement('button');
    pill.className = 'genre-pill ripple-target';
    pill.textContent = name;
    pill.dataset.id  = id;
    pill.setAttribute('role', 'checkbox');
    pill.setAttribute('aria-checked', 'false');
    pill.onclick = () => {
      const gid = parseInt(id);
      const active = !pill.classList.contains('active');
      pill.classList.toggle('active', active);
      pill.setAttribute('aria-checked', active);
      active ? state.filters.genres.push(gid) : (state.filters.genres = state.filters.genres.filter(g => g !== gid));
      renderAllViews();
    };
    DOM.genreFilters.appendChild(pill);
  });
};

// ─── Skeleton / Error ─────────────────────────────────────────
const renderSkeletonState = () => {
  DOM.grid.innerHTML = Array.from({ length: 10 }, () => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-poster"></div>
      <div class="skeleton-info">
        <div class="skeleton skeleton-line w80"></div>
        <div class="skeleton skeleton-line w50"></div>
      </div>
    </div>`).join('');
};

const renderErrorMsg = (msg) => {
  DOM.grid.innerHTML = `
    <div class="error-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <h3>${msg}</h3>
    </div>`;
};

// ─── Event Listeners ──────────────────────────────────────────
const setupEventListeners = () => {
  DOM.themeToggle.addEventListener('click', toggleTheme);

  DOM.filterToggle.addEventListener('click', () => {
    DOM.filterPanel.classList.toggle('collapsed');
  });

  DOM.clearFiltersBtn.addEventListener('click', () => {
    state.filters = { rating: 0, year: 1950, genres: [] };
    DOM.advRatingFilter.value = 0;
    DOM.advYearFilter.value   = 1950;
    DOM.ratingVal.textContent = '0';
    DOM.yearVal.textContent   = 'All Time';
    DOM.genreFilters.querySelectorAll('.genre-pill').forEach(p => {
      p.classList.remove('active');
      p.setAttribute('aria-checked', 'false');
    });
    renderAllViews();
  });

  DOM.advRatingFilter.addEventListener('input', e => {
    state.filters.rating = parseFloat(e.target.value);
    DOM.ratingVal.textContent = e.target.value;
    renderAllViews();
  });

  DOM.advYearFilter.addEventListener('input', e => {
    const val = parseInt(e.target.value);
    state.filters.year = val;
    DOM.yearVal.textContent = val <= 1950 ? 'All Time' : val;
    renderAllViews();
  });

  DOM.searchInput.addEventListener('input', handleSearch);
  DOM.searchInput.addEventListener('blur', () => {
    setTimeout(() => DOM.searchPredictions.classList.remove('active'), 200);
  });

  DOM.tabsContainer.addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (!tab || tab.id === 'customListsToggle') return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.activeCustomList = null;
    state.tab = tab.dataset.tab;
    renderAllViews();
  });

  DOM.customListsToggle.addEventListener('click', () => {
    const cont = DOM.customListsToggle.closest('.custom-lists-container');
    if (cont) {
      const expanded = cont.classList.toggle('active');
      DOM.customListsToggle.setAttribute('aria-expanded', expanded);
    }
  });

  DOM.createListBtn.addEventListener('click', async () => {
    const name = DOM.newListName.value.trim();
    if (!name || state.customLists[name]) return;

    state.customLists[name] = [];

    if (state.token) {
      try {
        await apiFetch('/api/lists', { method: 'POST', body: JSON.stringify({ name }) });
      } catch {}
    }

    saveStateToStorage();
    buildCustomListsUI();
    DOM.newListName.value = '';
    showToast(`List "${name}" created`, 'success');
  });

  DOM.carouselPrev.onclick = prevHeroSlide;
  DOM.carouselNext.onclick = nextHeroSlide;

  DOM.modalClose.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  document.addEventListener('click', applyRipple);
};

// ─── Search ───────────────────────────────────────────────────
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
      results.forEach(m => (state.savedMovies[m.id] = m));

      if (results.length) {
        DOM.searchPredictions.innerHTML = '';
        results.slice(0, 5).forEach(m => {
          const item = document.createElement('div');
          item.className = 'prediction-item';
          item.setAttribute('role', 'option');
          const year = m.release_date ? m.release_date.split('-')[0] : '';
          item.innerHTML = `
            ${m.poster_path ? `<img src="${IMG_URL + m.poster_path}" alt="" class="prediction-img" loading="lazy" />` : ''}
            <div class="prediction-info">
              <div class="prediction-title">${m.title}</div>
              ${year ? `<div class="prediction-year">${year}</div>` : ''}
            </div>`;
          item.onclick = () => { openModal(m); DOM.searchPredictions.classList.remove('active'); };
          DOM.searchPredictions.appendChild(item);
        });
        DOM.searchPredictions.classList.add('active');
      } else {
        DOM.searchPredictions.classList.remove('active');
      }
      renderGrid();
    } catch { renderErrorMsg('Search failed. Check connection.'); }
  }, 350);
};

// ─── Drag & Drop ──────────────────────────────────────────────
const setupDragDrop = () => {
  document.querySelectorAll('.tab.dropzone').forEach(tab => {
    tab.addEventListener('dragover', e => { e.preventDefault(); tab.classList.add('drag-over'); });
    tab.addEventListener('dragleave', () => tab.classList.remove('drag-over'));
    tab.addEventListener('drop', e => {
      e.preventDefault();
      tab.classList.remove('drag-over');
      const id = Number(e.dataTransfer.getData('text/plain'));
      if (!id) return;
      const newStatus = tab.dataset.tab;
      takeSnapshot();
      state.status[id] = newStatus;
      syncMovieLog(id);
      saveStateToStorage();
      renderAllViews();
      showToast(`Moved to ${newStatus}`, 'success', true);
    });
  });
};

// ─── Undo ─────────────────────────────────────────────────────
const takeSnapshot = () => {
  state.history = JSON.stringify({
    savedMovies: state.savedMovies, favorites: state.favorites, status: state.status,
    progress: state.progress, pinned: state.pinned, customLists: state.customLists,
    recentlyViewed: state.recentlyViewed, journalEntries: state.journalEntries,
  });
};

const triggerUndo = () => {
  if (!state.history) return;
  Object.assign(state, JSON.parse(state.history));
  state.history = null;
  saveStateToStorage();
  renderAllViews();
  showToast('Action undone', 'success');
};

// ─── Toast ────────────────────────────────────────────────────
const showToast = (msg, type = 'success', undoable = false) => {
  const icons = {
    success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info:    `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `${icons[type] || icons.info}<span>${msg}</span>`;
  if (undoable) {
    const btn = document.createElement('button');
    btn.style.cssText = 'background:none;border:none;color:var(--accent);font-weight:700;cursor:pointer;font-family:inherit;font-size:0.78rem;margin-left:auto;padding:0;';
    btn.textContent = 'Undo';
    btn.onclick = () => { triggerUndo(); t.remove(); };
    t.appendChild(btn);
  }
  DOM.toastContainer.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 4500);
};

// ─── Ripple ───────────────────────────────────────────────────
const applyRipple = (e) => {
  const target = e.target.closest('.ripple-target');
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const circle = document.createElement('span');
  const d = Math.max(rect.width, rect.height);
  circle.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX-rect.left-d/2}px;top:${e.clientY-rect.top-d/2}px`;
  circle.classList.add('ripple');
  target.querySelector('.ripple')?.remove();
  target.appendChild(circle);
};

// ─── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
