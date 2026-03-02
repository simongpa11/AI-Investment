# AI Investment Platform

> **Structural Trend Detection for Medium-Term Investment**

Detect early-stage structural market changes — accumulation, breakouts, sector rotation — before they become obvious. Uses quantitative market analysis + AI-powered narrative intelligence.

## Architecture

```
AI Investment/
├── backend/         # FastAPI + Python (Market Scanner + Narrative AI)
└── frontend/        # Next.js 14 dashboard
```

## 🔵 Module 1 — Market Structural Scanner

Detects structural change using:
- **Volume Regime Change** — 3-4w avg vs 3-month baseline
- **Compression → Expansion** — ATR squeeze (30-60d) + breakout
- **Trend Persistence Score** (0-100) — MA streaks, volume consistency, resilience
- **Relative Strength** vs sector ETF
- **Structural Classification**: Accumulation 🟢 | Breakout 🟡 | Rotation 🔵 | Squeeze 🔴

## 🟡 Module 2 — Narrative Intelligence

AI-powered news analysis using Gemini 1.5 Flash:
- Fetches news from Finnhub / Yahoo Finance RSS
- Classifies: narrative type, language quality (hype vs technical), plausibility
- **Narrative Persistence Score** (0-100) — mention growth, source quality, tone trend

## Stack

| Layer | Tech |
|---|---|
| Market Data | yfinance (Yahoo Finance) |
| News | Finnhub + Yahoo RSS |
| LLM | Gemini 1.5 Flash |
| Database | Supabase |
| Backend | FastAPI + APScheduler |
| Frontend | Next.js 14 + Recharts |

## Quick Start

### 1. Supabase Setup

Run the SQL in `backend/db/schema.sql` in your Supabase SQL Editor.

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### 4. Trigger Initial Scan

```bash
curl -X POST http://localhost:8000/api/scan/run
```

Or click **"⚡ Scan ahora"** in the dashboard.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/assets/scan` | Get scanned assets (filter: `?phase=Confirmed`) |
| GET | `/api/assets/{symbol}/history` | Score history for charts |
| GET | `/api/assets/{symbol}/narrative` | Narrative scores |
| POST | `/api/assets/rescan/{symbol}` | Rescan a single asset |
| GET | `/api/assets/summary/phases` | Phase/state summary for dashboard |
| GET | `/api/watchlist` | Get watchlist |
| POST | `/api/watchlist/{symbol}` | Add to watchlist |
| DELETE | `/api/watchlist/{symbol}` | Remove from watchlist |
| GET | `/api/watchlist/{symbol}/dossier` | Full dossier |
| POST | `/api/scan/run` | Trigger full scan |

## Env Variables

**Backend** (optional — defaults are set in `config.py`):
```
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=...
GEMINI_API_KEY=...
FINNHUB_API_KEY=...
```

**Frontend** (`frontend/.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## License

Private project by [@simongpa11](https://github.com/simongpa11)
