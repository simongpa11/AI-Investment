"""
APScheduler daily scan job.
Runs Module 1 (structural) + Module 2 (narrative) for all symbols.
"""
import asyncio
import logging
from datetime import date
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from config import SCAN_UNIVERSE, SCANNER_HOUR, SCANNER_MINUTE
from modules.scanner import run_full_scan, scan_symbol
from modules.narrative import scan_narrative
from db.supabase_client import (
    upsert_structural_score,
    upsert_narrative_score,
    insert_score_history,
)

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def daily_scan_job():
    """Full daily scan: structural + narrative for all universe symbols."""
    logger.info(f"🔍 Starting daily scan — {date.today()}")
    
    # Module 1: structural scan (sync, run in executor for CPU work)
    loop = asyncio.get_event_loop()
    structural_results = await loop.run_in_executor(None, run_full_scan, SCAN_UNIVERSE)

    # Build name map
    name_map = {r["symbol"]: r.get("name", r["symbol"]) for r in structural_results}

    # Persist structural scores
    for result in structural_results:
        try:
            await upsert_structural_score(result)
        except Exception as e:
            logger.error(f"DB error saving structural {result['symbol']}: {e}")

    # Module 2: narrative scan (async, per symbol)
    logger.info(f"📰 Starting narrative scan for {len(structural_results)} symbols")
    for result in structural_results:
        symbol = result["symbol"]
        name = name_map.get(symbol, symbol)
        try:
            narrative = await scan_narrative(symbol, name)
            if narrative:
                await upsert_narrative_score(narrative)

                # Score history snapshot
                narrative_score = narrative.get("narrative_persistence_score", 0)
                struct_score = result["trend_persistence_score"]
                combined = int(struct_score * 0.65 + narrative_score * 0.35)
                await insert_score_history({
                    "symbol": symbol,
                    "date": result["date"],
                    "structural_score": struct_score,
                    "narrative_score": narrative_score,
                    "combined_score": combined,
                })
        except Exception as e:
            logger.error(f"Narrative scan error {symbol}: {e}")
        
        # Small delay to avoid rate limiting
        await asyncio.sleep(0.5)

    logger.info("✅ Daily scan complete")


def start_scheduler():
    """Start the APScheduler with the daily scan job."""
    scheduler.add_job(
        daily_scan_job,
        CronTrigger(hour=SCANNER_HOUR, minute=SCANNER_MINUTE),
        id="daily_scan",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"Scheduler started — daily scan at {SCANNER_HOUR}:{SCANNER_MINUTE:02d}")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
