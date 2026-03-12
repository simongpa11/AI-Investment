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
                <div className="asset-card-header">
                    <div>
                        <div className="asset-symbol">{asset.symbol}</div>
                        <div className="asset-name" title={asset.name}>{asset.name}</div>
                        <div className="asset-sector">{asset.sector}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <span className={`state-badge ${asset.structural_state}`}>
                            {STATE_EMOJIS[asset.structural_state]} {STATE_LABELS[asset.structural_state]?.replace(/^[🟢🟡🔵🔴⚪] /, "")}
                        </span>
                        {asset.current_price > 0 && (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>
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

                {/* Duration & Signals */}
                <div className="duration-chip">
                    <span>⏱ {asset.duration_days}d activo</span>
                    {asset.trend_quality > 0.6 && (
                        <>
                            <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>•</span>
                            <span style={{ color: "var(--accent-emerald)" }} title="Trend Quality (Positive Closes Ratio)">
                                💎 {(asset.trend_quality * 100).toFixed(0)}% cal.
                            </span>
                        </>
                    )}
                    {asset.relative_strength_market > 0.05 && (
                        <>
                            <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>•</span>
                            <span style={{ color: "var(--accent-blue)" }} title="Relative Strength vs Market (SPY 90d)">
                                🏛️ RS-Mkt +{(asset.relative_strength_market * 100).toFixed(1)}%
                            </span>
                        </>
                    )}
                    {asset.atr_expansion > 1.2 && (
                        <>
                            <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>•</span>
                            <span style={{ color: "var(--accent-rose)" }} title="ATR Volatility Expansion (Trend start)">
                                ⚡ Exp. ×{asset.atr_expansion.toFixed(1)}
                            </span>
                        </>
                    )}
                    {asset.volume_spike_ratio > 1.4 && (
                        <>
                            <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>•</span>
                            <span style={{ color: "var(--accent-amber)" }} title="Anomalous Volume Spike vs 30d">
                                Vol ×{asset.volume_spike_ratio.toFixed(1)}
                            </span>
                        </>
                    )}
                </div>

                {/* Click hint */}
                <div style={{
                    fontSize: "0.65rem", color: "var(--text-muted)",
                    textAlign: "center", marginBottom: 12, marginTop: -4
                }}>
                    👆 Pulsa para ver el historial y sumario de IA completo
                </div>

                {/* AI Summary */}
                {asset.narrative?.summary_ai && (
                    <div className="ai-summary" style={{ borderLeftColor: "var(--score-narrative)", background: "rgba(168, 85, 247, 0.05)" }}>
                        🤖 {asset.narrative.summary_ai}
                    </div>
                )}

                {/* Footer */}
                <div className="asset-card-footer">
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span className="phase-tag">{asset.phase}</span>
                        <span
                            className={`signal-indicator signal-${signal}`}
                            style={{ fontSize: "0.65rem", padding: "2px 8px" }}
                        >
                            {signal === "strong" ? "⚡ Señal fuerte" : signal === "moderate" ? "📶 Moderada" : "📉 Débil"}
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
