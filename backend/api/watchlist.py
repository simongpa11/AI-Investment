from fastapi import APIRouter, HTTPException
from db.supabase_client import get_watchlist, add_to_watchlist, remove_from_watchlist, get_score_history, get_structural_scores, get_narrative_scores

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


@router.get("")
async def get_user_watchlist():
    """Return all watched assets with latest structured and narrative scores."""
    result = await get_watchlist()
    data = result.data or []
    if not data:
        return {"watchlist": []}

    symbols = [item["symbol"] for item in data]
    
    # Batch fetch structural scores
    from db.supabase_client import get_client
    client = get_client()
    struct_res = client.table("structural_scores").select("*").in_("symbol", symbols).execute()
    
    struct_map = {}
    for s in (struct_res.data or []):
        sym = s["symbol"]
        if sym not in struct_map or s["date"] > struct_map[sym]["date"]:
            struct_map[sym] = s
            
    # Batch fetch narratives
    nar_res = client.table("narrative_scores").select("*").in_("symbol", symbols).execute()
    nar_map = {}
    for n in (nar_res.data or []):
        sym = n["symbol"]
        if sym not in nar_map or n["date"] > nar_map[sym]["date"]:
            nar_map[sym] = n

    # Enrich each structural asset with its narrative
    for sym, s in struct_map.items():
        s["narrative"] = nar_map.get(sym)

    # Build final response
    enriched = []
    for item in data:
        symbol = item["symbol"]
        enriched.append({
            "symbol": symbol,
            "added_at": item.get("added_at"),
            "is_active": item.get("is_active", True),
            "notes": item.get("notes", ""),
            "structural": struct_map.get(symbol),
            "history": [], # Lazy loaded by DossierModal
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
