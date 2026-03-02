"""
Module 1 — Market Structural Scanner
Detects structural changes in market behavior for medium-term investment.
"""
import logging
from datetime import datetime, timedelta, date
from typing import Optional
import numpy as np
import pandas as pd
import yfinance as yf

from config import SECTOR_ETFS, SCAN_UNIVERSE

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# STRUCTURAL STATE CONSTANTS
# ──────────────────────────────────────────────
STATE_ACCUMULATION = "accumulation"       # 🟢
STATE_BREAKOUT = "breakout"               # 🟡
STATE_ROTATION = "rotation"               # 🔵
STATE_SQUEEZE = "squeeze"                 # 🔴
STATE_NONE = "none"                       # ⚪

PHASE_EMERGING = "Emerging"      # 0–7 days
PHASE_CONFIRMED = "Confirmed"    # 7–30 days
PHASE_STRUCTURAL = "Structural"  # 30+ days


# ──────────────────────────────────────────────
# DATA FETCHING
# ──────────────────────────────────────────────
def fetch_ohlcv(symbol: str, days: int = 250) -> Optional[pd.DataFrame]:
    """Fetch historical OHLCV data from Yahoo Finance."""
    try:
        start = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        ticker = yf.Ticker(symbol)
        df = ticker.history(start=start, auto_adjust=True)
        if df is None or len(df) < 60:
            return None
        df.index = pd.to_datetime(df.index.date)
        df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
        df.dropna(inplace=True)
        return df
    except Exception as e:
        logger.error(f"Error fetching {symbol}: {e}")
        return None


def fetch_sector_etf(sector_name: str) -> Optional[pd.DataFrame]:
    """Fetch ETF data for a given sector name."""
    etf_symbol = SECTOR_ETFS.get(sector_name)
    if not etf_symbol:
        return None
    return fetch_ohlcv(etf_symbol, days=250)


def get_ticker_info(symbol: str) -> dict:
    """Get basic company info."""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        return {
            "name": info.get("longName") or info.get("shortName") or symbol,
            "sector": info.get("sector") or "Unknown",
            "market_cap": info.get("marketCap") or 0,
            "short_percent": info.get("shortPercentOfFloat") or 0,
        }
    except Exception:
        return {"name": symbol, "sector": "Unknown", "market_cap": 0, "short_percent": 0}


# ──────────────────────────────────────────────
# SIGNAL 1 — VOLUME REGIME CHANGE
# ──────────────────────────────────────────────
def compute_volume_regime(df: pd.DataFrame) -> dict:
    """
    Compare recent 3-4 week avg volume vs prior 3-month avg.
    Detect acceleration trend week-over-week.
    """
    if len(df) < 90:
        return {"ratio": 1.0, "acceleration": False, "weekly_trend": 0.0}

    recent = df["Volume"].iloc[-20:]
    baseline = df["Volume"].iloc[-90:-20]

    recent_avg = recent.mean()
    baseline_avg = baseline.mean()
    ratio = recent_avg / baseline_avg if baseline_avg > 0 else 1.0

    # Week-over-week acceleration
    w1 = df["Volume"].iloc[-5:].mean()
    w2 = df["Volume"].iloc[-10:-5].mean()
    w3 = df["Volume"].iloc[-15:-10].mean()
    w4 = df["Volume"].iloc[-20:-15].mean()
    weekly_trend = 0.0
    if w4 > 0 and w3 > 0 and w2 > 0:
        # Increasing week over week
        weekly_trend = ((w1 / w2) + (w2 / w3) + (w3 / w4)) / 3 - 1
    acceleration = w1 > w2 > w3 and ratio > 1.2

    return {
        "ratio": float(round(ratio, 3)),
        "acceleration": bool(acceleration),
        "weekly_trend": float(round(weekly_trend, 4)),
        "recent_avg_vol": float(recent_avg),
        "baseline_avg_vol": float(baseline_avg),
    }


