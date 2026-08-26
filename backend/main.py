import os
import json
import httpx
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .database import engine, Base, get_db
from .models import User, UserMovieLog, CustomList, CustomListItem
from .schemas import (
    UserRegister, UserLogin, Token, UserOut, UserProfileUpdate,
    MovieLogCreateUpdate, MovieLogOut, CustomListCreate, CustomListItemCreate,
    CustomListOut, CustomListItemOut, UserStateSyncOut
)
from .auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_current_user
)

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MyCinemaList API",
    description="Full-stack Movie Tracking, Journaling, Notes, and Lists Backend",
    version="1.0.0"
)

# Enable CORS for local development and web access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TMDB_API_KEY = os.getenv("TMDB_API_KEY", "411eb787500b2a68f84396d235f4ddc6")
TMDB_BASE_URL = "https://api.themoviedb.org/3"

# ==========================================
# 1. AUTHENTICATION & USER PROFILE
# ==========================================

@app.post("/api/auth/register", response_model=Token)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    # Check if username or email already exists
    existing_user = db.query(User).filter(
        (User.username == user_data.username) | (User.email == user_data.email)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered."
        )
    
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hash_password(user_data.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = create_access_token(data={"sub": str(new_user.id)})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
            "bio": new_user.bio,
            "created_at": new_user.created_at.isoformat()
        }
    }

from sqlalchemy import func

@app.post("/api/auth/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    target = login_data.username_or_email.strip().lower()
    user = db.query(User).filter(
        (func.lower(User.username) == target) | (func.lower(User.email) == target)
    ).first()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password."
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "bio": user.bio,
            "created_at": user.created_at.isoformat()
        }
    }

@app.get("/api/auth/me", response_model=UserOut)
def get_me(current_user: User = Depends(require_current_user)):
    return current_user

