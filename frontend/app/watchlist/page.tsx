"use client";
import { useState, useEffect } from "react";
import { api, WatchlistItem, ScoreHistory, NarrativeScore } from "@/lib/api";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function getWatchlistStatus(item: WatchlistItem) {
    const score = item.structural?.trend_persistence_score ?? 0;
    if (!item.is_active) return "inactive";
    if (score < 25) return "decay";
    if (score < 45) return "consolidating";
    return "active";
}

function DossierChart({ history }: { history: ScoreHistory[] }) {
    if (!history.length) return <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", padding: "16px 0" }}>Sin historial de scores aún</div>;
    return (
        <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={history} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
                <defs>
                    <linearGradient id="grad-struct" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-narr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00D4AA" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#00D4AA" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} />
                <Tooltip
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.75rem" }}
                    labelStyle={{ color: "var(--text-secondary)" }}
                />
                <Area type="monotone" dataKey="structural_score" name="Structural" stroke="#6C63FF" strokeWidth={2} fill="url(#grad-struct)" dot={false} />
                <Area type="monotone" dataKey="narrative_score" name="Narrative" stroke="#00D4AA" strokeWidth={1.5} fill="url(#grad-narr)" dot={false} />
            </AreaChart>
        </ResponsiveContainer>
    );
}

