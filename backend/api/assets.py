from fastapi import APIRouter, Query, HTTPException
from db.supabase_client import (
    get_structural_scores,
    get_score_history,
    get_narrative_scores,
)
from modules.scanner import scan_symbol, run_full_scan
from modules.narrative import scan_narrative
from db.supabase_client import upsert_structural_score, upsert_narrative_score, insert_score_history

router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("/scan")
async def get_scanned_assets(
    phase: str = Query(None, description="Emerging | Confirmed | Structural"),
    state: str = Query(None, description="accumulation | breakout | rotation | squeeze | none"),
    limit: int = Query(50, le=100),
):
    """Return latest structural scores, optionally filtered by phase."""
    result = await get_structural_scores(phase=phase, limit=limit)
    data = result.data or []
    if state:
        data = [d for d in data if d.get("structural_state") == state]
    return {"data": data, "count": len(data)}


@router.get("/{symbol}/history")
async def get_asset_history(symbol: str, days: int = Query(90, le=365)):
    """Return score history for charts."""
    result = await get_score_history(symbol.upper(), days=days)
    return {"symbol": symbol.upper(), "history": result.data or []}


@router.get("/{symbol}/narrative")
async def get_asset_narrative(symbol: str):
    """Return latest narrative scores for a symbol."""
    result = await get_narrative_scores(symbol.upper())
    return {"symbol": symbol.upper(), "narratives": result.data or []}


@router.post("/rescan/{symbol}")
async def rescan_symbol(symbol: str):
    """Trigger an immediate rescan of a single symbol."""
    sym = symbol.upper()
    structural = scan_symbol(sym)
    if not structural:
        raise HTTPException(status_code=404, detail=f"Could not scan {sym}")

    await upsert_structural_score(structural)

    name = structural.get("name", sym)
    narrative = await scan_narrative(sym, name)
    if narrative:
        await upsert_narrative_score(narrative)

    # Store score history
    await insert_score_history({
        "symbol": sym,
        "date": structural["date"],
        "structural_score": structural["trend_persistence_score"],
        "narrative_score": narrative["narrative_persistence_score"] if narrative else 0,
        "combined_score": int(
            structural["trend_persistence_score"] * 0.65
            + (narrative["narrative_persistence_score"] if narrative else 0) * 0.35
        ),
    })

    return {
        "structural": structural,
        "narrative": narrative,
    }


@router.get("/summary/phases")
async def get_phase_summary():
    """Return counts by phase and state for dashboard overview."""
    all_result = await get_structural_scores(limit=200)
    all_data = all_result.data or []

    phases = {"Emerging": [], "Confirmed": [], "Structural": []}
    states = {"accumulation": 0, "breakout": 0, "rotation": 0, "squeeze": 0, "none": 0}

    for item in all_data:
        phase = item.get("phase", "Emerging")
        if phase in phases:
            phases[phase].append(item)
        state = item.get("structural_state", "none")
        if state in states:
            states[state] += 1

    return {
        "phases": {k: len(v) for k, v in phases.items()},
        "states": states,
        "top_by_phase": {
            k: v[:5] for k, v in phases.items()
        },
    }
