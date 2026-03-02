-- AI Investment Platform — Supabase Schema
-- Run this in Supabase SQL Editor

-- ─────────────────────────────────────────────
-- 1. STRUCTURAL SCORES (Module 1)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS structural_scores (
    id BIGSERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    name TEXT,
    sector TEXT,
    trend_persistence_score INTEGER NOT NULL DEFAULT 0,
    structural_state TEXT NOT NULL DEFAULT 'none'
        CHECK (structural_state IN ('accumulation', 'breakout', 'rotation', 'squeeze', 'none')),
    phase TEXT NOT NULL DEFAULT 'Emerging'
        CHECK (phase IN ('Emerging', 'Confirmed', 'Structural')),
    duration_days INTEGER DEFAULT 0,
    volume_change_ratio FLOAT DEFAULT 1.0,
    volatility_compression_days INTEGER DEFAULT 0,
    relative_strength_20d FLOAT DEFAULT 0.0,
    current_price FLOAT DEFAULT 0.0,
    ma50 FLOAT DEFAULT 0.0,
    ma200 FLOAT DEFAULT 0.0,
    details_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(symbol, date)
);

CREATE INDEX IF NOT EXISTS idx_structural_scores_symbol ON structural_scores(symbol);
CREATE INDEX IF NOT EXISTS idx_structural_scores_phase ON structural_scores(phase);
CREATE INDEX IF NOT EXISTS idx_structural_scores_state ON structural_scores(structural_state);
CREATE INDEX IF NOT EXISTS idx_structural_scores_date ON structural_scores(date DESC);
CREATE INDEX IF NOT EXISTS idx_structural_scores_score ON structural_scores(trend_persistence_score DESC);

-- ─────────────────────────────────────────────
-- 2. NARRATIVE SCORES (Module 2)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS narrative_scores (
    id BIGSERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    narrative_persistence_score INTEGER NOT NULL DEFAULT 0,
    narrative_type TEXT DEFAULT 'other',
    source_quality FLOAT DEFAULT 0.0,
    tone_change TEXT DEFAULT 'stable',
    summary_ai TEXT,
    article_count INTEGER DEFAULT 0,
    details_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(symbol, date)
);

CREATE INDEX IF NOT EXISTS idx_narrative_scores_symbol ON narrative_scores(symbol);
CREATE INDEX IF NOT EXISTS idx_narrative_scores_date ON narrative_scores(date DESC);

-- ─────────────────────────────────────────────
-- 3. SCORE HISTORY (time series for charts)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS score_history (
    id BIGSERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    structural_score INTEGER DEFAULT 0,
    narrative_score INTEGER DEFAULT 0,
    combined_score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(symbol, date)
);

CREATE INDEX IF NOT EXISTS idx_score_history_symbol ON score_history(symbol);
CREATE INDEX IF NOT EXISTS idx_score_history_date ON score_history(date);

-- ─────────────────────────────────────────────
-- 4. WATCHLIST
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist (
    id BIGSERIAL PRIMARY KEY,
    symbol TEXT NOT NULL UNIQUE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_watchlist_symbol ON watchlist(symbol);
CREATE INDEX IF NOT EXISTS idx_watchlist_active ON watchlist(is_active);

-- ─────────────────────────────────────────────
-- 5. ENABLE Row Level Security (keep data secure)
-- ─────────────────────────────────────────────
ALTER TABLE structural_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE narrative_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "service_role_all" ON structural_scores FOR ALL USING (true);
CREATE POLICY "service_role_all" ON narrative_scores FOR ALL USING (true);
CREATE POLICY "service_role_all" ON score_history FOR ALL USING (true);
CREATE POLICY "service_role_all" ON watchlist FOR ALL USING (true);

-- Allow anon read (for frontend)
CREATE POLICY "anon_read_structural" ON structural_scores FOR SELECT USING (true);
CREATE POLICY "anon_read_narrative" ON narrative_scores FOR SELECT USING (true);
CREATE POLICY "anon_read_history" ON score_history FOR SELECT USING (true);
CREATE POLICY "anon_read_watchlist" ON watchlist FOR SELECT USING (true);
