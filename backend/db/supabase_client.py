from __future__ import annotations
from typing import Optional, List
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


async def upsert_structural_score(data: dict):
    client = get_client()
    return client.table("structural_scores").upsert(data, on_conflict="symbol,date").execute()


async def upsert_narrative_score(data: dict):
    client = get_client()
    return client.table("narrative_scores").upsert(data, on_conflict="symbol,date").execute()


async def insert_score_history(data: dict):
    client = get_client()
    return client.table("score_history").upsert(data, on_conflict="symbol,date").execute()


async def get_structural_scores(phase: Optional[str] = None, limit: int = 100):
    client = get_client()
    query = (
        client.table("structural_scores")
        .select("*")
        .order("trend_persistence_score", desc=True)
        .limit(limit)
    )
    if phase:
        query = query.eq("phase", phase)
    return query.execute()

async def get_last_scan_time():
    client = get_client()
    return (
        client.table("structural_scores")
        .select("created_at")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )


async def get_score_history(symbol: str, days: int = 90):
    client = get_client()
    return (
        client.table("score_history")
        .select("*")
        .eq("symbol", symbol)
        .order("date", desc=False)
        .limit(days)
        .execute()
    )


async def get_watchlist():
    client = get_client()
    return (
        client.table("watchlist")
        .select("symbol, added_at, is_active, notes")
        .eq("is_active", True)
        .order("added_at", desc=True)
        .execute()
    )


async def add_to_watchlist(symbol: str):
    client = get_client()
    return (
        client.table("watchlist")
        .upsert({"symbol": symbol, "is_active": True}, on_conflict="symbol")
        .execute()
    )


async def remove_from_watchlist(symbol: str):
    client = get_client()
    return (
        client.table("watchlist")
        .delete()
        .eq("symbol", symbol)
        .execute()
    )


async def get_narrative_scores(symbol: str):
    client = get_client()
    return (
        client.table("narrative_scores")
        .select("*")
        .eq("symbol", symbol)
        .order("date", desc=True)
        .limit(30)
        .execute()
    )


async def get_latest_scores(symbols: Optional[List[str]] = None):
    """Get the most recent structural + narrative score for each symbol."""
    client = get_client()
    q = (
        client.table("structural_scores")
        .select("*, narrative_scores!inner(*)")
        .order("date", desc=True)
    )
    if symbols:
        q = q.in_("symbol", symbols)
    return q.execute()