# ──────────────────────────────────────────────
# SIGNAL 2 — COMPRESSION → EXPANSION
# ──────────────────────────────────────────────
def compute_compression_expansion(df: pd.DataFrame) -> dict:
    """
    Detect 30–60 day volatility compression followed by expansion.
    Uses ATR-based detection.
    """
    if len(df) < 90:
        return {"in_compression": False, "compression_days": 0, "expanding": False}

    # ATR calculation
    df = df.copy()
    df["prev_close"] = df["Close"].shift(1)
    df["tr"] = df[["High", "Low", "prev_close"]].apply(
        lambda r: max(
            r["High"] - r["Low"],
            abs(r["High"] - r["prev_close"]),
            abs(r["Low"] - r["prev_close"]),
        ),
        axis=1,
    )
    df["atr10"] = df["tr"].rolling(10).mean()
    atr_90th = df["atr10"].iloc[-90:].quantile(0.80)
    atr_20th = df["atr10"].iloc[-90:].quantile(0.20)
    current_atr = df["atr10"].iloc[-1]

    # Find consecutive days of compression (ATR < 20th percentile)
    compressed_days = 0
    for i in range(len(df) - 1, max(len(df) - 70, 0), -1):
        if df["atr10"].iloc[i] <= atr_20th:
            compressed_days += 1
        else:
            break

    # Current expansion
    expanding = current_atr > atr_90th * 0.7 and compressed_days >= 20

    # Tight price range check (Donchian)
    recent_high = df["High"].iloc[-20:].max()
    recent_low = df["Low"].iloc[-20:].min()
    price_now = df["Close"].iloc[-1]
    range_pct = (recent_high - recent_low) / price_now if price_now > 0 else 1.0

    return {
        "in_compression": compressed_days >= 20,
        "compression_days": int(compressed_days),
        "expanding": bool(expanding),
        "range_pct": float(round(range_pct, 4)),
        "current_atr": float(round(current_atr, 4)),
    }


# ──────────────────────────────────────────────
# SIGNAL 3 — MOVING AVERAGE HEALTH
# ──────────────────────────────────────────────
def compute_ma_health(df: pd.DataFrame) -> dict:
    """
    Calculate days above 50MA, 200MA.
    Detect if price is consistently above key MAs.
    """
    if len(df) < 200:
        return {"above_50ma": False, "above_200ma": False, "streak_50": 0, "streak_200": 0}

    df = df.copy()
    df["ma50"] = df["Close"].rolling(50).mean()
    df["ma200"] = df["Close"].rolling(200).mean()

    # Streak above 50MA
    streak_50 = 0
    for i in range(len(df) - 1, max(len(df) - 60, 0), -1):
        if df["Close"].iloc[i] > df["ma50"].iloc[i]:
            streak_50 += 1
        else:
            break

    # Streak above 200MA
    streak_200 = 0
    for i in range(len(df) - 1, max(len(df) - 90, 0), -1):
        if df["Close"].iloc[i] > df["ma200"].iloc[i]:
            streak_200 += 1
        else:
            break

    # Price resilience: after corrections > 5%, did price recover?
    close = df["Close"].values
    resilience_score = 0
    corrections = 0
    for i in range(10, len(close) - 5):
        peak = max(close[max(0, i - 10):i])
        if close[i] < peak * 0.95:
            corrections += 1
            # Check if recovered within 10 bars
            future = close[i : min(i + 15, len(close))]
            if len(future) > 0 and max(future) >= peak * 0.97:
                resilience_score += 1
    resilience_pct = resilience_score / corrections if corrections > 0 else 0.5

    return {
        "above_50ma": bool(df["Close"].iloc[-1] > df["ma50"].iloc[-1]),
        "above_200ma": bool(df["Close"].iloc[-1] > df["ma200"].iloc[-1]),
        "streak_50": int(streak_50),
        "streak_200": int(streak_200),
        "ma50": float(round(df["ma50"].iloc[-1], 3)),
        "ma200": float(round(df["ma200"].iloc[-1], 3)),
        "price": float(round(df["Close"].iloc[-1], 3)),
        "resilience_pct": float(round(resilience_pct, 3)),
    }


