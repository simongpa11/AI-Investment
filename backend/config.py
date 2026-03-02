import os
from dotenv import load_dotenv

load_dotenv()

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://wlvatpforyjbdsodqdza.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv(
    "SUPABASE_SERVICE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsdmF0cGZvcnlqYmRzb2RxZHphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ1NTQ1MiwiZXhwIjoyMDg4MDMxNDUyfQ.VyghCQUc66hzw9XjSvEkmawPDovjRHm2D_g9oHdbwT4",
)

# Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyAEBcU2hg7ogBMREQP7wNauaISF0dNgySU")

# Finnhub
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "d6iq2mhr01qleu953o0gd6iq2mhr01qleu953o10")

# Scanner settings
SCAN_UNIVERSE = [
    # Top S&P 500 tech / mega cap
    "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "BRK-B",
    "JPM", "LLY", "V", "UNH", "XOM", "MA", "JNJ", "PG", "HD", "COST", "ABBV",
    "WMT", "MRK", "BAC", "CVX", "NFLX", "AMD", "CRM", "ORCL", "KO", "PEP",
    "ACN", "TMO", "LIN", "MCD", "CSCO", "ABT", "GE", "INTU", "IBM", "DIS",
    "VZ", "RTX", "NEE", "ADBE", "QCOM", "TXN", "PM", "HON", "CAT", "GS",
    # Growth & momentum favorites
    "PLTR", "SNOW", "COIN", "MSTR", "IREN", "ASTS", "SBET", "RXRX", "IOT",
    "AFRM", "SOFI", "HOOD", "SMCI", "ARM", "ASML", "TSM", "BABA", "JD",
    # ETFs for sector rotation signals
    "XLK", "XLF", "XLE", "XLV", "XLI", "XLC", "XLY", "XLP", "XLB", "XLRE",
    # Crypto proxies
    "MARA", "RIOT", "HUT",
]

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
