from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr

# Auth Schemas
class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    username_or_email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any]

class UserProfileUpdate(BaseModel):
    bio: Optional[str] = None

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    bio: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# Movie Journal & Log Schemas
class MovieLogCreateUpdate(BaseModel):
    movie_id: int
    status: Optional[str] = "watchlist"
    is_pinned: Optional[bool] = False
    is_favorite: Optional[bool] = False
    user_rating: Optional[float] = 0.0
    feeling: Optional[str] = None
    personal_notes: Optional[str] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    watch_progress: Optional[int] = 0
    movie_meta_json: Optional[str] = None # JSON stringified movie metadata

class MovieLogOut(BaseModel):
    id: int
    movie_id: int
    status: Optional[str]
    is_pinned: bool
    is_favorite: bool
    user_rating: float
    feeling: Optional[str]
    personal_notes: Optional[str]
    started_at: Optional[str]
    ended_at: Optional[str]
    watch_progress: int
    movie_meta_json: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Custom List Schemas
class CustomListCreate(BaseModel):
    name: str

class CustomListItemCreate(BaseModel):
    movie_id: int
    movie_meta_json: Optional[str] = None

class CustomListItemOut(BaseModel):
    id: int
    movie_id: int
    movie_meta_json: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class CustomListOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    items: List[CustomListItemOut] = []

    class Config:
        from_attributes = True

# Complete User State Sync Schema
class UserStateSyncOut(BaseModel):
    user: UserOut
    movie_logs: List[MovieLogOut]
    custom_lists: List[CustomListOut]
    stats: Dict[str, Any]