# ──────────────────────────────────────────────
# SIGNAL 4 — RELATIVE STRENGTH VS SECTOR
# ──────────────────────────────────────────────
def compute_relative_strength(df: pd.DataFrame, sector_df: Optional[pd.DataFrame]) -> dict:
    """
    Compare stock return vs sector ETF return over multiple windows.
    Higher = outperforming sector.
    """
    if sector_df is None or len(df) < 60 or len(sector_df) < 60:
        return {"rs_20d": 0.5, "rs_60d": 0.5, "rs_accelerating": False}

    # Align indexes
    common = df.index.intersection(sector_df.index)
    if len(common) < 20:
        return {"rs_20d": 0.5, "rs_60d": 0.5, "rs_accelerating": False}

    stock_ret_20 = df.loc[common]["Close"].iloc[-20:].pct_change().sum()
    sector_ret_20 = sector_df.loc[common]["Close"].iloc[-20:].pct_change().sum()
    rs_20 = stock_ret_20 - sector_ret_20

    stock_ret_60 = df.loc[common]["Close"].iloc[-60:].pct_change().sum()
    sector_ret_60 = sector_df.loc[common]["Close"].iloc[-60:].pct_change().sum()
    rs_60 = stock_ret_60 - sector_ret_60

    # RS accelerating: gaining vs sector in recent window
    rs_accelerating = rs_20 > rs_60 * 0.6 and rs_20 > 0

    return {
        "rs_20d": float(round(rs_20, 4)),
        "rs_60d": float(round(rs_60, 4)),
        "rs_accelerating": bool(rs_accelerating),
    }


# ──────────────────────────────────────────────
# COMPOSITE SCORE
# ──────────────────────────────────────────────
def compute_trend_persistence_score(
    volume: dict, compression: dict, ma: dict, rs: dict
) -> int:
    """
    Score components (0-100):
    - Consecutive days above 50MA: max 25 pts
    - Consecutive days above 200MA: max 20 pts
    - Volume regime change + acceleration: max 20 pts
    - Price resilience: max 15 pts
    - Relative strength vs sector: max 20 pts
    """
    score = 0.0

    # MA streaks (25 pts)
    streak_50_pts = min(ma.get("streak_50", 0) / 40 * 25, 25)
    score += streak_50_pts

    # 200MA streak (20 pts)
    streak_200_pts = min(ma.get("streak_200", 0) / 60 * 20, 20)
    score += streak_200_pts

    # Volume regime (20 pts)
    ratio = volume.get("ratio", 1.0)
    vol_pts = 0
    if ratio >= 2.0:
        vol_pts = 20
    elif ratio >= 1.6:
        vol_pts = 16
    elif ratio >= 1.4:
        vol_pts = 12
    elif ratio >= 1.2:
        vol_pts = 7
    elif ratio >= 1.0:
        vol_pts = 3
    if volume.get("acceleration", False):
        vol_pts = min(vol_pts + 5, 20)
    score += vol_pts

    # Resilience (15 pts)
    resilience = ma.get("resilience_pct", 0.5)
    score += resilience * 15

    # RS vs sector (20 pts)
    rs20 = rs.get("rs_20d", 0)
    rs_pts = 0
    if rs20 > 0.05:
        rs_pts = 20
    elif rs20 > 0.02:
        rs_pts = 15
    elif rs20 > 0.0:
        rs_pts = 8
    elif rs20 > -0.02:
        rs_pts = 4
    if rs.get("rs_accelerating", False):
        rs_pts = min(rs_pts + 5, 20)
    score += rs_pts

    return int(min(max(score, 0), 100))


