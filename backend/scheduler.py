"""
APScheduler — 3 daily scan jobs (CET / Europe/Madrid timezone).

  08:00 CET → Asia close + Europe open
  18:45 CET → Europe close + US mid-session
  22:45 CET → US close (principal — full snapshot saved to history)
"""
import asyncio
import logging
from datetime import date
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from config import SCAN_UNIVERSE
from modules.scanner import run_full_scan
from modules.narrative import scan_narrative
from db.supabase_client import (
    upsert_structural_score,
    upsert_narrative_score,
    insert_score_history,
)

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler(timezone="Europe/Madrid")

# ─── SCAN JOBS ────────────────────────────────────────────────────────────────

async def _run_structural():
    """Run structural scan and persist scores. Returns results list."""
    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(None, run_full_scan, SCAN_UNIVERSE)
    for r in results:
        try:
            await upsert_structural_score(r)
        except Exception as e:
            logger.error(f"DB error structural {r['symbol']}: {e}")
    return results


async def _run_narrative(structural_results: list, save_history: bool = False):
    """Run narrative scan for all symbols. Optionally saves score history snapshot."""
    logger.info(f"📰 Narrative scan — {len(structural_results)} symbols (history={save_history})")
    for result in structural_results:
        symbol = result["symbol"]
        name = result.get("name", symbol)
        try:
            narrative = await scan_narrative(symbol, name)
            if narrative:
                await upsert_narrative_score(narrative)

                if save_history:
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
            logger.error(f"Narrative error {symbol}: {e}")
        await asyncio.sleep(0.5)


async def scan_morning():
    """
    08:00 CET — Asia close / Europe open.
    Structural only (quick). Detects overnight gaps and Asian rotations.
    No history snapshot (not end-of-day data).
    """
    logger.info(f"🌅 08:00 Morning scan — {date.today()}")
    results = await _run_structural()
    logger.info(f"✅ Morning scan done — {len(results)} symbols")


async def scan_afternoon():
    """
    18:45 CET — Europe close / US mid-session.
    Structural + Narrative. Confirms European structure, detects US continuation.
    No history snapshot (US not closed yet).
    """
    logger.info(f"🌆 18:45 Afternoon scan — {date.today()}")
    results = await _run_structural()
    await _run_narrative(results, save_history=False)
    logger.info(f"✅ Afternoon scan done — {len(results)} symbols")


async def scan_eod():
    """
    22:45 CET — US close (PRINCIPAL).
    Full structural + narrative + score history snapshot.
    This is the definitive daily snapshot used for trend persistence scoring.
    """
    logger.info(f"🌙 22:45 EOD scan — {date.today()}")
    results = await _run_structural()
    await _run_narrative(results, save_history=True)
    logger.info(f"✅ EOD scan complete — {len(results)} symbols — history saved")


# Alias for manual trigger via API endpoint
async def daily_scan_job():
    """Manual trigger — runs the full EOD scan (structural + narrative + history)."""
    await scan_eod()


# ─── SCHEDULER LIFECYCLE ──────────────────────────────────────────────────────

def start_scheduler():
    """Register the 3 daily scan jobs and start the scheduler."""
    # 1️⃣ 08:00 CET — Morning (Asia close / Europe open)
    scheduler.add_job(
        scan_morning,
        CronTrigger(hour=8, minute=0, timezone="Europe/Madrid"),
        id="scan_morning",
        replace_existing=True,
    )

    # 2️⃣ 18:45 CET — Afternoon (Europe close / US mid-session)
    scheduler.add_job(
        scan_afternoon,
        CronTrigger(hour=18, minute=45, timezone="Europe/Madrid"),
        id="scan_afternoon",
        replace_existing=True,
    )

    # 3️⃣ 22:45 CET — EOD (US close — PRINCIPAL)
    scheduler.add_job(
        scan_eod,
        CronTrigger(hour=22, minute=45, timezone="Europe/Madrid"),
        id="scan_eod",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler started — scans at 08:00, 18:45, 22:45 CET")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
