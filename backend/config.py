import os
from dotenv import load_dotenv

load_dotenv()

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://wlvatpforyjbdsodqdza.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv(
    "SUPABASE_SERVICE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsdmF0cGZvcnlqYmRzb2RxZHphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ1NTQ1MiwiZXhwIjoyMDg4MDMxNDUyfQ.VyghCQUc66hzw9XjSvEkmawPDovjRHm2D_g9oHdbwT4",
)

# Gemini — set via .env file or environment variable (never hardcode)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Finnhub
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "d6iq2mhr01qleu953o0gd6iq2mhr01qleu953o10")

SCAN_UNIVERSE_SOURCE = "russell3000 + stoxx600"

FILTERS = {
    "min_price": 3,
    "min_avg_volume": 500000,
    "min_market_cap": 200_000_000
}

# Sector ETF mapping for relative strength
SECTOR_ETFS = {
    "Technology": "XLK",
    "Financials": "XLF",
    "Energy": "XLE",
    "Healthcare": "XLV",
    "Industrials": "XLI",
    "Communication": "XLC",
    "Consumer Discretionary": "XLY",
    "Consumer Staples": "XLP",
    "Materials": "XLB",
    "Real Estate": "XLRE",
}

SCANNER_HOUR = 18   # Run scanner at 6 PM (after market close)
SCANNER_MINUTE = 30
