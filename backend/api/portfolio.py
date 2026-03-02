from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
from db.supabase_client import get_client

router = APIRouter()

class Transaction(BaseModel):
    type: str # 'DEPOSIT', 'WITHDRAW', 'BUY', 'SELL', 'DIVIDEND', 'FEE'
    date: date
    symbol: Optional[str] = None
    name: Optional[str] = None
    shares: Optional[float] = None
    price_per_share: Optional[float] = None
    currency: str = 'EUR'
    fx_rate: float = 1.0
    total_eur: float

from modules.portfolio import compute_portfolio_summary

@router.get("/summary")
def get_portfolio_summary():
    """
    Returns XIRR, TWR, Total Value, P&L, Weightings, and Drawdown.
    """
    return compute_portfolio_summary()

@router.get("/ledger")
def get_portfolio_ledger():
    supabase = get_client()
    response = supabase.table("portfolio_ledger").select("*").order("date", desc=True).execute()
    return {"data": response.data}

@router.post("/ledger")
def add_transaction(transaction: Transaction):
    supabase = get_client()
    data = transaction.model_dump()
    name = data.pop('name', None) # portfolio_ledger unaccepted column
    data['date'] = data['date'].isoformat()
    response = supabase.table("portfolio_ledger").insert(data).execute()
    
    if transaction.symbol and name:
        try:
            exists = supabase.table("assets").select("symbol").eq("symbol", transaction.symbol).execute()
            if not exists.data:
                supabase.table("assets").insert({"symbol": transaction.symbol, "name": name}).execute()
        except Exception as e:
            print(f"Failed to save asset name for {transaction.symbol}: {e}")
            
    return {"data": response.data}

@router.delete("/ledger/{symbol}")
def delete_position(symbol: str):
    """Deletes all ledger entries for a specific ticker symbol"""
    supabase = get_client()
    response = supabase.table("portfolio_ledger").delete().eq("symbol", symbol.upper()).execute()
    return {"data": response.data}

from modules.portfolio import compute_portfolio_summary, compute_contributions_logic

@router.get("/contributions")
def get_contributions():
    """Returns logic triggers and historical deposits"""
    return compute_contributions_logic()

@router.put("/settings")
def update_settings(base_eur: float, cap_extra_eur: float, target_weights_json: str):
    supabase = get_client()
    response = supabase.table("portfolio_settings").update({
        "base_eur": base_eur,
        "cap_extra_eur": cap_extra_eur,
        "target_weights_json": target_weights_json
    }).eq("id", 1).execute()
    return {"data": response.data}
