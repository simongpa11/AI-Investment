"use client";
import { useState } from "react";
import { StructuralScore, NarrativeScore, ScoreHistory } from "@/lib/api";
import { AssetCard } from "./AssetCard";

const DEFAULT_VISIBLE = 8;

interface TrendSectionProps {
    phase: "Emerging" | "Confirmed" | "Structural";
    assets: StructuralScore[];
    watchedSymbols: Set<string>;
    onWatchToggle: (symbol: string, watched: boolean) => void;
    minStructural: number;
    minNarrative: number;
    minCombined: number;
}

const PHASE_CONFIG = {
    Emerging: {
        icon: "🔥",
        label: "Emerging Trends",
        subtitle: "0–7 días · Estructuras nuevas no consolidadas",
        pillClass: "emerging",
        dotColor: "#F59E0B",
    },
    Confirmed: {
        icon: "🟢",
        label: "Confirmed Trends",
        subtitle: "7–30 días · Zona principal de inversión",
        pillClass: "confirmed",
        dotColor: "#00D4AA",
    },
    Structural: {
        icon: "🔵",
        label: "Structural Trends",
        subtitle: "30+ días · Re-ratings y consolidaciones",
        pillClass: "structural",
        dotColor: "#3B82F6",
    },
};

export function TrendSection({
    phase,
    assets,
    watchedSymbols,
    onWatchToggle,
    minStructural,
    minNarrative,
    minCombined,
}: TrendSectionProps) {
    const config = PHASE_CONFIG[phase];
    const [showAll, setShowAll] = useState(false);

    const filtered = assets.filter((a) => {
        const narScore = a.narrative?.narrative_persistence_score ?? 0;
        const combScore = Math.round(a.trend_persistence_score * 0.90 + narScore * 0.10);
        
        return (
            a.phase === phase &&
            a.structural_state !== "none" &&
            a.trend_persistence_score >= minStructural &&
            narScore >= minNarrative &&
            combScore >= minCombined
        );
    });

    const visible = showAll ? filtered : filtered.slice(0, DEFAULT_VISIBLE);
    const hiddenCount = filtered.length - DEFAULT_VISIBLE;

    return (
        <section className="trend-section" id={`section-${phase.toLowerCase()}`}>
            <div className="section-header">
                <div className="section-title">
                    <span style={{ fontSize: "1.3rem" }}>{config.icon}</span>
                    <div>
                        <h2>{config.label}</h2>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                            {config.subtitle}
                        </p>
                    </div>
                    <span className={`section-pill ${config.pillClass}`}>{filtered.length}</span>
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <p>No hay estructuras {phase.toLowerCase()} detectadas ahora mismo.</p>
                    <p style={{ marginTop: 8, fontSize: "0.75rem" }}>Ejecuta un scan para actualizar.</p>
                </div>
            ) : (
                <>
                    <div className="asset-grid">
                        {visible.map((asset) => (
                            <AssetCard
                                key={asset.symbol}
                                asset={asset}
                                isWatched={watchedSymbols.has(asset.symbol)}
                                onWatchToggle={onWatchToggle}
                            />
                        ))}
                    </div>

                    {/* Ver más / Ver menos */}
                    {filtered.length > DEFAULT_VISIBLE && (
                        <div style={{ textAlign: "center", marginTop: 16 }}>
                            <button
                                onClick={() => setShowAll(v => !v)}
                                id={`show-more-${phase}`}
                                style={{
                                    background: "rgba(255,255,255,0.04)",
                                    border: `1px solid ${config.dotColor}44`,
                                    borderRadius: "var(--radius-full, 999px)",
                                    color: config.dotColor,
                                    padding: "8px 20px",
                                    fontSize: "0.78rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    transition: "background 0.2s, border-color 0.2s",
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = `${config.dotColor}18`)}
                                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                            >
                                {showAll
                                    ? "▲ Ver menos"
                                    : `▼ Ver ${hiddenCount} más`}
                            </button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
