"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { api, triggerManualScan, StructuralScore, NarrativeScore, ScoreHistory, PhaseSummary, WatchlistItem } from "@/lib/api";
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
  // watchedSymbols — single source of truth, updated optimistically
  const [watchedSymbols, setWatchedSymbols] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [stateFilter, setStateFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  // Manual Scan state
  const [manualTicker, setManualTicker] = useState("");
  const [isManualScanning, setIsManualScanning] = useState(false);

  // Autocomplete Search state
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setManualTicker(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setShowDropdown(true);
    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.search(val);
        // Filter primarily to stocks/ETFs if possible, or keep all
        setSearchResults((res.data || []).slice(0, 10));
      } catch (err) {
        console.error("Search API error", err);
      } finally {
        setIsSearching(false);
      }
    }, 400); // 400ms debounce
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assetsRes, watchlistRes] = await Promise.all([
        api.getDashboardAssets(),
        api.getWatchlist().catch(() => ({ watchlist: [] })),
      ]);

      const assetList = assetsRes.data || [];
      setAssets(assetList);

      const watched = new Set<string>(
        (watchlistRes.watchlist || []).map((w: WatchlistItem) => w.symbol)
      );
      setWatchedSymbols(watched);

      setLoading(false);
    } catch (err: any) {
      console.error(err);
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
    const toggleReq = nowWatched ? api.watch(symbol) : api.unwatch(symbol);
    toggleReq.catch(() => {
      // Revert optimism on failure
      setWatchedSymbols(prev => {
        const next = new Set(prev);
        if (nowWatched) next.delete(symbol);
        else next.add(symbol);
        return next;
      });
    });
  }, []);

  // ─── MANUAL SCAN HANDLER ──────────────────────────────────────────────────
  const handleManualScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTicker.trim() || isManualScanning) return;

    setIsManualScanning(true);
    try {
      await triggerManualScan(manualTicker.trim().toUpperCase());
      await loadData();
      setManualTicker("");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsManualScanning(false);
    }
  };

  const handleGlobalScan = async () => {
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

  // Compute stats directly from asset data — only counts assets with actual structure
  const structured = assets.filter((a) => a.structural_state !== "none");
  const statEmerging = structured.filter((a) => a.phase === "Emerging").length;
  const statConfirmed = structured.filter((a) => a.phase === "Confirmed").length;
  const statStructural = structured.filter((a) => a.phase === "Structural").length;
  const totalSignals = structured.length;

  const filteredAssets = stateFilter === "all"
    ? assets
    : assets.filter((a) => a.structural_state === stateFilter);

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
              <div className="stat-chip-value">{statEmerging}</div>
              <div className="stat-chip-label">🔥 Emerging</div>
            </div>
          </div>
          <div className="stat-chip">
            <div className="stat-dot" style={{ background: "var(--accent-emerald)" }} />
            <div>
              <div className="stat-chip-value">{statConfirmed}</div>
              <div className="stat-chip-label">🟢 Confirmed</div>
            </div>
          </div>
          <div className="stat-chip">
            <div className="stat-dot" style={{ background: "var(--accent-blue)" }} />
            <div>
              <div className="stat-chip-value">{statStructural}</div>
              <div className="stat-chip-label">🔵 Structural</div>
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
            onClick={handleGlobalScan}
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
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div className="section-title">
                <span style={{ fontSize: "1.3rem" }}>★</span>
                <div>
                  <h2 style={{ color: "var(--accent-rose)" }}>Siguiendo / Manual Trends</h2>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                    Tus acciones guardadas · Se escanean automáticamente
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

              <form onSubmit={handleManualScan} className="manual-scan-form" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ position: "relative" }} ref={dropdownRef}>
                  <input
                    type="text"
                    placeholder="Buscar empresa o ticker (ej: PLTR)"
                    value={manualTicker}
                    onChange={handleSearchInput}
                    disabled={isManualScanning}
                    autoComplete="off"
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(0,0,0,0.2)",
                      color: "white",
                      fontSize: "0.875rem",
                      width: "240px",
                      outline: "none",
                      transition: "border-color 0.2s ease",
                    }}
                  />

                  {/* Autocomplete Dropdown */}
                  {showDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        background: "var(--bg-glass)",
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                        maxHeight: "250px",
                        overflowY: "auto",
                        zIndex: 50,
                      }}
                    >
                      {isSearching ? (
                        <div style={{ padding: "12px", fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
                          Buscando...
                        </div>
                      ) : searchResults.length > 0 ? (
                        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                          {searchResults.map((item, idx) => (
                            <li
                              key={idx}
                              onClick={() => {
                                setManualTicker(item.symbol);
                                setShowDropdown(false);
                              }}
                              style={{
                                padding: "10px 12px",
                                borderBottom: idx < searchResults.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                                cursor: "pointer",
                                transition: "background 0.2s ease",
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <strong style={{ color: "var(--text-primary)", fontSize: "0.875rem" }}>{item.symbol}</strong>
                                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: 4 }}>
                                  {item.type}
                                </span>
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {item.description}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div style={{ padding: "12px", fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
                          No se encontraron resultados
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isManualScanning || !manualTicker.trim()}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    background: isManualScanning ? 'var(--bg-glass)' : 'rgba(108, 99, 255, 0.2)',
                    color: isManualScanning ? 'var(--text-muted)' : 'var(--accent-blue)',
                    border: '1px solid',
                    borderColor: isManualScanning ? 'transparent' : 'rgba(108, 99, 255, 0.4)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: isManualScanning || !manualTicker.trim() ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {isManualScanning ? (
                    <>
                      <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span>
                      Escaneando...
                    </>
                  ) : (
                    <>+ Escanear</>
                  )}
                </button>
              </form>
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
                        background: "rgba(245, 158, 11, 0.15)",
                        border: "1px solid rgba(245, 158, 11, 0.35)",
                        borderRadius: 20, padding: "2px 8px",
                        fontSize: "0.62rem", fontWeight: 700,
                        color: "var(--score-combined)",
                      }}>
                        📶 En tendencia activa
                      </div>
                    )}
                    <AssetCard
                      asset={asset}
                      isWatched={true}
                      onWatchToggle={handleWatchToggle}
                    />
                  </div>
                ))}
              </div>
            )}
          </section >

          <div className="section-divider" />

          {/* Trend sections — pass watchedSymbols so buttons reflect current state */}
          <TrendSection
            phase="Emerging"
            assets={filteredAssets}
            watchedSymbols={watchedSymbols}
            onWatchToggle={handleWatchToggle}
          />
          <TrendSection
            phase="Confirmed"
            assets={filteredAssets}
            watchedSymbols={watchedSymbols}
            onWatchToggle={handleWatchToggle}
          />
          <TrendSection
            phase="Structural"
            assets={filteredAssets}
            watchedSymbols={watchedSymbols}
            onWatchToggle={handleWatchToggle}
          />  </>
      )
      }
    </>
  );
}
