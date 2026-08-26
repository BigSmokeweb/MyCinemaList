# 🎬 MyCinemaList — Full-Stack Movie Journal & Watchlist Platform

A modern, production-grade full-stack web application for cinephiles to discover movies, manage watchlists, write detailed movie journals and personal reviews, express emotional impressions, track watch timeline dates, and receive personalized AI recommendations.

---

## 🌟 Key Features

- **🔐 User Profiles & Authentication**:
  - Secure registration & sign-in powered by JWT bearer tokens and password hashing.
  - Multi-user isolation with cloud sync and local cache fallback.

- **🍿 Movie Journaling & Feelings Tracker**:
  - Write impressions, quotes, reflections, and personal ratings (1–10).
  - Tag movies with feeling pills (🤩 Mind-blown, 😢 Emotional, ❤️ Loved it, 🍿 Fun & Chill, ⚡ Thrilling, 😴 Bored, etc.).
  - Track watch timeline dates: **Started Date** & **Finished Date**.

- **💡 Personalized Movie Recommendations**:
  - Automatic recommendations dynamically calculated from your watch history and ratings.

- **📔 Dedicated Journal Feed ("My Journal")**:
  - Chronological timeline diary of all your logged movies and personal reviews.

- **⚡ Rich Discovery & Movie Management**:
  - Real-time TMDB movie search and genre filters.
  - Status boards: **Watchlist**, **Watching**, **Watched**.
  - Pin favorite movies to the top & create custom lists.
  - Interactive hero carousel highlighting trending films.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.13, FastAPI, Uvicorn, SQLAlchemy, SQLite, Pydantic, Python-JOSE (JWT), Passlib/Bcrypt, Httpx.
- **Frontend**: Vanilla HTML5, Modern CSS3 (Dark/Light themes, Glassmorphism, Responsive Grid), Vanilla ES6 JavaScript (Async/Await, REST API Client).

---

## 📁 Repository Structure

```text
MyCinemaList/
├── backend/
│   ├── auth.py          # JWT authentication & password hashing
│   ├── database.py      # SQLAlchemy DB engine & session
│   ├── main.py          # FastAPI application routes & TMDB proxy
│   ├── models.py        # Database models (User, MovieLog, CustomList)
│   ├── requirements.txt # Python dependencies
│   └── schemas.py       # Pydantic request/response schemas
├── config.js            # Frontend TMDB API configuration
├── index.html           # Main Single Page Application interface
├── requirements.txt     # Root requirements for cloud deployments (Render)
├── run_server.py        # Local development server launcher
├── script.js            # Frontend application logic & state sync
├── styles.css           # UI/UX Pro Max Theater Dark design system
└── test_api.py          # API integration test suite
```

---

## 🚀 Getting Started Locally

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Start the Server
```bash
python run_server.py
```

Open `http://127.0.0.1:8000` in your browser.

---
