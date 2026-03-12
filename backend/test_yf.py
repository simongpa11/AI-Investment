import yfinance as yf

def test():
    print("Testing yfinance...")
    ticker = yf.Ticker("AAPL")
    print("Sector:", ticker.info.get("sector"))
    df = ticker.history(period="1mo")
    print("Rows:", len(df))

if __name__ == "__main__":
    test()
