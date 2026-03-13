"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { api, triggerManualScan, StructuralScore, NarrativeScore, ScoreHistory, PhaseSummary, WatchlistItem } from "@/lib/api";
import { TrendSection } from "@/components/TrendSection";
import { AssetCard } from "@/components/AssetCard";

const STATE_LABELS = {
  all: "Todos",
  accumulation: "🟢 Acumulación",
  early_accumulation: "🌱 Acumulación Temprana",
  breakout: "🟡 Ruptura",
  rotation: "🔵 Rotación",
  squeeze: "🔴 Squeeze",
};

const STATE_FILTERS = Object.keys(STATE_LABELS) as (keyof typeof STATE_LABELS)[];
const CAP_FILTERS = ["all", "large", "mid", "small"] as const;

type StateFilter = typeof STATE_FILTERS[number];
type CapFilter = typeof CAP_FILTERS[number];

export default function DashboardPage() {
  const [assets, setAssets] = useState<StructuralScore[]>([]);
  // watchedSymbols — single source of truth, updated optimistically
  const [watchedSymbols, setWatchedSymbols] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedState, setSelectedState] = useState<StateFilter>("all");
  const [selectedCap, setSelectedCap] = useState<CapFilter>("all");

  // Quality Filters
  const [minStructural, setMinStructural] = useState<number>(0);
  const [minNarrative, setMinNarrative] = useState<number>(0);
  const [minCombined, setMinCombined] = useState<number>(0);
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

  // Helper to calculate combined score
  const getCombinedScore = (structural: number, narrative: number) => {
    return Math.round((structural + narrative) / 2);
  };

  // Compute stats directly from asset data — only counts assets with actual structure
  const structured = assets.filter((a) => a.structural_state !== "none");
  const statEmerging = structured.filter((a) => a.phase === "Emerging").length;
  const statConfirmed = structured.filter((a) => a.phase === "Confirmed").length;
  const statStructural = structured.filter((a) => a.phase === "Structural").length;
  const totalSignals = structured.length;

  const filteredAssets = assets.filter((item) => {
    if (selectedState !== "all" && item.structural_state !== selectedState) {
      return false;
    }
    if (selectedCap !== "all" && item.market_cap_category !== selectedCap) {
      return false;
    }
    const combined = getCombinedScore(item.trend_persistence_score, item.narrative?.narrative_persistence_score ?? 0);
    if (item.trend_persistence_score < minStructural || (item.narrative?.narrative_persistence_score ?? 0) < minNarrative || combined < minCombined) {
      return false;
    }
    return true;
  });


  return (
    <>
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">Market Structural Scanner</h1>
        <p className="dashboard-subtitle">
          Detección de cambio estructural temprano · Inversión a medio plazo
        </p>

        <div className="stats-row" style={{ alignItems: 'center' }}>
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

          {/* Manual Scan Inline */}
          <form onSubmit={handleManualScan} style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 16 }}>
            <div style={{ position: "relative" }} ref={dropdownRef}>
              <input
                type="text"
                placeholder="Simular ticker (ej: PLTR)"
                value={manualTicker}
                onChange={handleSearchInput}
                disabled={isManualScanning}
                autoComplete="off"
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "var(--bg-card)",
                  color: "white",
                  fontSize: "0.875rem",
                  width: "220px",
                  outline: "none",
                  transition: "all 0.2s ease",
                }}
              />
              {showDropdown && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                  background: "var(--bg-secondary)", border: "1px solid var(--border)",
                  borderRadius: 12, boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                  maxHeight: "250px", overflowY: "auto", zIndex: 100
                }}>
                  {isSearching ? <div style={{ padding: 12, fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>Buscando...</div> :
                    searchResults.length > 0 ? (
                      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        {searchResults.map((item, idx) => (
                          <li key={idx} onClick={() => { setManualTicker(item.symbol); setShowDropdown(false); }}
                            style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <strong style={{ color: "var(--text-primary)" }}>{item.symbol}</strong>
                              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{item.type}</span>
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</div>
                          </li>
                        ))}
                      </ul>
                    ) : <div style={{ padding: 12, fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>Sin resultados</div>
                  }
                </div>
              )}
            </div>
            <button type="submit" disabled={isManualScanning || !manualTicker.trim()} className="btn btn-ghost" style={{ padding: '10px 16px', borderRadius: 12 }}>
              {isManualScanning ? "⏳" : "+ Escanear"}
            </button>
          </form>

          <button
            className="btn btn-primary btn-scan"
            onClick={handleGlobalScan}
            disabled={scanning}
            id="btn-trigger-scan"
            style={{ marginLeft: "auto" }}
          >
            {scanning ? "⏳ Escaneando..." : "⚡ Scan Global"}
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

      {/* Filters Row */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
        {/* States + Cap: horizontal scroll on mobile */}
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, paddingLeft: 4 }}>Estados Estructurales</span>
            <div className="filter-bar" style={{ display: "flex", gap: "8px" }}>
              {STATE_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedState(s)}
                  className={`filter-chip ${selectedState === s ? "active" : ""}`}
                >
                  {STATE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Market Cap */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, paddingLeft: 4 }}>Tamaño empresa</span>
            <div className="filter-bar" style={{ display: "flex", gap: "8px" }}>
              {CAP_FILTERS.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCap(c)}
                  className={`filter-chip ${selectedCap === c ? "active" : ""}`}
                >
                  {c === "all" ? "Todos" : `${c.charAt(0).toUpperCase() + c.slice(1)} Cap`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Structural</span>
            <input
              type="number"
              value={minStructural}
              onChange={(e) => setMinStructural(parseInt(e.target.value) || 0)}
              style={{ width: 56, padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.8rem' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Narrative</span>
            <input
              type="number"
              value={minNarrative}
              onChange={(e) => setMinNarrative(parseInt(e.target.value) || 0)}
              style={{ width: 56, padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.8rem' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Combined</span>
            <input
              type="number"
              value={minCombined}
              onChange={(e) => setMinCombined(parseInt(e.target.value) || 0)}
              style={{ width: 56, padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.8rem' }}
            />
          </div>
        </div>
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

          {/* Trend sections — pass watchedSymbols so buttons reflect current state */}
          <TrendSection
            phase="Emerging"
            assets={filteredAssets}
            watchedSymbols={watchedSymbols}
            onWatchToggle={handleWatchToggle}
            minStructural={minStructural}
            minNarrative={minNarrative}
            minCombined={minCombined}
          />
          <TrendSection
            phase="Confirmed"
            assets={filteredAssets}
            watchedSymbols={watchedSymbols}
            onWatchToggle={handleWatchToggle}
            minStructural={minStructural}
            minNarrative={minNarrative}
            minCombined={minCombined}
          />
          <TrendSection
            phase="Structural"
            assets={filteredAssets}
            watchedSymbols={watchedSymbols}
            onWatchToggle={handleWatchToggle}
            minStructural={minStructural}
            minNarrative={minNarrative}
            minCombined={minCombined}
          />  </>
      )
      }
    </>
  );
}
