-- Update AI Investment Schema for the new Trend Scanner

-- 1. Add new columns to structural_scores for the new technical indicators
ALTER TABLE public.structural_scores
ADD COLUMN IF NOT EXISTS distance_from_52w_high numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS volume_spike_ratio numeric DEFAULT 1.0;

-- Optional: rename trend_persistence_score to technical_trend_score if desired, 
-- but keeping the original name prevents breaking the current frontend before it's updated.

-- 2. Add the emerging_narrative boolean to narrative_scores
ALTER TABLE public.narrative_scores
ADD COLUMN IF NOT EXISTS emerging_narrative boolean DEFAULT false;

-- 3. We use the existing 'combined_score' in score_history to track the new trend_score.
-- Let's ensure distance_from_52w_high and volume_spike_ratio are also returned 
-- by our main asset views or API endpoints. No further table structures need changing 
-- since we store complex JSON details in 'details_json'.

-- 4. Create an index if we plan to sort by trend_persistence_score often
CREATE INDEX IF NOT EXISTS idx_structural_scores_trend_persistence 
ON public.structural_scores(trend_persistence_score DESC);
