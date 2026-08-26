import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    bio = Column(String, default="Movie enthusiast & cinephile.")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    movie_logs = relationship("UserMovieLog", back_populates="user", cascade="all, delete-orphan")
    custom_lists = relationship("CustomList", back_populates="user", cascade="all, delete-orphan")


class UserMovieLog(Base):
    __tablename__ = "user_movie_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    movie_id = Column(Integer, nullable=False, index=True)
    
    # Status: 'watchlist', 'watching', 'watched', or None
    status = Column(String, default="watchlist")
    is_pinned = Column(Boolean, default=False)
    is_favorite = Column(Boolean, default=False)
    
    # Journaling & Feelings
    user_rating = Column(Float, default=0.0) # 0 to 10 scale
    feeling = Column(String, nullable=True) # e.g. "Mind-blown 🤩", "Emotional 😢", etc.
    personal_notes = Column(Text, nullable=True) # User's personal thoughts / review
    
    # Watch date tracker
    started_at = Column(String, nullable=True) # YYYY-MM-DD or datetime string
    ended_at = Column(String, nullable=True)   # YYYY-MM-DD or datetime string
    watch_progress = Column(Integer, default=0) # e.g. minutes watched or percentage
    
    # Cached movie details (JSON string: title, poster_path, backdrop_path, release_date, genres, runtime)
    movie_meta_json = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="movie_logs")


class CustomList(Base):
    __tablename__ = "custom_lists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="custom_lists")
    items = relationship("CustomListItem", back_populates="custom_list", cascade="all, delete-orphan")


class CustomListItem(Base):
    __tablename__ = "custom_list_items"

    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("custom_lists.id"), nullable=False, index=True)
    movie_id = Column(Integer, nullable=False)
    movie_meta_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    custom_list = relationship("CustomList", back_populates="items")
