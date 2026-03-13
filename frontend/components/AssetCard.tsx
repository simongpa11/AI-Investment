"use client";
import { useState, useEffect } from "react";
import { StructuralScore, STATE_LABELS, STATE_EMOJIS, getCombinedScore, getSignalStrength, api } from "@/lib/api";
import { DossierModal } from "./DossierModal";

const STATE_COLORS: Record<string, string> = {
    accumulation: "#00D4AA",
    early_accumulation: "#10B981", // 🌱 Emerald/Green
    breakout: "#F59E0B",
    rotation: "#3B82F6",
    squeeze: "#F43F5E",
    none: "#4B5563",
};

interface AssetCardProps {
    asset: StructuralScore;
    isWatched?: boolean;
    onWatchToggle?: (symbol: string, watched: boolean) => void;
}

export function AssetCard({
    asset,
    isWatched = false,
    onWatchToggle,
}: AssetCardProps) {
    const structScore = asset.trend_persistence_score;
    const narScore = asset.narrative?.narrative_persistence_score ?? 0;
    const combined = getCombinedScore(structScore, narScore);
    const signal = getSignalStrength(structScore, narScore, asset.duration_days);
    const stateColor = STATE_COLORS[asset.structural_state] || STATE_COLORS.none;
    const [watching, setWatching] = useState(isWatched);
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => { setWatching(isWatched); }, [isWatched]);

    // Optimistic: flip UI instantly, persist in background, rollback on error
    const handleWatch = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const prev = watching;
        const next = !watching;
        setWatching(next);
        onWatchToggle?.(asset.symbol, next);
        try {
            if (next) await api.watch(asset.symbol);
            else await api.unwatch(asset.symbol);
        } catch (err) {
            console.error("Watch failed, rolling back:", err);
            setWatching(prev);
            onWatchToggle?.(asset.symbol, prev);
        }
    };

    return (
        <>
            <div
                className="glass-card asset-card"
                data-state={asset.structural_state}
                onClick={() => setModalOpen(true)}
                style={{ cursor: "pointer" }}
                title="Pulsa para ver el historial completo"
            >
                {/* Header */}
                <div className="asset-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <h3 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 900, letterSpacing: "-0.02em" }}>{asset.symbol}</h3>
                            <span className={`state-badge ${asset.structural_state}`} style={{ fontSize: "0.65rem", padding: "2px 8px" }}>
                                {STATE_EMOJIS[asset.structural_state]} {STATE_LABELS[asset.structural_state]?.replace(/^[🟢🟡🔵🔴⚪] /, "")}
                            </span>
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "150px" }}>
                            {asset.name}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                            {asset.market_cap_category && (
                                <span style={{ 
                                    fontSize: "0.55rem", fontWeight: 800, color: "var(--text-muted)", 
                                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.05)",
                                    padding: "1px 5px", borderRadius: "3px", textTransform: "uppercase"
                                }}>
                                    {asset.market_cap_category} cap
                                </span>
                            )}
                            {asset.sector && asset.sector !== "Unknown" && (
                                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                    {asset.market_cap_category ? "• " : ""}{asset.sector}
                                </span>
                            )}
                        </div>
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <div style={{ 
                            width: 44, height: 44, borderRadius: "50%", 
                            border: `2px solid ${stateColor}`, 
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: `${stateColor}08`, marginBottom: 6
                        }}>
                            <span style={{ fontSize: "1.1rem", fontWeight: 900 }}>{combined}</span>
                        </div>
                        {asset.current_price > 0 && (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 700 }}>
                                ${asset.current_price.toFixed(2)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Scores */}
                <div className="asset-scores">
                    <div className="score-item">
                        <div className="score-label">Structural</div>
                        <div className="score-value" style={{ color: "var(--score-structural)" }}>{structScore}</div>
                        <div className="score-bar">
                            <div className="score-bar-fill structural" style={{ width: `${structScore}%` }} />
                        </div>
                    </div>
                    <div className="score-item">
                        <div className="score-label">Narrative</div>
                        <div className="score-value" style={{ color: "var(--score-narrative)" }}>{narScore}</div>
                        <div className="score-bar">
                            <div className="score-bar-fill narrative" style={{ width: `${Math.max(0, narScore)}%` }} />
                        </div>
                    </div>
                    <div className="score-item">
                        <div className="score-label">Combined</div>
                        <div className="score-value" style={{ color: "var(--score-combined)" }}>{combined}</div>
                        <div className="score-bar">
                            <div className="score-bar-fill combined" style={{ width: `${combined}%` }} />
                        </div>
                    </div>
                </div>

                {/* Duration & Signals Grid (Homogeneous) */}
                <div style={{ 
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", 
                    padding: "12px", background: "rgba(255,255,255,0.04)", borderRadius: 12,
                    marginBottom: 16
                }}>
                    <div style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
                         <span style={{ opacity: 0.7 }}>⏱</span> 
                         {asset.duration_days}d activo
                    </div>
                    <div style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
                         <span style={{ opacity: 0.7 }}>📈</span>
                         <span style={{ 
                            color: asset.trend_extension > 2.5 ? "var(--accent-rose)" : 
                                   asset.trend_extension > 1.5 ? "var(--accent-amber)" : 
                                   "var(--accent-emerald)",
                            fontWeight: 700
                         }}>
                            {asset.trend_extension > 0 ? "+" : ""}{asset.trend_extension.toFixed(1)}σ
                         </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
                         <span style={{ opacity: 0.7 }}>💎</span>
                         {(asset.trend_quality * 100).toFixed(0)}% cal.
                    </div>
                    <div style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
                         <span style={{ opacity: 0.7 }}>🏛️</span>
                         +{(asset.relative_strength_market * 100).toFixed(0)}% RS
                    </div>
                </div>


                {/* Click hint */}
                <div style={{
                    fontSize: "0.65rem", color: "var(--text-muted)",
                    textAlign: "center", marginBottom: 12
                }}>
                    👆 Ver historial y detalles técnicos
                </div>


                {/* Footer */}
                <div className="asset-card-footer">
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span className="phase-tag">{asset.phase}</span>
                        <span
                            className={`signal-indicator signal-${signal}`}
                            style={{ fontSize: "0.65rem", padding: "2px 8px" }}
                        >
                            {signal === "strong" ? "⚡ Fuerte" : signal === "moderate" ? "📶 Moderada" : "📉 Débil"}
                        </span>
                    </div>
                    <button
                        className={`btn btn-small btn-watch ${watching ? "watching" : ""}`}
                        onClick={handleWatch}
                        id={`watch-${asset.symbol}`}
                    >
                        {watching ? "★ Siguiendo" : "☆ Seguir"}
                    </button>
                </div>
            </div>

            {/* Dossier Modal */}
            {modalOpen && (
                <DossierModal
                    asset={asset}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </>
    );
}
