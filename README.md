# MyCinemaList — Full-Stack Movie Journal & Watchlist Platform

**Live Deployment**: [https://mycinemalist-b0lh.onrender.com/](https://mycinemalist-b0lh.onrender.com/)

A full-stack web application designed for movie tracking, watchlist management, detailed journaling, personal rating logs, emotional reaction tracking, and personalized recommendation generation.

---

## Features

- **Authentication & User Management**:
  - User registration and login utilizing JWT bearer tokens and password hashing.
  - User-isolated data storage with cloud synchronization and local cache fallback.

- **Movie Journaling & Watch History**:
  - Detailed review entries including reflections, quotes, and custom ratings (1–10).
  - Categorized reaction tracking (Mind-blown, Emotional, Loved it, Fun & Chill, Thrilling, Bored, etc.).
  - Watch progress date tracking with start and finish timestamps.

- **Recommendation Engine**:
  - Dynamic movie recommendation computation based on watch history and user rating weights.

- **Journal Feed**:
  - Chronological timeline interface displaying user-logged movies and historical reviews.

- **Movie Discovery & Watchlist Management**:
  - Real-time TMDB movie search and genre-based filtering.
  - Multi-status tracking: Watchlist, Watching, and Watched.
  - Pinned favorites and custom user-defined lists.
  - Interactive hero banner with trending movie highlights.

---

## Tech Stack

- **Backend**:
  - Python
  - FastAPI
  - Uvicorn
  - SQLAlchemy
  - SQLite
  - Pydantic
  - Python-JOSE (JWT)
  - Passlib / Bcrypt
  - HTTPX

- **Frontend**:
  - HTML5
  - CSS3
  - JavaScript (ES6+)

- **External APIs & Services**:
  - The Movie Database (TMDB) API
  - Render (Deployment Platform)

---

## Repository Structure

```text
MyCinemaList/
├── backend/
│   ├── auth.py          # JWT authentication and password hashing
│   ├── database.py      # SQLAlchemy database engine and session setup
│   ├── main.py          # FastAPI API routes and TMDB proxy endpoints
│   ├── models.py        # Database models (User, MovieLog, CustomList)
│   ├── requirements.txt # Backend Python dependencies
│   └── schemas.py       # Pydantic request and response schemas
├── config.js            # TMDB API client configuration
├── index.html           # Single-page application markup
├── requirements.txt     # Root dependencies for deployment
├── run_server.py        # Local server execution script
├── script.js            # Frontend client application logic and state synchronization
├── styles.css           # Application styling sheet
└── test_api.py          # Backend integration test suite
```

---

## Getting Started Locally

### 1. Prerequisites
- Python 3.10+
- `pip`

### 2. Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/your-username/MyCinemaList.git
cd MyCinemaList
pip install -r requirements.txt
```

### 3. Run the Application

Start the local server:

```bash
python run_server.py
```

Access the application in your browser at `http://127.0.0.1:8000`.

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT token |
| `GET` | `/api/auth/me` | Retrieve current authenticated user profile |
| `GET` | `/api/movies` | Fetch all user movie logs and status records |
| `POST` | `/api/movies` | Add or update a movie log entry |
| `DELETE` | `/api/movies/{movie_id}` | Remove a movie from logs |
| `GET` | `/api/lists` | Retrieve user custom lists |
| `POST` | `/api/lists` | Create a new custom list |
| `GET` | `/api/tmdb/trending` | Proxy endpoint for TMDB trending movies |
| `GET` | `/api/tmdb/search` | Proxy endpoint for TMDB movie search |
