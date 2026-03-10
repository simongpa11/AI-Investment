import httpx
import yfinance as yf
from fastapi import APIRouter, Query, HTTPException
from config import FINNHUB_API_KEY
from db.supabase_client import (
    get_structural_scores,
    get_score_history,
    get_narrative_scores,
)
from modules.scanner import scan_symbol, run_full_scan
from modules.narrative import scan_narrative
from db.supabase_client import upsert_structural_score, upsert_narrative_score, insert_score_history

router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("/dashboard")
async def get_dashboard_assets(limit: int = Query(50, le=100)):
    """Return top assets with their latest narrative score merged in (2 queries total)."""
    struct_res = await get_structural_scores(limit=200) # Increased limit to ensure we get a good pool before dedup
    raw_struct_data = struct_res.data or []
    if not raw_struct_data:
        return {"data": []}

    # Dedup structural scores: keep only the newest per symbol
    struct_map = {}
    for item in raw_struct_data:
        sym = item["symbol"]
        if sym not in struct_map or str(item["date"]) > str(struct_map[sym]["date"]):
            struct_map[sym] = item
            
    struct_data = list(struct_map.values())
    
    # Optionally sort them by score or let frontend handle it
    struct_data.sort(key=lambda x: x.get("trend_persistence_score", 0), reverse=True)
    if limit:
        struct_data = struct_data[:limit]
        
    if not struct_data:
        return {"data": []}

    # 2. Get narratives for these symbols in one go
    symbols = [s["symbol"] for s in struct_data]
    from db.supabase_client import get_client
    client = get_client()
    nar_res = client.table("narrative_scores").select("*").in_("symbol", symbols).execute()
    
    # Keep only the newest narrative per symbol
    nar_map = {}
    for n in (nar_res.data or []):
        sym = n["symbol"]
        # n["date"] is a string (e.g., '2026-03-05'), we can just string compare or store the latest
        if sym not in nar_map or str(n["date"]) > str(nar_map[sym]["date"]):
            nar_map[sym] = n

    # 3. Merge
    for item in struct_data:
        item["narrative"] = nar_map.get(item["symbol"])

    return {"data": struct_data}


@router.get("/last-scan")
async def get_last_scan():
    """Returns the most recent single scan time from the database."""
    from db.supabase_client import get_last_scan_time
    res = await get_last_scan_time()
    data = res.data or []
    if data:
        return {"last_scan": data[0]["created_at"]}
    return {"last_scan": None}


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


@router.get("/{symbol}/candles")
async def get_asset_candles(symbol: str, timeframe: str = Query("1M", description="1D, 1S, 1M, 1A, MAX")):
    """Return historical prices for the structural evolution chart."""
    try:
        period_map = {
            "1D": "1d",
            "1S": "5d",
            "1M": "1mo",
            "1A": "1y",
            "MAX": "max"
        }
        period = period_map.get(timeframe.upper(), "1mo")
        interval = "1d"
        if period == "1d":
            interval = "5m"
        elif period == "5d":
            interval = "30m"
            
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
        
        if df.empty:
            return {"symbol": symbol.upper(), "data": []}
            
        df = df.reset_index()
        col_name = "Date" if "Date" in df.columns else "Datetime"
        if col_name in df.columns:
            if interval != "1d":
                df["date"] = df[col_name].dt.strftime("%Y-%m-%d %H:%M")
            else:
                df["date"] = df[col_name].dt.strftime("%Y-%m-%d")
                
        result = df[["date", "Open", "High", "Low", "Close", "Volume"]].rename(columns=str.lower).to_dict(orient="records")
        return {"symbol": symbol.upper(), "data": result}
    except Exception as e:
        return {"symbol": symbol.upper(), "data": [], "error": str(e)}


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

@router.get("/search")
async def search_assets(q: str):
    """Search for symbols via Finnhub API."""
    if not q or len(q) < 2:
        return {"data": []}
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(
                f"https://finnhub.io/api/v1/search?q={q}&token={FINNHUB_API_KEY}"
            )
            data = res.json()
            # Finnhub returns { "count": ..., "result": [ {"description": "APPLE INC", "displaySymbol": "AAPL", "symbol": "AAPL", "type": "Common Stock"} ] }
            return {"data": data.get("result", [])}
        except Exception as e:
            return {"data": [], "error": str(e)}