@app.put("/api/auth/profile", response_model=UserOut)
def update_profile(
    profile_update: UserProfileUpdate,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    if profile_update.bio is not None:
        current_user.bio = profile_update.bio
    db.commit()
    db.refresh(current_user)
    return current_user


# ==========================================
# 2. FULL USER STATE SYNC & STATS
# ==========================================

@app.get("/api/user/sync", response_model=UserStateSyncOut)
def sync_user_state(
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    movie_logs = db.query(UserMovieLog).filter(UserMovieLog.user_id == current_user.id).all()
    custom_lists = db.query(CustomList).filter(CustomList.user_id == current_user.id).all()
    
    # Calculate stats
    watchlist_count = sum(1 for m in movie_logs if m.status == "watchlist")
    watching_count = sum(1 for m in movie_logs if m.status == "watching")
    watched_count = sum(1 for m in movie_logs if m.status == "watched")
    pinned_count = sum(1 for m in movie_logs if m.is_pinned)
    journal_entries_count = sum(1 for m in movie_logs if m.personal_notes or m.feeling)
    
    # Calculate total watched hours if metadata exists
    total_minutes = 0
    for m in movie_logs:
        if m.status == "watched" and m.movie_meta_json:
            try:
                meta = json.loads(m.movie_meta_json)
                total_minutes += int(meta.get("runtime", 110) or 110)
            except Exception:
                total_minutes += 110
                
    stats = {
        "watchlist": watchlist_count,
        "watching": watching_count,
        "watched": watched_count,
        "pinned": pinned_count,
        "journal_entries": journal_entries_count,
        "watch_time_hours": round(total_minutes / 60, 1),
    }

    return {
        "user": current_user,
        "movie_logs": movie_logs,
        "custom_lists": custom_lists,
        "stats": stats
    }


# ==========================================
# 3. MOVIE JOURNAL & LOGS CRUD
# ==========================================

@app.get("/api/journal/movies", response_model=List[MovieLogOut])
def get_user_movie_logs(
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(UserMovieLog).filter(UserMovieLog.user_id == current_user.id)
    if status_filter:
        query = query.filter(UserMovieLog.status == status_filter)
    return query.order_by(UserMovieLog.updated_at.desc()).all()

@app.post("/api/journal/movies", response_model=MovieLogOut)
def create_or_update_movie_log(
    log_data: MovieLogCreateUpdate,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    existing = db.query(UserMovieLog).filter(
        UserMovieLog.user_id == current_user.id,
        UserMovieLog.movie_id == log_data.movie_id
    ).first()

    if existing:
        if log_data.status is not None:
            existing.status = log_data.status
        if log_data.is_pinned is not None:
            existing.is_pinned = log_data.is_pinned
        if log_data.is_favorite is not None:
            existing.is_favorite = log_data.is_favorite
        if log_data.user_rating is not None:
            existing.user_rating = log_data.user_rating
        if log_data.feeling is not None:
            existing.feeling = log_data.feeling
        if log_data.personal_notes is not None:
            existing.personal_notes = log_data.personal_notes
        if log_data.started_at is not None:
            existing.started_at = log_data.started_at
        if log_data.ended_at is not None:
            existing.ended_at = log_data.ended_at
        if log_data.watch_progress is not None:
            existing.watch_progress = log_data.watch_progress
        if log_data.movie_meta_json is not None:
            existing.movie_meta_json = log_data.movie_meta_json
        
        db.commit()
        db.refresh(existing)
        return existing
    else:
        new_log = UserMovieLog(
            user_id=current_user.id,
            movie_id=log_data.movie_id,
            status=log_data.status or "watchlist",
            is_pinned=log_data.is_pinned or False,
            is_favorite=log_data.is_favorite or False,
            user_rating=log_data.user_rating or 0.0,
            feeling=log_data.feeling,
            personal_notes=log_data.personal_notes,
            started_at=log_data.started_at,
            ended_at=log_data.ended_at,
            watch_progress=log_data.watch_progress or 0,
            movie_meta_json=log_data.movie_meta_json
        )
        db.add(new_log)
        db.commit()
        db.refresh(new_log)
        return new_log

@app.delete("/api/journal/movies/{movie_id}")
def delete_movie_log(
    movie_id: int,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    log = db.query(UserMovieLog).filter(
        UserMovieLog.user_id == current_user.id,
        UserMovieLog.movie_id == movie_id
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Movie log not found")
    db.delete(log)
    db.commit()
    return {"message": "Movie log removed successfully"}


# ==========================================
# 4. CUSTOM LISTS CRUD
# ==========================================

@app.get("/api/lists", response_model=List[CustomListOut])
def get_custom_lists(
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    return db.query(CustomList).filter(CustomList.user_id == current_user.id).all()

@app.post("/api/lists", response_model=CustomListOut)
def create_custom_list(
    list_data: CustomListCreate,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    existing = db.query(CustomList).filter(
        CustomList.user_id == current_user.id,
        CustomList.name == list_data.name.strip()
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="List with this name already exists")
    
    new_list = CustomList(user_id=current_user.id, name=list_data.name.strip())
    db.add(new_list)
    db.commit()
    db.refresh(new_list)
    return new_list

@app.delete("/api/lists/{list_id}")
def delete_custom_list(
    list_id: int,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    c_list = db.query(CustomList).filter(
        CustomList.id == list_id,
        CustomList.user_id == current_user.id
    ).first()
    if not c_list:
        raise HTTPException(status_code=404, detail="Custom list not found")
    db.delete(c_list)
    db.commit()
    return {"message": "List deleted successfully"}

@app.post("/api/lists/{list_id}/items", response_model=CustomListItemOut)
def add_item_to_list(
    list_id: int,
    item_data: CustomListItemCreate,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    c_list = db.query(CustomList).filter(
        CustomList.id == list_id,
        CustomList.user_id == current_user.id
    ).first()
    if not c_list:
        raise HTTPException(status_code=404, detail="Custom list not found")
    
    # Check if already in list
    existing_item = db.query(CustomListItem).filter(
        CustomListItem.list_id == list_id,
        CustomListItem.movie_id == item_data.movie_id
    ).first()
    if existing_item:
        return existing_item

    new_item = CustomListItem(
        list_id=list_id,
        movie_id=item_data.movie_id,
        movie_meta_json=item_data.movie_meta_json
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@app.delete("/api/lists/{list_id}/items/{movie_id}")
def remove_item_from_list(
    list_id: int,
    movie_id: int,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(CustomListItem).join(CustomList).filter(
        CustomList.id == list_id,
        CustomList.user_id == current_user.id,
        CustomListItem.movie_id == movie_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in this list")
    db.delete(item)
    db.commit()
    return {"message": "Movie removed from list"}


# ==========================================
# 5. RECOMMENDATIONS (genre-weighted from watch history)
# ==========================================

@app.get("/api/recommendations")
async def get_recommendations(
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    logs = db.query(UserMovieLog).filter(UserMovieLog.user_id == current_user.id).all()

    # Build weighted genre map from watched movies
    genre_weights: dict[int, float] = {}
    excluded_ids: set[int] = set()

    for log in logs:
        excluded_ids.add(log.movie_id)
        if log.status == "watched" and log.movie_meta_json:
            try:
                meta = json.loads(log.movie_meta_json)
                genre_ids = meta.get("genre_ids", [])
                weight = max(log.user_rating or 5.0, 1.0)
                for gid in genre_ids:
                    genre_weights[gid] = genre_weights.get(gid, 0) + weight
            except Exception:
                pass

    if not genre_weights:
        # Fallback: return trending if no watch history
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{TMDB_BASE_URL}/trending/movie/week?api_key={TMDB_API_KEY}&language=en-US"
            )
            data = res.json()
            return data.get("results", [])[:20]

    # Top 3 genres by weight
    top_genres = sorted(genre_weights.items(), key=lambda x: x[1], reverse=True)[:3]
    genre_id_str = ",".join(str(g[0]) for g in top_genres)

    async with httpx.AsyncClient() as client:
        url = (
            f"{TMDB_BASE_URL}/discover/movie"
            f"?api_key={TMDB_API_KEY}&language=en-US"
            f"&with_genres={genre_id_str}&sort_by=popularity.desc"
            f"&vote_count.gte=100&page=1"
        )
        res = await client.get(url)
        results = res.json().get("results", [])

    # Exclude already tracked movies
    filtered = [m for m in results if m["id"] not in excluded_ids]
    return filtered[:20]


# ==========================================
# 6. TMDB SECURE PROXY
# ==========================================

@app.get("/api/movies/popular")
async def tmdb_popular(page: int = 1):
    url = f"{TMDB_BASE_URL}/movie/popular?api_key={TMDB_API_KEY}&language=en-US&page={page}"
    async with httpx.AsyncClient() as client:
        res = await client.get(url)
        return res.json()

@app.get("/api/movies/search")
async def tmdb_search(query: str = Query(..., min_length=1), page: int = 1):
    url = f"{TMDB_BASE_URL}/search/movie?api_key={TMDB_API_KEY}&language=en-US&query={query}&page={page}&include_adult=false"
    async with httpx.AsyncClient() as client:
        res = await client.get(url)
        return res.json()

@app.get("/api/movies/{movie_id}")
async def tmdb_details(movie_id: int):
    url = f"{TMDB_BASE_URL}/movie/{movie_id}?api_key={TMDB_API_KEY}&language=en-US&append_to_response=videos,credits,similar"
    async with httpx.AsyncClient() as client:
        res = await client.get(url)
        return res.json()


# ==========================================
# 6. STATIC ASSETS & SINGLE PAGE APPLICATION
# ==========================================

workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(workspace_root, "index.html"))

app.mount("/", StaticFiles(directory=workspace_root, html=True), name="static")