function WatchlistCard({ item, onRemove }: { item: WatchlistItem; onRemove: (s: string) => void }) {
    const status = getWatchlistStatus(item);
    const score = item.structural?.trend_persistence_score ?? 0;
    const state = item.structural?.structural_state ?? "none";
    const duration = item.structural?.duration_days ?? 0;

    const statusLabel = { active: "Activo", decay: "Momentum perdido", consolidating: "Consolidando", inactive: "Inactivo" }[status];
    const statusClass = { active: "active", decay: "decay", consolidating: "consolidating", inactive: "decay" }[status];

    return (
        <div className="glass-card" style={{ padding: "24px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: "1.3rem", fontWeight: 800 }}>{item.symbol}</span>
                        <span className={`watchlist-status ${statusClass}`}>{statusLabel}</span>
                        {status === "decay" && (
                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>🩶 Momentum perdido</span>
                        )}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 4 }}>
                        {item.structural?.name} · {item.structural?.sector}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>
                        Añadido el {new Date(item.added_at).toLocaleDateString("es-ES")}
                    </div>
                </div>

                <div style={{ textAlign: "right" }}>
                    <div style={{
                        fontSize: "2rem",
                        fontWeight: 800,
                        color: score >= 60 ? "var(--accent-emerald)" : score >= 40 ? "var(--accent-indigo)" : "var(--text-muted)",
                        letterSpacing: "-0.04em"
                    }}>
                        {score}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Score</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 4 }}>
                        {duration}d activo · {item.structural?.phase ?? "—"}
                    </div>
                    <button
                        className="btn btn-ghost btn-small"
                        style={{ marginTop: 8 }}
                        onClick={() => onRemove(item.symbol)}
                        id={`remove-${item.symbol}`}
                    >
                        Dejar de seguir
                    </button>
                </div>
            </div>

            {/* Score History Chart */}
            <DossierChart history={item.history} />

            {/* Latest AI Summary */}
            {item.structural?.details_json && (
                <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                        Señales detectadas
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {item.structural.volume_change_ratio > 1.3 && (
                            <span style={{ padding: "3px 8px", background: "rgba(245,158,11,0.1)", color: "var(--accent-amber)", borderRadius: 20, fontSize: "0.7rem" }}>
                                📊 Volumen ×{item.structural.volume_change_ratio.toFixed(1)}
                            </span>
                        )}
                        {item.structural.volatility_compression_days >= 20 && (
                            <span style={{ padding: "3px 8px", background: "rgba(108,99,255,0.1)", color: "var(--accent-indigo)", borderRadius: 20, fontSize: "0.7rem" }}>
                                🔄 Compresión {item.structural.volatility_compression_days}d
                            </span>
                        )}
                        {item.structural.relative_strength_20d > 0.02 && (
                            <span style={{ padding: "3px 8px", background: "rgba(0,212,170,0.1)", color: "var(--accent-emerald)", borderRadius: 20, fontSize: "0.7rem" }}>
                                ⬆️ RS fuerte vs sector
                            </span>
                        )}
                        {(item.structural.current_price > item.structural.ma200) && item.structural.ma200 > 0 && (
                            <span style={{ padding: "3px 8px", background: "rgba(59,130,246,0.1)", color: "var(--accent-blue)", borderRadius: 20, fontSize: "0.7rem" }}>
                                📈 Sobre MA200
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function WatchlistPage() {
    const [items, setItems] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);

    const loadWatchlist = async () => {
        setLoading(true);
        try {
            const res = await api.getWatchlist();
            setItems(res.watchlist || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadWatchlist(); }, []);

    const handleRemove = async (symbol: string) => {
        await api.unwatch(symbol);
        setItems((prev) => prev.filter((i) => i.symbol !== symbol));
    };

    const active = items.filter((i) => (i.structural?.trend_persistence_score ?? 0) >= 45);
    const monitor = items.filter((i) => (i.structural?.trend_persistence_score ?? 0) < 45);

    return (
        <>
            <div className="dashboard-header">
                <h1 className="dashboard-title">Mi Watchlist</h1>
                <p className="dashboard-subtitle">
                    Activos seguidos con historial completo · Nunca desaparecen, solo cambian de estado
                </p>
                <div className="stats-row" style={{ marginTop: 20 }}>
                    <div className="stat-chip">
                        <div className="stat-dot" style={{ background: "var(--accent-emerald)" }} />
                        <div>
                            <div className="stat-chip-value">{active.length}</div>
                            <div className="stat-chip-label">Activos</div>
                        </div>
                    </div>
                    <div className="stat-chip">
                        <div className="stat-dot" style={{ background: "var(--accent-rose)" }} />
                        <div>
                            <div className="stat-chip-value">{monitor.length}</div>
                            <div className="stat-chip-label">Vigilancia</div>
                        </div>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="asset-grid">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="skeleton" style={{ height: 280, borderRadius: "var(--radius-lg)" }} />
                    ))}
                </div>
            )}

            {!loading && items.length === 0 && (
                <div className="empty-state" style={{ paddingTop: 80 }}>
                    <div className="empty-state-icon">☆</div>
                    <p style={{ fontSize: "1rem", marginBottom: 8 }}>Tu watchlist está vacía</p>
                    <p>Pulsa "Seguir" en cualquier activo del dashboard para añadirlo aquí.</p>
                </div>
            )}

            {!loading && items.length > 0 && (
                <>
                    {active.length > 0 && (
                        <section style={{ marginBottom: 40 }}>
                            <div className="section-header">
                                <div className="section-title">
                                    <span style={{ fontSize: "1.2rem" }}>🟢</span>
                                    <h2>Estructuras activas</h2>
                                    <span className="section-pill confirmed">{active.length}</span>
                                </div>
                            </div>
                            {active.map((item) => (
                                <WatchlistCard key={item.symbol} item={item} onRemove={handleRemove} />
                            ))}
                        </section>
                    )}

                    {monitor.length > 0 && (
                        <section>
                            <div className="section-header">
                                <div className="section-title">
                                    <span style={{ fontSize: "1.2rem" }}>🩶</span>
                                    <h2>Momentum perdido · En vigilancia</h2>
                                    <span className="section-pill" style={{ background: "rgba(75,85,99,0.2)", color: "var(--text-muted)" }}>{monitor.length}</span>
                                </div>
                            </div>
                            {monitor.map((item) => (
                                <WatchlistCard key={item.symbol} item={item} onRemove={handleRemove} />
                            ))}
                        </section>
                    )}
                </>
            )}
        </>
    );
}
