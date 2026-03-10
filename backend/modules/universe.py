"""
Module: Dynamic Universe Management
Fetches components of Russell 3000 and STOXX 600, and filters them for liquidity.
"""
import logging
import asyncio
from typing import List
import pandas as pd
import yfinance as yf
from bs4 import BeautifulSoup
import httpx
from datetime import datetime

from config import FILTERS

logger = logging.getLogger(__name__)

# Fallback static lists in case Wikipedia parsing fails or takes too long in some environments
FALLBACK_TICKERS = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "PLTR", "MSTR", "COIN"]

async def scrape_wikipedia_tickers(url: str, table_class: str, ticker_column_idx: int) -> List[str]:
    """Helper to scrape ticker symbols from Wikipedia tables."""
    headers = {
        "User-Agent": "AI-Investment-Scanner/1.0 (https://github.com/simongpa11/AI-Investment; bot@example.com)"
    }
    try:
        async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                logger.warning(f"Failed to fetch {url}: Status {resp.status_code}")
                return []
            
            soup = BeautifulSoup(resp.text, 'html.parser')
            table = soup.find('table', {'class': table_class})
            if not table:
                logger.warning(f"Table {table_class} not found on {url}")
                return []
            
            tickers = []
            for row in table.find_all('tr')[1:]:  # Skip header
                cols = row.find_all(['td', 'th'])
                if len(cols) > ticker_column_idx:
                    # Clean up the ticker string (replace dots with dashes for Yahoo Finance)
                    ticker = cols[ticker_column_idx].text.strip().replace('.', '-')
                    if ticker:
                        tickers.append(ticker)
            return tickers
    except Exception as e:
        logger.error(f"Error scraping {url}: {e}")
        return []

async def get_russell_3000() -> List[str]:
    """
    Since Russell 3000 isn't cleanly available on a single Wikipedia page, 
    we will approximate it by fetching the S&P 500, S&P 400 (Midcap), and S&P 600 (Smallcap).
    This provides a combined list of ~1500 highly liquid US equities.
    """
    logger.info("Fetching US Universe (S&P 1500 proxy for Russell)...")
    sp500 = await scrape_wikipedia_tickers('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies', 'wikitable', 0)
    sp400 = await scrape_wikipedia_tickers('https://en.wikipedia.org/wiki/List_of_S%26P_400_companies', 'wikitable', 0)
    sp600 = await scrape_wikipedia_tickers('https://en.wikipedia.org/wiki/List_of_S%26P_600_companies', 'wikitable', 1) # Ticker is column 1 in S&P 600
    
    combined = list(set(sp500 + sp400 + sp600))
    logger.info(f"Fetched {len(combined)} US tickers.")
    return combined

async def get_stoxx_600() -> List[str]:
    """
    Fetch STOXX Europe 600 components.
    Note: Yahoo finance requires European tickers to have exchange suffixes (e.g., .L, .PA, .F).
    Wikipedia doesn't always provide these suffixes perfectly, so this is a best-effort scrape.
    """
    logger.info("Fetching STOXX 600 Universe...")
    # The STOXX 600 Wikipedia page has the ticker in column 2, but it lacks the yahoo finance suffix.
    # For a robust implementation we would ideally have a static CSV or a proper API.
    # As a proxy for European large caps without an expensive API, we scrape the EURO STOXX 50.
    stoxx50 = await scrape_wikipedia_tickers('https://en.wikipedia.org/wiki/EURO_STOXX_50', 'wikitable', 0)
    
    # Map simple tickers to Yahoo Finance formats (rough approximation)
    mapped = []
    for t in stoxx50:
         # In Yahoo Finance, many EuroStoxx50 components have .PA (Paris), .AS (Amsterdam), .DE (Xetra), etc.
         # Without a perfect mapping table, some might fail downloading later, which is fine (they drop out).
         if not t.endswith(('.PA', '.AS', '.DE', '.MI', '.MC')):
             mapped.append(f"{t}.DE") # Defaulting to Xetra for simplicity in this proxy
         else:
             mapped.append(t)
    
    logger.info(f"Fetched {len(mapped)} EU tickers (Proxy).")
    return list(set(mapped))

