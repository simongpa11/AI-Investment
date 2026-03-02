"use client";
import { useEffect, useState } from "react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { StructuralScore, NarrativeScore, ScoreHistory, STATE_LABELS, STATE_EMOJIS, getCombinedScore, api } from "@/lib/api";

const STATE_COLORS: Record<string, string> = {
    accumulation: "#00D4AA",
    breakout: "#F59E0B",
    rotation: "#3B82F6",
    squeeze: "#F43F5E",
    none: "#4B5563",
};

interface DossierModalProps {
    asset: StructuralScore;
    narrative?: NarrativeScore | null;
    onClose: () => void;
}

export function DossierModal({ asset, narrative, onClose }: DossierModalProps) {
    const [history, setHistory] = useState<ScoreHistory[]>([]);
    const [loading, setLoading] = useState(true);

    const stateColor = STATE_COLORS[asset.structural_state] || STATE_COLORS.none;
    const combined = getCombinedScore(
        asset.trend_persistence_score,
        narrative?.narrative_persistence_score ?? 0
    );

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await api.getHistory(asset.symbol, 90);
                setHistory(res.history || []);
            } catch {
                setHistory([]);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();

        // Close on Escape key
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [asset.symbol, onClose]);

    // Prevent body scroll while open
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    const hasData = history.length >= 2;

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: "fixed", inset: 0, zIndex: 1000,
                    background: "rgba(0,0,0,0.7)",
                    backdropFilter: "blur(6px)",
                    animation: "fadeIn 0.18s ease",
                }}
            />

            {/* Modal */}
            <div style={{
                position: "fixed",
                top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 1001,
                width: "min(780px, 95vw)",
                maxHeight: "88vh",
                overflowY: "auto",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-xl)",
                boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
                animation: "slideUp 0.2s ease",
                padding: "0 0 24px 0",
            }}>
                {/* Header strip */}
                <div style={{
                    padding: "24px 28px 20px",
                    borderBottom: "1px solid var(--border)",
                    background: `linear-gradient(135deg, ${stateColor}18 0%, transparent 60%)`,
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                                <span style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.04em" }}>
                                    {asset.symbol}
                                </span>
                                <span className={`state-badge ${asset.structural_state}`} style={{ fontSize: "0.8rem" }}>
                                    {STATE_EMOJIS[asset.structural_state]} {STATE_LABELS[asset.structural_state]?.replace(/^[🟢🟡🔵🔴⚪] /, "")}
                                </span>
                                <span className="phase-tag" style={{ fontSize: "0.7rem" }}>{asset.phase}</span>
                            </div>
                            <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                {asset.name}
                            </div>
                            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: 2 }}>
                                {asset.sector}
                                {asset.current_price > 0 && (
                                    <span style={{ marginLeft: 8, color: "var(--text-secondary)", fontWeight: 600 }}>
                                        ${asset.current_price.toFixed(2)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Close */}
                        <button
                            onClick={onClose}
                            id={`close-modal-${asset.symbol}`}
                            style={{
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid var(--border)",
                                borderRadius: "50%",
                                width: 32, height: 32,
                                cursor: "pointer",
                                color: "var(--text-secondary)",
                                fontSize: "1rem",
                                display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                        >×</button>
                    </div>

                    {/* Score row */}
                    <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
                        {[
                            { label: "Structural", value: asset.trend_persistence_score, color: stateColor },
                            { label: "Narrative", value: narrative?.narrative_persistence_score ?? 0, color: "#00D4AA" },
                            { label: "Combined", value: combined, color: "#6C63FF" },
                        ].map((s) => (
                            <div key={s.label} style={{ flex: 1 }}>
                                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                                    {s.label}
                                </div>
                                <div style={{ fontSize: "2rem", fontWeight: 800, color: s.color, letterSpacing: "-0.04em", lineHeight: 1 }}>
                                    {s.value}
                                </div>
                                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 6 }}>
                                    <div style={{ width: `${s.value}%`, height: "100%", background: s.color, borderRadius: 2, transition: "width 0.5s ease" }} />
                                </div>
                            </div>
                        ))}
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                                Activo desde
                            </div>
                            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.04em", lineHeight: 1 }}>
                                {asset.duration_days}d
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 6 }}>
                                Vol ×{asset.volume_change_ratio?.toFixed(1) ?? "—"}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chart */}
                <div style={{ padding: "24px 28px 0" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
                        Historial de scores (últimos 90 días)
                    </div>

                    {loading && (
                        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                            Cargando historial...
                        </div>
                    )}

                    {!loading && !hasData && (
                        <div style={{
                            height: 220, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                            color: "var(--text-muted)", fontSize: "0.875rem",
                            background: "rgba(255,255,255,0.02)",
                            borderRadius: "var(--radius-md)",
                            border: "1px dashed var(--border)",
                        }}>
                            <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>📊</div>
                            <div>Historial disponible tras {2 - history.length} scan{history.length === 0 ? "s" : ""} más</div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4 }}>
                                El scanner guarda un snapshot diario a las 18:30
                            </div>
                        </div>
                    )}

                    {!loading && hasData && (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={history} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
                                <defs>
                                    <linearGradient id={`gs-${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={stateColor} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={stateColor} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id={`gn-${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00D4AA" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#00D4AA" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id={`gc-${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} />
                                <YAxis domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        background: "var(--bg-card-elevated, #1a1a2e)",
                                        border: "1px solid var(--border)",
                                        borderRadius: 8,
                                        fontSize: "0.75rem",
                                    }}
                                    labelStyle={{ color: "var(--text-secondary)", marginBottom: 4 }}
                                />
                                <Legend
                                    wrapperStyle={{ fontSize: "0.7rem", color: "var(--text-muted)", paddingTop: 8 }}
                                />
                                <Area type="monotone" dataKey="structural_score" name="Structural" stroke={stateColor} strokeWidth={2.5} fill={`url(#gs-${asset.symbol})`} dot={false} activeDot={{ r: 4, fill: stateColor }} />
                                <Area type="monotone" dataKey="narrative_score" name="Narrative" stroke="#00D4AA" strokeWidth={1.5} fill={`url(#gn-${asset.symbol})`} dot={false} activeDot={{ r: 3 }} />
                                <Area type="monotone" dataKey="combined_score" name="Combined" stroke="#6C63FF" strokeWidth={2} fill={`url(#gc-${asset.symbol})`} dot={false} activeDot={{ r: 4, fill: "#6C63FF" }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Signals + AI summary */}
                <div style={{ padding: "20px 28px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {/* Signals */}
                    <div>
                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                            Señales detectadas
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {asset.volume_change_ratio > 1.3 && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: "1rem" }}>📊</span>
                                    <div>
                                        <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>Volumen ×{asset.volume_change_ratio.toFixed(2)}</div>
                                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>vs media últimos 3 meses</div>
                                    </div>
                                </div>
                            )}
                            {asset.volatility_compression_days >= 20 && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: "1rem" }}>🔄</span>
                                    <div>
                                        <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>Compresión {asset.volatility_compression_days}d</div>
                                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>ATR en mínimos — posible expansión</div>
                                    </div>
                                </div>
                            )}
                            {asset.relative_strength_20d > 0.02 && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: "1rem" }}>⬆️</span>
                                    <div>
                                        <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>RS fuerte</div>
                                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>+{(asset.relative_strength_20d * 100).toFixed(1)}% vs sector</div>
                                    </div>
                                </div>
                            )}
                            {asset.current_price > 0 && asset.ma200 > 0 && asset.current_price > asset.ma200 && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: "1rem" }}>📈</span>
                                    <div>
                                        <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>Sobre MA200</div>
                                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Tendencia alcista de largo plazo</div>
                                    </div>
                                </div>
                            )}
                            {asset.current_price > 0 && asset.ma50 > 0 && asset.current_price > asset.ma50 && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: "1rem" }}>📉</span>
                                    <div>
                                        <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>Sobre MA50</div>
                                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Momentum a medio plazo activo</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Narrative */}
                    <div>
                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                            Inteligencia narrativa
                        </div>
                        {narrative ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {narrative.summary_ai && (
                                    <div style={{
                                        padding: "10px 12px",
                                        background: "rgba(0,212,170,0.06)",
                                        border: "1px solid rgba(0,212,170,0.15)",
                                        borderRadius: "var(--radius-md)",
                                        fontSize: "0.8rem",
                                        color: "var(--text-secondary)",
                                        lineHeight: 1.5,
                                    }}>
                                        🤖 {narrative.summary_ai}
                                    </div>
                                )}
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    {narrative.narrative_type && narrative.narrative_type !== "other" && (
                                        <span style={{ padding: "2px 8px", background: "rgba(108,99,255,0.1)", color: "var(--accent-indigo)", borderRadius: 20, fontSize: "0.65rem", fontWeight: 600 }}>
                                            {narrative.narrative_type}
                                        </span>
                                    )}
                                    {narrative.tone_change && (
                                        <span style={{
                                            padding: "2px 8px",
                                            background: narrative.tone_change === "improving" ? "rgba(0,212,170,0.1)" : narrative.tone_change === "deteriorating" ? "rgba(244,63,94,0.1)" : "rgba(255,255,255,0.05)",
                                            color: narrative.tone_change === "improving" ? "var(--accent-emerald)" : narrative.tone_change === "deteriorating" ? "var(--accent-rose)" : "var(--text-muted)",
                                            borderRadius: 20, fontSize: "0.65rem", fontWeight: 600,
                                        }}>
                                            Tono: {narrative.tone_change}
                                        </span>
                                    )}
                                    {(narrative.article_count ?? 0) > 0 && (
                                        <span style={{ padding: "2px 8px", background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", borderRadius: 20, fontSize: "0.65rem" }}>
                                            {narrative.article_count} artículos
                                        </span>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                                Sin análisis narrativo disponible.<br />
                                <span style={{ fontSize: "0.7rem" }}>Configura GEMINI_API_KEY para activarlo.</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translate(-50%, -46%) } to { opacity: 1; transform: translate(-50%, -50%) } }
      `}</style>
        </>
    );
}
