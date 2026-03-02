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
  const [watchedSymbols, setWatchedSymbols] = useState<Set<string>>(new Set());
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
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

      const wItems = watchlistRes.watchlist || [];
      setWatchlistItems(wItems);
      const watched = new Set<string>(wItems.map((w) => w.symbol));
      setWatchedSymbols(watched);

      // Fetch narratives and history for top 30 + watchlist symbols
      const watchedInList = wItems.map(w => w.symbol);
      const top30 = assetList.slice(0, 30);
      const allSymbols = Array.from(new Set([...top30.map(a => a.symbol), ...watchedInList]));
      const allAssets = allSymbols.map(s => assetList.find(a => a.symbol === s)).filter(Boolean) as StructuralScore[];

      const [narResults, histResults] = await Promise.all([
        Promise.all(allAssets.map((a) => api.getNarrative(a.symbol).catch(() => ({ symbol: a.symbol, narratives: [] })))),
        Promise.all(allAssets.map((a) => api.getHistory(a.symbol, 30).catch(() => ({ symbol: a.symbol, history: [] })))),
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
    // Update watchlist items list
    setWatchlistItems((prev) => {
      if (!watched) return prev.filter(i => i.symbol !== symbol);
      return prev;
    });
    // After a short delay, reload data to get fresh watchlist
    setTimeout(loadData, 500);
  };

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

  // Build watchlist cards: get the full asset data for watched symbols
  // Assets that are in watchlist but ALSO appear in the scanner → show in both sections
  const watchlistAssets: StructuralScore[] = watchlistItems.map(item => {
    const found = assets.find(a => a.symbol === item.symbol);
    if (found) return found;
    // If not in current scan (lost structure), use watchlist structural data
    if (item.structural) return item.structural as StructuralScore;
    return null;
  }).filter(Boolean) as StructuralScore[];

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
          {/* 🔥 Emerging — amber */}
          <div className="stat-chip">
            <div className="stat-dot" style={{ background: "#F59E0B" }} />
            <div>
              <div className="stat-chip-value">{summary?.phases?.Emerging ?? "—"}</div>
              <div className="stat-chip-label">🔥 Emerging</div>
            </div>
          </div>
          {/* 🟢 Confirmed — emerald */}
          <div className="stat-chip">
            <div className="stat-dot" style={{ background: "var(--accent-emerald)" }} />
            <div>
              <div className="stat-chip-value">{summary?.phases?.Confirmed ?? "—"}</div>
              <div className="stat-chip-label">🟢 Confirmed</div>
            </div>
          </div>
          {/* 🔵 Structural — blue */}
          <div className="stat-chip">
            <div className="stat-dot" style={{ background: "var(--accent-blue)" }} />
            <div>
              <div className="stat-chip-value">{summary?.phases?.Structural ?? "—"}</div>
              <div className="stat-chip-label">🔵 Structural</div>
            </div>
          </div>
          {/* Con estructura — indigo */}
          <div className="stat-chip">
            <div className="stat-dot" style={{ background: "var(--accent-indigo)" }} />
            <div>
              <div className="stat-chip-value">{totalSignals}</div>
              <div className="stat-chip-label">Con estructura</div>
            </div>
          </div>
          {/* Siguiendo — rose */}
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

      {!loading && (
        <>
          {/* ─── SIGUIENDO SECTION ──────────────────────────────── */}
          {watchlistAssets.length > 0 && (
            <>
              <section className="trend-section" id="section-siguiendo">
                <div className="section-header">
                  <div className="section-title">
                    <span style={{ fontSize: "1.3rem" }}>★</span>
                    <div>
                      <h2 style={{ color: "var(--accent-rose)" }}>Siguiendo</h2>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                        Activos en tu watchlist · Nunca desaparecen, solo cambian de estado
                      </p>
                    </div>
                    <span
                      className="section-pill"
                      style={{ background: "rgba(244,63,94,0.15)", color: "var(--accent-rose)" }}
                    >
                      {watchlistAssets.length}
                    </span>
                  </div>
                </div>
                <div className="asset-grid">
                  {watchlistAssets.map((asset) => (
                    <div key={asset.symbol} style={{ position: "relative" }}>
                      {/* "También en tendencia" badge if it appears in a trending phase */}
                      {asset.structural_state !== "none" && (
                        <div style={{
                          position: "absolute",
                          top: -8,
                          right: 12,
                          zIndex: 10,
                          background: "rgba(0,212,170,0.15)",
                          border: "1px solid rgba(0,212,170,0.35)",
                          borderRadius: 20,
                          padding: "2px 8px",
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          color: "var(--accent-emerald)",
                          letterSpacing: "0.04em",
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
              </section>
              <div className="section-divider" />
            </>
          )}

          {/* Empty siguiendo state */}
          {watchlistAssets.length === 0 && (
            <>
              <section className="trend-section" id="section-siguiendo-empty">
                <div className="section-header">
                  <div className="section-title">
                    <span style={{ fontSize: "1.3rem" }}>★</span>
                    <div>
                      <h2 style={{ color: "var(--accent-rose)" }}>Siguiendo</h2>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                        Tu lista de seguimiento personal
                      </p>
                    </div>
                    <span className="section-pill" style={{ background: "rgba(75,85,99,0.2)", color: "var(--text-muted)" }}>0</span>
                  </div>
                </div>
                <div className="empty-state">
                  <div className="empty-state-icon">☆</div>
                  <p>Pulsa <strong>"Seguir"</strong> en cualquier activo para añadirlo aquí.</p>
                </div>
              </section>
              <div className="section-divider" />
            </>
          )}

          {/* ─── TREND SECTIONS ──────────────────────────────────── */}
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