# ──────────────────────────────────────────────
# STRUCTURAL STATE CLASSIFICATION
# ──────────────────────────────────────────────
def classify_structural_state(
    score: int, volume: dict, compression: dict, ma: dict, rs: dict, short_pct: float = 0
) -> str:
    vol_ratio = volume.get("ratio", 1.0)
    expanding = compression.get("expanding", False)
    compressed = compression.get("in_compression", False)
    above_50 = ma.get("above_50ma", False)
    rs_accel = rs.get("rs_accelerating", False)

    # 🔴 Squeeze potencial — compression + short interest + rising score
    if compressed and short_pct > 0.08 and score >= 40:
        return STATE_SQUEEZE

    # 🟡 Ruptura estructural — volume spike + ATR expansion + above MA
    if expanding and vol_ratio >= 1.5 and above_50:
        return STATE_BREAKOUT

    # 🔵 Rotación sectorial — RS accelerating vs sector
    if rs_accel and rs.get("rs_20d", 0) > 0.02 and score >= 35:
        return STATE_ROTATION

    # 🟢 Acumulación silenciosa — volume up but quiet price
    if vol_ratio >= 1.3 and not expanding and score >= 35:
        return STATE_ACCUMULATION

    # ⚪ No clear structure
    return STATE_NONE


def classify_phase(duration_days: int) -> str:
    if duration_days < 7:
        return PHASE_EMERGING
    elif duration_days <= 30:
        return PHASE_CONFIRMED
    else:
        return PHASE_STRUCTURAL


def estimate_duration(df: pd.DataFrame, score: int) -> int:
    """
    Estimate how many consecutive days the current structural signal has been active.
    Uses MA + volume consistency as proxy.
    """
    if len(df) < 30 or score < 30:
        return 0
    df = df.copy()
    df["ma20"] = df["Close"].rolling(20).mean()
    df["vol_avg"] = df["Volume"].rolling(10).mean()
    df["vol_base"] = df["Volume"].rolling(60).mean()
    duration = 0
    for i in range(len(df) - 1, max(len(df) - 60, 20), -1):
        row = df.iloc[i]
        cond1 = row["Close"] > row["ma20"]
        cond2 = row["vol_avg"] > row["vol_base"] * 1.1
        if cond1 or cond2:
            duration += 1
        else:
            break
    return int(duration)


# ──────────────────────────────────────────────
# MAIN SCANNER ENTRY
# ──────────────────────────────────────────────
def scan_symbol(symbol: str) -> Optional[dict]:
    """
    Run the full structural scan for a single symbol.
    Returns a structured result dict or None on failure.
    """
    logger.info(f"Scanning {symbol}...")
    df = fetch_ohlcv(symbol, days=250)
    if df is None:
        return None

    info = get_ticker_info(symbol)
    sector_df = fetch_sector_etf(info["sector"])

    volume = compute_volume_regime(df)
    compression = compute_compression_expansion(df)
    ma = compute_ma_health(df)
    rs = compute_relative_strength(df, sector_df)

    score = compute_trend_persistence_score(volume, compression, ma, rs)
    state = classify_structural_state(
        score, volume, compression, ma, rs, info.get("short_percent", 0)
    )
    duration = estimate_duration(df, score)
    phase = classify_phase(duration)

    today = date.today().isoformat()

    return {
        "symbol": symbol,
        "date": today,
        "name": info["name"],
        "sector": info["sector"],
        "trend_persistence_score": score,
        "structural_state": state,
        "phase": phase,
        "duration_days": duration,
        "volume_change_ratio": volume["ratio"],
        "volatility_compression_days": compression["compression_days"],
        "relative_strength_20d": rs["rs_20d"],
        "current_price": ma.get("price", 0),
        "ma50": ma.get("ma50", 0),
        "ma200": ma.get("ma200", 0),
        "details_json": {
            "volume": volume,
            "compression": compression,
            "ma": ma,
            "rs": rs,
        },
    }


def run_full_scan(symbols: list[str] = None) -> list[dict]:
    """Scan all symbols and return list of results."""
    symbols = symbols or SCAN_UNIVERSE
    results = []
    for symbol in symbols:
        try:
            result = scan_symbol(symbol)
            if result:
                results.append(result)
        except Exception as e:
            logger.error(f"Failed to scan {symbol}: {e}")
    results.sort(key=lambda x: x["trend_persistence_score"], reverse=True)
    logger.info(f"Scan complete: {len(results)}/{len(symbols)} symbols processed")
    return results
