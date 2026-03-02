"""
AI Investment Platform — FastAPI Backend
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from scheduler import start_scheduler, stop_scheduler, daily_scan_job
from api.assets import router as assets_router
from api.watchlist import router as watchlist_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start/stop scheduler on app startup/shutdown."""
    logger.info("🚀 Starting AI Investment Platform backend")
    start_scheduler()
    yield
    stop_scheduler()
    logger.info("Backend shutdown")


app = FastAPI(
    title="AI Investment Platform",
    description="Structural trend detection for medium-term investment",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets_router)
app.include_router(watchlist_router)


@app.get("/")
def root():
    return {"status": "ok", "message": "AI Investment Platform API"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/api/scan/run")
async def trigger_scan():
    """Manually trigger the full scan (useful for initial setup)."""
    import asyncio
    asyncio.create_task(daily_scan_job())
    return {"message": "Scan triggered in background"}
