import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SQLITE_URL = f"sqlite:///{ROOT_DIR / 'server' / 'data' / 'ifl.sqlite3'}"
DATABASE_URL = (os.getenv("DATABASE_URL", DEFAULT_SQLITE_URL) or DEFAULT_SQLITE_URL).strip()
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required")

engine_kwargs = {"future": True}
if DATABASE_URL.startswith("sqlite:///"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_pre_ping"] = True

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
