"use client";
import { StructuralScore, NarrativeScore, ScoreHistory } from "@/lib/api";
import { AssetCard } from "./AssetCard";

interface TrendSectionProps {
    phase: "Emerging" | "Confirmed" | "Structural";
    assets: StructuralScore[];
    narrativeMap: Record<string, NarrativeScore>;
    historyMap: Record<string, ScoreHistory[]>;
    watchedSymbols: Set<string>;
    onWatchToggle: (symbol: string, watched: boolean) => void;
}

const PHASE_CONFIG = {
    Emerging: {
        icon: "🔥",
        label: "Emerging Trends",
        subtitle: "0–7 días · Estructuras nuevas no consolidadas",
        pillClass: "emerging",
    },
    Confirmed: {
        icon: "🟢",
        label: "Confirmed Trends",
        subtitle: "7–30 días · Zona principal de inversión",
        pillClass: "confirmed",
    },
    Structural: {
        icon: "🔵",
        label: "Structural Trends",
        subtitle: "30+ días · Re-ratings y consolidaciones",
        pillClass: "structural",
    },
};

export function TrendSection({
    phase,
    assets,
    narrativeMap,
    historyMap,
    watchedSymbols,
    onWatchToggle,
}: TrendSectionProps) {
    const config = PHASE_CONFIG[phase];
    const filtered = assets.filter(
        (a) => a.phase === phase && a.structural_state !== "none"
    );

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
                <div className="asset-grid">
                    {filtered.map((asset) => (
                        <AssetCard
                            key={asset.symbol}
                            asset={asset}
                            narrative={narrativeMap[asset.symbol] ?? null}
                            history={historyMap[asset.symbol] ?? []}
                            isWatched={watchedSymbols.has(asset.symbol)}
                            onWatchToggle={onWatchToggle}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
