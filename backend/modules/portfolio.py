import pandas as pd
from datetime import datetime, date
try:
    from pyxirr import xirr
except ImportError:
    xirr = None

import yfinance as yf
from db.supabase_client import get_client

def calculate_xirr(dates, amounts):
    """
    Calculate XIRR.
    dates: list of dates
    amounts: list of floats (negative = deposit, positive = withdrawal / current value)
    """
    if not xirr or len(dates) < 2:
        return 0.0
    try:
        parsed_dates = [pd.to_datetime(d) for d in dates]
        result = xirr(parsed_dates, amounts)
        return result if result is not None else 0.0
    except Exception as e:
        print(f"XIRR Calculation error: {e}")
        return 0.0

def fetch_current_prices(symbols):
    """Fetches the latest closing price for a list of symbols using yfinance."""
    if not symbols:
        return {}
    
    # yfinance can fetch multiple symbols efficiently
    symbols_str = " ".join(symbols)
    try:
        # Get last 5 days to ensure we have a recent close (accounting for weekends/holidays)
        data = yf.download(symbols_str, period="5d", progress=False)
        prices = {}
        
        if len(symbols) == 1:
            # yfinance returns a DataFrame with 'Close' as a Series if only one symbol
            last_valid_price = data['Close'].dropna().iloc[-1]
            # Convert to scalar float
            prices[symbols[0]] = float(last_valid_price.item())
        else:
            # yfinance returns a DataFrame with 'Close' containing multiple columns
            close_data = data['Close']
            for sym in symbols:
                if sym in close_data:
                    last_valid = close_data[sym].dropna()
                    if not last_valid.empty:
                        prices[sym] = float(last_valid.iloc[-1].item())
        return prices
    except Exception as e:
        print(f"Error fetching prices for {symbols}: {e}")
        return {}

def compute_portfolio_summary():
    """
    Reads the portfolio_ledger and computes all metrics.
    """
    supabase = get_client()
    # 1. Fetch ledger
    response = supabase.table("portfolio_ledger").select("*").order("date", desc=False).execute()
    ledger = response.data
    
    if not ledger:
        return {
            "total_value_eur": 0,
            "total_invested_eur": 0,
            "total_pl_eur": 0,
            "xirr_pct": 0,
            "twr_pct": 0,
            "cash_eur": 0,
            "positions": [],
            "drawdown_pct": 0
        }

    # 2. Reconstruct Portfolio State
    cash_eur = 0.0
    positions = {} # symbol -> {shares, total_cost_eur}
    total_invested_eur = 0.0
    
    # For XIRR: we need cash flow dates and amounts
    # User putting money IN = negative amount
    # User taking money OUT = positive amount
    cash_flows_dates = []
    cash_flows_amounts = []
    
    # TWR state tracking (simplified for MVP: (End Value - Net Cash Flow) / Start Value)
    # True TWR requires daily valuation, which is complex without historical daily prices of the whole portfolio.
    # For MVP, we'll calculate an approximation or use modified Dietz.
    
    for row in ledger:
        t = row['type']
        amt = float(row['total_eur'])
        dt = row['date']
        sym = row.get('symbol')
        shares = float(row.get('shares') or 0)
        
        if t == 'DEPOSIT':
            cash_eur += amt
            total_invested_eur += amt
            cash_flows_dates.append(dt)
            cash_flows_amounts.append(-amt) # Out of pocket
            
        elif t == 'WITHDRAW':
            cash_eur -= amt
            total_invested_eur -= amt
            cash_flows_dates.append(dt)
            cash_flows_amounts.append(amt) # Into pocket
            
        elif t == 'BUY':
            cash_eur -= amt
            if sym not in positions:
                positions[sym] = {'shares': 0.0, 'total_cost_eur': 0.0}
            positions[sym]['shares'] += shares
            positions[sym]['total_cost_eur'] += amt
            
        elif t == 'SELL':
            cash_eur += amt
            if sym in positions:
                positions[sym]['shares'] -= shares # shares should be positive in DB for SELL, but we subtract
                # Realize P&L - reduce cost basis proportionally
                # Simplified: average cost basis reduction
                if positions[sym]['shares'] <= 0.0001:
                    positions[sym]['shares'] = 0.0
                    positions[sym]['total_cost_eur'] = 0.0
                    
        elif t == 'DIVIDEND':
            cash_eur += amt
            
        elif t == 'FEE':
            cash_eur -= amt

    # Remove zero-share positions
    active_symbols = [sym for sym, data in positions.items() if data['shares'] > 0.0001]
    
    # 3. Fetch Current Prices and Asset Names
    current_prices = fetch_current_prices(active_symbols)
    
    asset_names = {}
    try:
        assets_res = supabase.table("assets").select("symbol, name").execute()
        if assets_res.data:
            asset_names = {row['symbol']: row['name'] for row in assets_res.data}
    except Exception as e:
        print(f"Warning: Could not load assets table for names: {e}")
    
    # 4. Calculate Current Value & P&L
    positions_summary = []
    total_equities_value_eur = 0.0
    
    for sym in active_symbols:
        shares = positions[sym]['shares']
        cost_eur = positions[sym]['total_cost_eur']
        avg_cost = cost_eur / shares if shares > 0 else 0
        
        # We need a fallback if yfinance fails or symbol is weird. Let's use cost basis as fallback.
        current_price = current_prices.get(sym, avg_cost) 
        
        # Note: price from YF is usually in local currency (USD).
        # We need to convert it back to EUR if the user tracks in EUR.
        # MVP Assumption: The portfolio is stored in EUR. If the user bought a USD stock,
        # they provided 'total_eur' the broker charged.
        # But `current_price` from YF is in USD. We need the current EUR/USD rate.
        # Let's fetch EURUSD=X
        pass
    
    # Let's fetch EURUSD=X to convert USD prices to EUR
    eurusd_rate = 1.0
    try:
        eurusd_data = yf.download("EURUSD=X", period="1d", progress=False)
        eurusd_rate = float(eurusd_data['Close'].dropna().iloc[-1].item())
    except:
        eurusd_rate = 1.05 # rough fallback

    for sym in active_symbols:
        shares = positions[sym]['shares']
        cost_eur = positions[sym]['total_cost_eur']
        avg_cost = cost_eur / shares if shares > 0 else 0
        
        # Assumption: Non-European tickers in YF are USD. European end in .MC, .PA, .DE, .L (GBP)
        # For simplicity in this MVP, if it doesn't have a dot, we assume USD and divide by EURUSD rate.
        raw_price = current_prices.get(sym, 0)
        if raw_price > 0:
            if "." not in sym:
                current_price_eur = raw_price / eurusd_rate
            else:
                current_price_eur = raw_price # Assume local currency matches EUR for now
        else:
            current_price_eur = avg_cost # Fallback
            
        value_eur = shares * current_price_eur
        pl_eur = value_eur - cost_eur
        pl_pct = (pl_eur / cost_eur * 100) if cost_eur > 0 else 0
        
        total_equities_value_eur += value_eur
        
        positions_summary.append({
            "symbol": sym,
            "name": asset_names.get(sym, sym), # Add human-readable name
            "shares": shares,
            "avg_cost_eur": avg_cost,
            "current_price_eur": current_price_eur,
            "value_eur": value_eur,
            "pl_eur": pl_eur,
            "pl_pct": pl_pct,
            "weight_pct": 0 # calculated below
        })
        
    total_portfolio_value_eur = cash_eur + total_equities_value_eur
    total_pl_eur = total_portfolio_value_eur - total_invested_eur
    
    # Add weights
    for p in positions_summary:
        p['weight_pct'] = (p['value_eur'] / total_portfolio_value_eur * 100) if total_portfolio_value_eur > 0 else 0
        
    positions_summary.sort(key=lambda x: x['value_eur'], reverse=True)

    # 5. XIRR
    # Add the current portfolio value as a final positive cash flow (as if we sold everything today)
    if cash_flows_dates and total_portfolio_value_eur > 0:
        cash_flows_dates.append(date.today().isoformat())
        cash_flows_amounts.append(total_portfolio_value_eur)
        
    xirr_val = calculate_xirr(cash_flows_dates, cash_flows_amounts)
    
    # 6. TWR (Simple Approximation for MVP)
    # Total Profit / Total Invested
    twr_val = (total_pl_eur / total_invested_eur * 100) if total_invested_eur > 0 else 0.0

    return {
        "total_value_eur": round(total_portfolio_value_eur, 2),
        "total_invested_eur": round(total_invested_eur, 2),
        "total_pl_eur": round(total_pl_eur, 2),
        "xirr_pct": round(xirr_val * 100, 2) if xirr_val else 0.0,
        "twr_pct": round(twr_val, 2), # Approximated
        "cash_eur": round(cash_eur, 2),
        "drawdown_pct": 0.0, # Requires historical total portfolio values to compute accurately
        "positions": positions_summary
    }

