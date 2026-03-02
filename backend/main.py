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


@app.post("/api/scan/manual/{symbol}")
async def trigger_manual_scan(symbol: str):
    """Manually scan a single symbol, save its history, and add it to watchlist."""
    import asyncio
    from fastapi import HTTPException
    from modules.scanner import scan_symbol
    from modules.narrative import scan_narrative
    from db.supabase_client import (
        upsert_structural_score,
        upsert_narrative_score,
        insert_score_history,
        add_to_watchlist
    )

    sym = symbol.upper()
    loop = asyncio.get_event_loop()
    
    # 1. Structural Scan
    result = await loop.run_in_executor(None, scan_symbol, sym)
    if not result:
        raise HTTPException(status_code=404, detail=f"Could not fetch data for {sym}. Invalid ticker?")

    await upsert_structural_score(result)

    # 2. Narrative Scan
    name = result.get("name", sym)
    narrative = await scan_narrative(sym, name)
    
    if narrative:
        await upsert_narrative_score(narrative)
        
        # 3. History Snapshot
        narrative_score = narrative.get("narrative_persistence_score", 0)
        struct_score = result["trend_persistence_score"]
        combined = int(struct_score * 0.65 + narrative_score * 0.35)
        await insert_score_history({
            "symbol": sym,
            "date": result["date"],
            "structural_score": struct_score,
            "narrative_score": narrative_score,
            "combined_score": combined,
        })
    
    # 4. Add to Watchlist
    await add_to_watchlist(sym)

    return {
        "message": f"Scan complete for {sym}",
        "symbol": sym,
        "structural": result,
        "narrative": narrative
    }
