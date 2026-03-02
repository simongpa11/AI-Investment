"""
Module 2 — Narrative & Social Intelligence
Fetches news via Finnhub, analyzes with Gemini LLM.
"""
import logging
import math
from datetime import datetime, timedelta, date
from typing import Optional
import httpx

from config import FINNHUB_API_KEY
from modules.gemini import analyze_narrative

logger = logging.getLogger(__name__)

SOURCE_WEIGHTS = {
    "reuters": 1.0,
    "bloomberg": 1.0,
    "financial times": 0.9,
    "wall street journal": 0.9,
    "wsj": 0.9,
    "barron's": 0.8,
    "cnbc": 0.7,
    "marketwatch": 0.65,
    "seeking alpha": 0.5,
    "benzinga": 0.4,
    "yahoo finance": 0.4,
    "motley fool": 0.35,
    "unknown": 0.3,
}

FINNHUB_BASE = "https://finnhub.io/api/v1"


def get_source_weight(source: str) -> float:
    if not source:
        return SOURCE_WEIGHTS["unknown"]
    src = source.lower()
    for key, weight in SOURCE_WEIGHTS.items():
        if key in src:
            return weight
    return SOURCE_WEIGHTS["unknown"]


# ──────────────────────────────────────────────
# NEWS FETCHING
# ──────────────────────────────────────────────
async def fetch_finnhub_news(symbol: str, days_back: int = 30) -> list[dict]:
    """Fetch company news from Finnhub."""
    if not FINNHUB_API_KEY:
        return []
    
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")

    params = {
        "symbol": symbol,
        "from": start_date,
        "to": end_date,
        "token": FINNHUB_API_KEY,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{FINNHUB_BASE}/company-news", params=params)
            if resp.status_code == 200:
                articles = resp.json()
                return articles if isinstance(articles, list) else []
    except Exception as e:
        logger.error(f"Finnhub news error for {symbol}: {e}")
    return []


async def fetch_yahoo_rss_news(symbol: str) -> list[dict]:
    """Fallback: Fetch Yahoo Finance RSS news (no API key needed)."""
    url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                # Parse simple RSS
                import xml.etree.ElementTree as ET
                root = ET.fromstring(resp.text)
                articles = []
                for item in root.findall(".//item")[:20]:
                    title = item.findtext("title") or ""
                    desc = item.findtext("description") or ""
                    pub_date = item.findtext("pubDate") or ""
                    articles.append({
                        "headline": title,
                        "summary": desc,
                        "source": "Yahoo Finance",
                        "datetime": pub_date,
                    })
                return articles
    except Exception as e:
        logger.error(f"Yahoo RSS error for {symbol}: {e}")
    return []


async def fetch_news(symbol: str) -> list[dict]:
    """Try Finnhub first, fallback to Yahoo Finance RSS."""
    articles = await fetch_finnhub_news(symbol)
    if not articles:
        articles = await fetch_yahoo_rss_news(symbol)
    return articles


# ──────────────────────────────────────────────
# NARRATIVE PERSISTENCE SCORE
# ──────────────────────────────────────────────
def compute_narrative_persistence_score(
    articles: list[dict],
    gemini_result: Optional[dict],
    days: int = 30,
) -> dict:
    """
    Score 0–100 based on:
    - Growing mentions in last 7-14 days (+30)
    - Source quality weighted (+20)
    - Theme consistency (+20)
    - Tone trending positive (+15)
    - Strategic plausibility (+15)
    """
    if not articles:
        return {
            "score": 0,
            "mention_growth": 0,
            "source_quality": 0,
            "tone_trend": "stable",
            "article_count": 0,
        }

    # Bucket articles by week
    now = datetime.now()
    week1 = []  # Last 7 days
    week2 = []  # 7-14 days ago
    week3 = []  # 14-21 days ago

    for a in articles:
        ts = a.get("datetime") or 0
        if isinstance(ts, (int, float)):
            pub = datetime.fromtimestamp(ts)
        else:
            try:
                pub = datetime.fromisoformat(str(ts).replace("Z", "+00:00").replace(" +0000", ""))
            except Exception:
                pub = now - timedelta(days=15)

        delta = (now - pub).days
        if delta <= 7:
            week1.append(a)
        elif delta <= 14:
            week2.append(a)
        elif delta <= 21:
            week3.append(a)

    # Mention growth
    growth_score = 0
    if len(week1) > len(week2) and len(week2) >= 1:
        growth_ratio = len(week1) / len(week2)
        if growth_ratio >= 2.0:
            growth_score = 30
        elif growth_ratio >= 1.5:
            growth_score = 22
        elif growth_ratio >= 1.2:
            growth_score = 15
        elif growth_ratio >= 1.0:
            growth_score = 8
    elif len(week1) >= 3:
        growth_score = 5  # Some presence

    # Source quality
    weights = [get_source_weight(a.get("source") or "") for a in articles[:20]]
    avg_quality = sum(weights) / len(weights) if weights else 0
    quality_score = avg_quality * 20

    # Theme consistency (from Gemini)
    theme_score = 0
    tone_trend = "stable"
    plausibility_score = 0
    tone_score = 0

    if gemini_result:
        # Plausibility
        plausibility = gemini_result.get("strategic_plausibility", 5)
        plausibility_score = (plausibility / 10) * 15

        # Theme consistency: multiple themes = less consistent
        themes = gemini_result.get("key_themes", [])
        if len(themes) <= 2:
            theme_score = 20
        elif len(themes) <= 4:
            theme_score = 12
        else:
            theme_score = 5

        # Tone trend
        tone_trend = gemini_result.get("tone_trend", "stable")
        if tone_trend == "improving":
            tone_score = 15
        elif tone_trend == "stable" and gemini_result.get("tone") == "bullish":
            tone_score = 10
        elif tone_trend == "stable":
            tone_score = 5

        # Language penalty for hype
        lang = gemini_result.get("language_quality", "balanced")
        if lang == "hype":
            theme_score = max(0, theme_score - 8)

    total = growth_score + quality_score + theme_score + tone_score + plausibility_score
    total = int(min(max(total, 0), 100))

    return {
        "score": total,
        "mention_growth": round(len(week1) / max(len(week2), 1), 2),
        "source_quality": round(avg_quality, 3),
        "tone_trend": tone_trend,
        "article_count": len(articles),
        "week1_count": len(week1),
        "week2_count": len(week2),
    }


# ──────────────────────────────────────────────
# MAIN NARRATIVE SCAN
# ──────────────────────────────────────────────
async def scan_narrative(symbol: str, name: str = "") -> Optional[dict]:
    """
    Run the full narrative scan for a symbol.
    Returns structured result for storage.
    """
    name = name or symbol
    logger.info(f"Narrative scan: {symbol}")

    articles = await fetch_news(symbol)
    gemini_result = await analyze_narrative(symbol, name, articles)
    persistence = compute_narrative_persistence_score(articles, gemini_result)

    today = date.today().isoformat()

    narrative_type = "other"
    language_quality = "balanced"
    summary_ai = ""

    if gemini_result:
        narrative_type = gemini_result.get("narrative_type", "other")
        language_quality = gemini_result.get("language_quality", "balanced")
        summary_ai = gemini_result.get("summary", "")

    return {
        "symbol": symbol,
        "date": today,
        "narrative_persistence_score": persistence["score"],
        "narrative_type": narrative_type,
        "source_quality": persistence["source_quality"],
        "tone_change": persistence["tone_trend"],
        "summary_ai": summary_ai,
        "article_count": persistence["article_count"],
        "details_json": {
            "persistence": persistence,
            "gemini": gemini_result,
        },
    }
