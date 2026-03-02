"use client";
import { useState, useEffect, useCallback } from "react";
import { api, StructuralScore, NarrativeScore, ScoreHistory, PhaseSummary } from "@/lib/api";
import { TrendSection } from "@/components/TrendSection";

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

      // Build watched set
      const watched = new Set<string>(
        (watchlistRes.watchlist || []).map((w) => w.symbol)
      );
      setWatchedSymbols(watched);

      // Fetch narratives and history for top 30 assets
      const top30 = assetList.slice(0, 30);
      const [narResults, histResults] = await Promise.all([
        Promise.all(top30.map((a) => api.getNarrative(a.symbol).catch(() => ({ symbol: a.symbol, narratives: [] })))),
        Promise.all(top30.map((a) => api.getHistory(a.symbol, 30).catch(() => ({ symbol: a.symbol, history: [] })))),
      ]);

      const narMap: Record<string, NarrativeScore> = {};
      narResults.forEach((r) => {
        if (r.narratives.length > 0) narMap[r.symbol] = r.narratives[0];
      });
      setNarrativeMap(narMap);

      const hMap: Record<string, ScoreHistory[]> = {};
      histResults.forEach((r) => { hMap[r.symbol] = r.history; });
      setHistoryMap(hMap);
    } catch (err) {
      setError("No se puede conectar con el backend. Asegúrate de que está corriendo en :8000");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleWatchToggle = (symbol: string, watched: boolean) => {
    setWatchedSymbols((prev) => {
      const next = new Set(prev);
      if (watched) next.add(symbol);
      else next.delete(symbol);
      return next;
    });
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      await api.triggerFullScan();
      setTimeout(loadData, 3000); // Reload after 3s
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

  return (
    <>
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">Market Structural Scanner</h1>
        <p className="dashboard-subtitle">
          Detección de cambio estructural temprano · Inversión a medio plazo
        </p>

        {/* Stats Row */}
        <div className="stats-row">
          <div className="stat-chip">
            <div className="stat-dot" style={{ background: "var(--accent-emerald)" }} />
            <div>
              <div className="stat-chip-value">{summary?.phases?.Emerging ?? "—"}</div>
              <div className="stat-chip-label">Emerging</div>
            </div>
          </div>
          <div className="stat-chip">
            <div className="stat-dot" style={{ background: "var(--accent-indigo)" }} />
            <div>
              <div className="stat-chip-value">{summary?.phases?.Confirmed ?? "—"}</div>
              <div className="stat-chip-label">Confirmed</div>
            </div>
          </div>
          <div className="stat-chip">
            <div className="stat-dot" style={{ background: "var(--accent-blue)" }} />
            <div>
              <div className="stat-chip-value">{summary?.phases?.Structural ?? "—"}</div>
              <div className="stat-chip-label">Structural</div>
            </div>
          </div>
          <div className="stat-chip">
            <div className="stat-dot" style={{ background: "var(--accent-amber)" }} />
            <div>
              <div className="stat-chip-value">{totalSignals}</div>
              <div className="stat-chip-label">Con estructura</div>
            </div>
          </div>
          <div className="stat-chip">
            <div className="stat-dot" style={{ background: "var(--accent-rose)" }} />
            <div>
              <div className="stat-chip-value">{watchedSymbols.size}</div>
              <div className="stat-chip-label">Siguiendo</div>
            </div>
          </div>

          <button
            className={`btn btn-primary btn-scan`}
            onClick={handleScan}
            disabled={scanning}
            id="btn-trigger-scan"
            style={{ marginLeft: "auto" }}
          >
            {scanning ? "⏳ Escaneando..." : "⚡ Scan ahora"}
          </button>
        </div>
      </div>

      {/* Error */}
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

      {/* State Filters */}
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

      {/* Loading Skeletons */}
      {loading && (
        <div className="asset-grid" style={{ marginBottom: 32 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
      )}

      {/* Trend Sections */}
      {!loading && (
        <>
          <TrendSection
            phase="Emerging"
            assets={filteredAssets}
            narrativeMap={narrativeMap}
            historyMap={historyMap}
            watchedSymbols={watchedSymbols}
            onWatchToggle={handleWatchToggle}
          />
          <div className="section-divider" />
          <TrendSection
            phase="Confirmed"
            assets={filteredAssets}
            narrativeMap={narrativeMap}
            historyMap={historyMap}
            watchedSymbols={watchedSymbols}
            onWatchToggle={handleWatchToggle}
          />
          <div className="section-divider" />
          <TrendSection
            phase="Structural"
            assets={filteredAssets}
            narrativeMap={narrativeMap}
            historyMap={historyMap}
            watchedSymbols={watchedSymbols}
            onWatchToggle={handleWatchToggle}
          />
        </>
      )}
    </>
  );
}
