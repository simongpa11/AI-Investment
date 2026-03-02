from fastapi import APIRouter, HTTPException
from db.supabase_client import get_watchlist, add_to_watchlist, remove_from_watchlist, get_score_history, get_structural_scores, get_narrative_scores

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


@router.get("")
async def get_user_watchlist():
    """Return all watched assets with latest scores."""
    result = await get_watchlist()
    data = result.data or []

    # Enrich each item with latest structural + narrative scores
    enriched = []
    for item in data:
        symbol = item["symbol"]
        struct = await get_structural_scores(limit=1)
        struct_data = next(
            (r for r in (struct.data or []) if r["symbol"] == symbol), None
        )
        hist = await get_score_history(symbol, days=30)

        enriched.append({
            "symbol": symbol,
            "added_at": item.get("added_at"),
            "is_active": item.get("is_active", True),
            "notes": item.get("notes", ""),
            "structural": struct_data,
            "history": hist.data or [],
        })

    return {"watchlist": enriched}


@router.post("/{symbol}")
async def watch_symbol(symbol: str):
    """Add a symbol to the watchlist."""
    sym = symbol.upper()
    result = await add_to_watchlist(sym)
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to add to watchlist")
    return {"message": f"{sym} added to watchlist", "symbol": sym}


@router.delete("/{symbol}")
async def unwatch_symbol(symbol: str):
    """Remove a symbol from the watchlist."""
    sym = symbol.upper()
    await remove_from_watchlist(sym)
    return {"message": f"{sym} removed from watchlist", "symbol": sym}


@router.get("/{symbol}/dossier")
async def get_dossier(symbol: str):
    """Get full dossier for a watched symbol."""
    sym = symbol.upper()
    history = await get_score_history(sym, days=365)
    narrative = await get_narrative_scores(sym)
    struct = await get_structural_scores(limit=1)
    struct_data = next(
        (r for r in (struct.data or []) if r["symbol"] == sym), None
    )

    return {
        "symbol": sym,
        "structural": struct_data,
        "score_history": history.data or [],
        "narrative_history": narrative.data or [],
    }