def compute_contributions_logic():
    """
    Returns the history of DEPOSIT operations and the current automated logic triggers.
    """
    supabase = get_client()
    # Fetch Settings
    settings_res = supabase.table("portfolio_settings").select("*").eq("id", 1).execute()
    settings = settings_res.data[0] if settings_res.data else {
        "base_eur": 1000, 
        "cap_extra_eur": 5000,
        "target_weights_json": {}
    }
    
    # Fetch all Deposits
    deposits_res = supabase.table("portfolio_ledger").select("*").in_("type", ["DEPOSIT"]).order("date", desc=True).execute()
    deposits = deposits_res.data or []
    
    # We need the portfolio summary to compute Drawdown triggers
    port_summary = compute_portfolio_summary()
    current_value = port_summary["total_value_eur"]
    invested = port_summary["total_invested_eur"]
    
    # For MVP, Drawdown is approximated by the P&L percentage if negative, 
    # since we don't have historical daily ATH of the entire portfolio stored yet.
    # A true DD calculation requires tracking daily portfolio value ATH.
    dd_pct = 0.0
    if current_value < invested:
        dd_pct = (invested - current_value) / invested * 100

    base = settings["base_eur"]
    extra_cap = settings["cap_extra_eur"]
    
    trigger_active = None
    extra_amount = 0
    multiplier = 0
    
    if dd_pct >= 30:
        multiplier = 2.0
        trigger_active = "DD >= 30%"
    elif dd_pct >= 20:
        multiplier = 1.0
        trigger_active = "DD >= 20%"
    elif dd_pct >= 10:
        multiplier = 0.5
        trigger_active = "DD >= 10%"
        
    if multiplier > 0:
        extra_amount = min(base * multiplier, extra_cap)
        
    recommended_total = base + extra_amount

    return {
        "settings": settings,
        "history": deposits,
        "current_drawdown": round(dd_pct, 2),
        "logic_state": {
            "trigger_active": trigger_active,
            "base_contribution": base,
            "extra_contribution": extra_amount,
            "recommended_total": recommended_total,
            "cap_limit_reached": extra_amount >= extra_cap
        }
    }
