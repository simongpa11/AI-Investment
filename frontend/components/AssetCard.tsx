"use client";
import { useState, useEffect } from "react";
import { StructuralScore, NarrativeScore, ScoreHistory, STATE_LABELS, STATE_EMOJIS, getCombinedScore, getSignalStrength, api } from "@/lib/api";
import { MiniChart } from "./MiniChart";

const STATE_COLORS: Record<string, string> = {
    accumulation: "#00D4AA",
    breakout: "#F59E0B",
    rotation: "#3B82F6",
    squeeze: "#F43F5E",
    none: "#4B5563",
};

interface AssetCardProps {
    asset: StructuralScore;
    narrative?: NarrativeScore | null;
    history?: ScoreHistory[];
    isWatched?: boolean;
    onWatchToggle?: (symbol: string, watched: boolean) => void;
    onClick?: () => void;
}

export function AssetCard({
    asset,
    narrative,
    history = [],
    isWatched = false,
    onWatchToggle,
    onClick,
}: AssetCardProps) {
    const structScore = asset.trend_persistence_score;
    const narScore = narrative?.narrative_persistence_score ?? 0;
    const combined = getCombinedScore(structScore, narScore);
    const signal = getSignalStrength(structScore, narScore, asset.duration_days);
    const stateColor = STATE_COLORS[asset.structural_state] || STATE_COLORS.none;
    const [watching, setWatching] = useState(isWatched);
    const [loading, setLoading] = useState(false);

    useEffect(() => { setWatching(isWatched); }, [isWatched]);

    const handleWatch = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setLoading(true);
        try {
            if (watching) {
                await api.unwatch(asset.symbol);
                setWatching(false);
                onWatchToggle?.(asset.symbol, false);
            } else {
                await api.watch(asset.symbol);
                setWatching(true);
                onWatchToggle?.(asset.symbol, true);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="glass-card asset-card"
            data-state={asset.structural_state}
            onClick={onClick}
            style={{ cursor: "pointer" }}
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
                    <div className="score-value" style={{ color: stateColor }}>{structScore}</div>
                    <div className="score-bar">
                        <div className="score-bar-fill structural" style={{ width: `${structScore}%` }} />
                    </div>
                </div>
                <div className="score-item">
                    <div className="score-label">Narrative</div>
                    <div className="score-value" style={{ color: "var(--accent-emerald)" }}>{narScore}</div>
                    <div className="score-bar">
                        <div className="score-bar-fill narrative" style={{ width: `${narScore}%` }} />
                    </div>
                </div>
                <div className="score-item">
                    <div className="score-label">Combined</div>
                    <div className="score-value" style={{ color: "var(--accent-indigo)" }}>{combined}</div>
                    <div className="score-bar">
                        <div className="score-bar-fill combined" style={{ width: `${combined}%` }} />
                    </div>
                </div>
            </div>

            {/* Duration */}
            <div className="duration-chip">
                <span>⏱</span>
                <span>{asset.duration_days}d activo</span>
                {asset.volume_change_ratio > 1.2 && (
                    <>
                        <span style={{ color: "var(--text-muted)" }}>·</span>
                        <span style={{ color: "var(--accent-amber)" }}>Vol ×{asset.volume_change_ratio.toFixed(1)}</span>
                    </>
                )}
                {asset.volatility_compression_days >= 20 && (
                    <>
                        <span style={{ color: "var(--text-muted)" }}>·</span>
                        <span style={{ color: "var(--accent-indigo)" }}>Compresión {asset.volatility_compression_days}d</span>
                    </>
                )}
            </div>

            {/* Mini Chart */}
            <div style={{ marginBottom: 12 }}>
                <MiniChart data={history} dataKey="combined_score" color={stateColor} />
            </div>

            {/* AI Summary */}
            {narrative?.summary_ai && (
                <div className="ai-summary">
                    🤖 {narrative.summary_ai}
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
                    disabled={loading}
                    id={`watch-${asset.symbol}`}
                >
                    {loading ? "..." : watching ? "★ Siguiendo" : "☆ Seguir"}
                </button>
            </div>
        </div>
    );
}