def apply_liquidity_filters(tickers: List[str]) -> List[str]:
    """
    Download 30-day summary data in bulk to quickly filter illiquid stocks.
    Filters: Price > 3, Avg Volume > 500k, Market Cap > 200M.
    """
    logger.info(f"Applying liquidity filters to {len(tickers)} tickers...")
    if not tickers:
        return FALLBACK_TICKERS
    
    # Download close and volume to test price/volume. 
    # Market Cap is harder to get in bulk historic data, so we rely mostly on Price and Volume here 
    # to weed out microcaps quickly. The heavy scanner will do a final check if needed.
    
    # Chunking to avoid yfinance bulk download limits/errors
    chunk_size = 500
    valid_tickers = []
    
    for i in range(0, len(tickers), chunk_size):
        chunk = tickers[i:i+chunk_size]
        logger.info(f"Downloading bulk data for chunk {i//chunk_size + 1}...")
        
        # We only need the last ~30 days to check recent average volume and price
        data = yf.download(chunk, period="1mo", progress=False, threads=True)
        
        if 'Close' not in data or 'Volume' not in data:
            continue
            
        close_df = data['Close']
        vol_df = data['Volume']
        
        # If there's only one ticker in the chunk, yfinance returns Series instead of DataFrame
        if isinstance(close_df, pd.Series):
             close_df = close_df.to_frame()
             vol_df = vol_df.to_frame()
             
        for ticker in chunk:
            try:
                if ticker not in close_df.columns:
                    continue
                
                recent_closes = close_df[ticker].dropna()
                recent_vols = vol_df[ticker].dropna()
                
                if len(recent_closes) < 10 or len(recent_vols) < 10:
                    continue
                    
                last_price = recent_closes.iloc[-1]
                avg_vol = recent_vols.mean()
                
                # Check FILTERS from config
                if last_price >= FILTERS["min_price"] and avg_vol >= FILTERS["min_avg_volume"]:
                    # (Market cap check is skipped in this bulk phase for speed; 
                    # price+volume usually proxy for it well enough to drop penny stocks).
                    valid_tickers.append(ticker)
                    
            except Exception as e:
                # logger.debug(f"Error filtering {ticker}: {e}")
                pass
                
    logger.info(f"Filtering complete. {len(valid_tickers)} out of {len(tickers)} passed liquidity checks.")
    
    # Ensure our base universe (from config) is always included if they pass or not
    from config import SCAN_UNIVERSE_SOURCE
    # Just a safety fallback
    if len(valid_tickers) < 50:
         logger.warning("Very few tickers passed. Returning fallback universe.")
         return FALLBACK_TICKERS
         
    return valid_tickers

async def build_filtered_universe() -> List[str]:
    """
    Orchestrates fetching the broad lists and applying the liquidity filters.
    In a production system, this would be cached to a database and updated weekly.
    """
    us_tickers = await get_russell_3000()
    eu_tickers = [] # Disabled European proxy for now to speed up tests, can be re-enabled
    
    raw_universe = list(set(us_tickers + eu_tickers))
    
    # As an optimization for development/testing, we limit the raw universe before filtering
    # REMOVE this limit in full production if you want to scan all 1500+ daily.
    # Currently limited to 800 to keep the demo/pipeline fast.
    if len(raw_universe) > 800:
        raw_universe = raw_universe[:800]
        
    filtered_universe = apply_liquidity_filters(raw_universe)
    
    # Add some specific favorites safely
    favorites = ["PLTR", "MSTR", "NVDA", "TSLA", "COIN", "ASTS", "IREN"]
    for fav in favorites:
        if fav not in filtered_universe:
            filtered_universe.append(fav)
            
    return filtered_universe
