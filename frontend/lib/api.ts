const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface StructuralScore {
    id: number;
    symbol: string;
    date: string;
    name: string;
    sector: string;
    trend_persistence_score: number;
    structural_state: "accumulation" | "early_accumulation" | "breakout" | "rotation" | "squeeze" | "none";
    phase: "Emerging" | "Confirmed" | "Structural";
    duration_days: number;
    volume_change_ratio: number;
    volatility_compression_days: number;
    relative_strength_20d: number;
    relative_strength_market: number;
    trend_quality: number;
    atr_expansion: number;
    current_price: number;
    ma50: number;
    ma200: number;
    distance_from_52w_high: number;
    distance_from_90d_high: number;
    volume_spike_ratio: number;
    trend_extension: number;
    market_cap_category: 'large' | 'mid' | 'small';
    targets: {
        short_term: { target: number; return_pct: number };
        mid_term: { target: number; return_pct: number };
        long_term: { target: number; return_pct: number };
    };
    details_json?: Record<string, unknown>;
    narrative?: NarrativeScore | null;
}

export interface NarrativeScore {
    id: number;
    symbol: string;
    date: string;
    narrative_persistence_score: number;
    narrative_type: string;
    source_quality: number;
    tone_change: string;
    summary_ai: string;
    article_count: number;
}

export interface ScoreHistory {
    symbol: string;
    date: string;
    structural_score: number;
    narrative_score: number;
    combined_score: number;
}

export interface WatchlistItem {
    symbol: string;
    added_at: string;
    is_active: boolean;
    notes: string;
    structural: StructuralScore | null;
    history: ScoreHistory[];
}

export interface PhaseSummary {
    phases: { Emerging: number; Confirmed: number; Structural: number };
    states: { accumulation: number; early_accumulation: number; breakout: number; rotation: number; squeeze: number; none: number };
    top_by_phase: { Emerging: StructuralScore[]; Confirmed: StructuralScore[]; Structural: StructuralScore[] };
}

// ── Fetch helpers ──────────────────────────────────────────
async function apiFetch<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
    return res.json();
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

async function apiDelete<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

// ── API calls ─────────────────────────────────────────────
export const api = {
    getDashboardAssets: () => apiFetch<{ data: StructuralScore[] }>("/api/assets/dashboard"),

    getScannedAssets: (phase?: string, state?: string) =>
        apiFetch<{ data: StructuralScore[]; count: number }>(
            `/api/assets/scan${phase ? `?phase=${phase}` : ""}${state ? `${phase ? "&" : "?"}state=${state}` : ""}`
        ),

    getPhaseSummary: () => apiFetch<PhaseSummary>("/api/assets/summary/phases"),

    getHistory: (symbol: string, days = 90) =>
        apiFetch<{ symbol: string; history: ScoreHistory[] }>(`/api/assets/${symbol}/history?days=${days}`),

    getNarrative: (symbol: string) =>
        apiFetch<{ symbol: string; narratives: NarrativeScore[] }>(`/api/assets/${symbol}/narrative`),

    getCandles: (symbol: string, timeframe: string = "1M") =>
        apiFetch<{ symbol: string; data: any[] }>(`/api/assets/${symbol}/candles?timeframe=${timeframe}`),

    rescan: (symbol: string) => apiPost(`/api/assets/rescan/${symbol}`),

    triggerFullScan: () => apiPost("/api/scan/run"),

    getWatchlist: () => apiFetch<{ watchlist: WatchlistItem[] }>("/api/watchlist"),

    watch: (symbol: string) => apiPost(`/api/watchlist/${symbol}`),
    unwatch: (symbol: string) => apiDelete(`/api/watchlist/${symbol}`),

    getDossier: (symbol: string) =>
        apiFetch<{
            symbol: string;
            structural: StructuralScore;
            score_history: ScoreHistory[];
            narrative_history: NarrativeScore[];
        }>(`/api/watchlist/${symbol}/dossier`),

    search: (query: string) =>
        apiFetch<{ data: Array<{ description: string; displaySymbol: string; symbol: string; type: string }> }>(
            `/api/assets/search?q=${encodeURIComponent(query)}`
        ),
};

export async function triggerManualScan(symbol: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/scan/manual/${symbol}`, {
        method: "POST",
    });
    if (!res.ok) {
        throw new Error(await res.text() || "Failed to scan symbol");
    }
    return res.json();
}

// ── Helpers ────────────────────────────────────────────────
export const STATE_LABELS: Record<string, string> = {
    accumulation: "🟢 Acumulación",
    early_accumulation: "🌱 Acumulación Temprana",
    breakout: "🟡 Ruptura",
    rotation: "🔵 Rotación",
    squeeze: "🔴 Squeeze",
    none: "⚪ Sin estructura",
};

export const STATE_EMOJIS: Record<string, string> = {
    accumulation: "🟢",
    early_accumulation: "🌱",
    breakout: "🟡",
    rotation: "🔵",
    squeeze: "🔴",
    none: "⚪",
};

export function getCombinedScore(structural: number, narrative: number): number {
    return Math.round(structural * 0.90 + narrative * 0.10);
}

export function getSignalStrength(structural: number, narrative: number, duration: number) {
    if (structural >= 60 && narrative >= 50 && duration >= 7) return "strong";
    if (structural >= 45 || narrative >= 40) return "moderate";
    return "weak";
}
