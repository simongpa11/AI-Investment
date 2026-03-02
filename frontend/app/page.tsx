"use client";
import { useState, useEffect, useCallback } from "react";
import { api, StructuralScore, NarrativeScore, ScoreHistory, PhaseSummary, WatchlistItem } from "@/lib/api";
import { TrendSection } from "@/components/TrendSection";
import { AssetCard } from "@/components/AssetCard";

const STATE_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "accumulation", label: "🟢 Acumulación" },
  { key: "breakout", label: "🟡 Ruptura" },
  { key: "rotation", label: "🔵 Rotación" },
  { key: "squeeze", label: "🔴 Squeeze" },
];

export default function DashboardPage() {
  const [assets, setAssets] = useState<StructuralScore[]>([]);
  const [narrativeMap, setNarrativeMap] = useState<Record<string, NarrativeScore>>({});
  const [historyMap, setHistoryMap] = useState<Record<string, ScoreHistory[]>>({});
  const [summary, setSummary] = useState<PhaseSummary | null>(null);
  // Single source of truth for watched symbols — updated optimistically
  const [watchedSymbols, setWatchedSymbols] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [stateFilter, setStateFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assetsRes, summaryRes, watchlistRes] = await Promise.all([
        api.getScannedAssets(),
        api.getPhaseSummary().catch(() => null),
        api.getWatchlist().catch(() => ({ watchlist: [] })),
      ]);

      const assetList = assetsRes.data || [];
      setAssets(assetList);
      setSummary(summaryRes);

      const watched = new Set<string>(
        (watchlistRes.watchlist || []).map((w: WatchlistItem) => w.symbol)
      );
      setWatchedSymbols(watched);

      // Fetch narratives and history
      const top30 = assetList.slice(0, 50);
      const [narResults, histResults] = await Promise.all([
        Promise.all(top30.map((a: StructuralScore) => api.getNarrative(a.symbol).catch(() => ({ symbol: a.symbol, narratives: [] })))),
        Promise.all(top30.map((a: StructuralScore) => api.getHistory(a.symbol, 30).catch(() => ({ symbol: a.symbol, history: [] })))),
      ]);

      const narMap: Record<string, NarrativeScore> = {};
      narResults.forEach((r: { symbol: string; narratives: NarrativeScore[] }) => {
        if (r.narratives.length > 0) narMap[r.symbol] = r.narratives[0];
      });
      setNarrativeMap(narMap);

      const hMap: Record<string, ScoreHistory[]> = {};
      histResults.forEach((r: { symbol: string; history: ScoreHistory[] }) => { hMap[r.symbol] = r.history; });
      setHistoryMap(hMap);
    } catch {
      setError("No se puede conectar con el backend. Asegúrate de que está corriendo en :8000");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── OPTIMISTIC WATCH TOGGLE ──────────────────────────────────────────────
  // Updates local state immediately — no page reload, no flash, no delay.
  // The API call happens in the background; on failure we roll back.
  const handleWatchToggle = useCallback((symbol: string, nowWatched: boolean) => {
    setWatchedSymbols(prev => {
      const next = new Set(prev);
      if (nowWatched) next.add(symbol);
      else next.delete(symbol);
      return next;
    });
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      await api.triggerFullScan();
      setTimeout(loadData, 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setScanning(false), 3000);
    }
  };

  const filteredAssets = stateFilter === "all"
    ? assets
    : assets.filter((a) => a.structural_state === stateFilter);

  const totalSignals = assets.filter((a) => a.structural_state !== "none").length;

  // Derive watchlist assets purely from state — no extra fetch needed
  const watchlistAssets: StructuralScore[] = Array.from(watchedSymbols)
    .map(sym => assets.find(a => a.symbol === sym))
    .filter(Boolean) as StructuralScore[];

  return (
    <>
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">Market Structural Scanner</h1>
        <p className="dashboard-subtitle">
          Detección de cambio estructural temprano · Inversión a medio plazo
        </p>

        <div className="stats-row">
          <div className="stat-chip">
            <div className="stat-dot" style={{ background: "#F59E0B" }} />
            <div>
              <div className="stat-chip-value">{summary?.phases?.Emerging ?? "—"}</div>
              <div className="stat-chip-label">🔥 Emerging</div>
            </div>
          </div>
          <div className="stat-chip">
            <div className="stat-dot" style={{ background: "var(--accent-emerald)" }} />
            <div>
              <div className="stat-chip-value">{summary?.phases?.Confirmed ?? "—"}</div>
              <div className="stat-chip-label">🟢 Confirmed</div>
            </div>
          </div>
          <div className="stat-chip">
            <div className="stat-dot" style={{ background: "var(--accent-blue)" }} />
            <div>
              <div className="stat-chip-value">{summary?.phases?.Structural ?? "—"}</div>
              <div className="stat-chip-label">🔵 Structural</div>
            </div>
          </div>
          <div className="stat-chip">
            <div className="stat-dot" style={{ background: "var(--accent-indigo)" }} />
            <div>
              <div className="stat-chip-value">{totalSignals}</div>
              <div className="stat-chip-label">Con estructura</div>
            </div>
          </div>
          <div className="stat-chip">
            <div className="stat-dot" style={{ background: "var(--accent-rose)" }} />
            <div>
              <div className="stat-chip-value">{watchedSymbols.size}</div>
              <div className="stat-chip-label">★ Siguiendo</div>
            </div>
          </div>

          <button
            className="btn btn-primary btn-scan"
            onClick={handleScan}
            disabled={scanning}
            id="btn-trigger-scan"
            style={{ marginLeft: "auto" }}
          >
            {scanning ? "⏳ Escaneando..." : "⚡ Scan ahora"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: "16px 20px",
          background: "rgba(244,63,94,0.1)",
          border: "1px solid rgba(244,63,94,0.3)",
          borderRadius: "var(--radius-md)",
          color: "var(--accent-rose)",
          fontSize: "0.875rem",
          marginBottom: 24,
        }}>
          ⚠️ {error}
        </div>
      )}

      <div className="filter-bar">
        {STATE_FILTERS.map((f) => (
          <button
            key={f.key}
            className={`filter-chip ${stateFilter === f.key ? "active" : ""}`}
            onClick={() => setStateFilter(f.key)}
            id={`filter-${f.key}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="asset-grid" style={{ marginBottom: 32 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
      )}

      {!loading && (
        <>
          {/* ★ SIGUIENDO — always visible, updates instantly */}
          <section className="trend-section" id="section-siguiendo">
            <div className="section-header">
              <div className="section-title">
                <span style={{ fontSize: "1.3rem" }}>★</span>
                <div>
                  <h2 style={{ color: "var(--accent-rose)" }}>Siguiendo</h2>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                    Tu lista personal · Se actualiza en tiempo real
                  </p>
                </div>
                <span
                  className="section-pill"
                  style={{
                    background: watchedSymbols.size > 0 ? "rgba(244,63,94,0.15)" : "rgba(75,85,99,0.2)",
                    color: watchedSymbols.size > 0 ? "var(--accent-rose)" : "var(--text-muted)",
                    transition: "all 0.3s ease",
                  }}
                >
                  {watchedSymbols.size}
                </span>
              </div>
            </div>

            {watchlistAssets.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">☆</div>
                <p>Pulsa <strong>"☆ Seguir"</strong> en cualquier activo para añadirlo aquí al instante.</p>
              </div>
            ) : (
              <div className="asset-grid">
                {watchlistAssets.map((asset) => (
                  <div key={asset.symbol} style={{ position: "relative" }}>
                    {asset.structural_state !== "none" && (
                      <div style={{
                        position: "absolute", top: -8, right: 12, zIndex: 10,
                        background: "rgba(0,212,170,0.15)",
                        border: "1px solid rgba(0,212,170,0.35)",
                        borderRadius: 20, padding: "2px 8px",
                        fontSize: "0.62rem", fontWeight: 700,
                        color: "var(--accent-emerald)",
                      }}>
                        📶 En tendencia activa
                      </div>
                    )}
                    <AssetCard
                      asset={asset}
                      narrative={narrativeMap[asset.symbol] ?? null}
                      history={historyMap[asset.symbol] ?? []}
                      isWatched={true}
                      onWatchToggle={handleWatchToggle}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="section-divider" />

          {/* Trend sections — pass watchedSymbols so buttons reflect current state */}
          <TrendSection phase="Emerging" assets={filteredAssets} narrativeMap={narrativeMap} historyMap={historyMap} watchedSymbols={watchedSymbols} onWatchToggle={handleWatchToggle} />
          <div className="section-divider" />
          <TrendSection phase="Confirmed" assets={filteredAssets} narrativeMap={narrativeMap} historyMap={historyMap} watchedSymbols={watchedSymbols} onWatchToggle={handleWatchToggle} />
          <div className="section-divider" />
          <TrendSection phase="Structural" assets={filteredAssets} narrativeMap={narrativeMap} historyMap={historyMap} watchedSymbols={watchedSymbols} onWatchToggle={handleWatchToggle} />
        </>
      )}
    </>
  );
}
