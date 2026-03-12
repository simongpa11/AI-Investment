"use client";
import { useEffect, useState, useMemo } from "react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
    ComposedChart, Line
} from "recharts";
import { StructuralScore, NarrativeScore, ScoreHistory, STATE_LABELS, STATE_EMOJIS, getCombinedScore, api } from "@/lib/api";

const STATE_COLORS: Record<string, string> = {
    accumulation: "#00D4AA",
    early_accumulation: "#10B981",
    breakout: "#F59E0B",
    rotation: "#3B82F6",
    squeeze: "#F43F5E",
    none: "#4B5563",
};

type TabType = "scores" | "price" | "simulator";
type Timeframe = "1D" | "1S" | "1M" | "1A" | "MAX";

interface DossierModalProps {
    asset: StructuralScore;
    narrative?: NarrativeScore | null;
    onClose: () => void;
}

export function DossierModal({ asset, narrative, onClose }: DossierModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>("scores");

    // History Tab State
    const [history, setHistory] = useState<ScoreHistory[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // Price Tab State
    const [candles, setCandles] = useState<any[]>([]);
    const [timeframe, setTimeframe] = useState<Timeframe>("1A");
    const [loadingCandles, setLoadingCandles] = useState(false);

    // Simulator Tab State
    const [simInvest, setSimInvest] = useState<number>(1000);
    const [simCurrentPrice, setSimCurrentPrice] = useState<number>(asset.current_price || 0);
    const [simTargetPrice, setSimTargetPrice] = useState<number>(0);
    const [hasManuallySetTarget, setHasManuallySetTarget] = useState<boolean>(false);

    const stateColor = STATE_COLORS[asset.structural_state] || STATE_COLORS.none;
    const combined = getCombinedScore(
        asset.trend_persistence_score,
        narrative?.narrative_persistence_score ?? 0
    );

    // Fetch Score History
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await api.getHistory(asset.symbol, 90);
                setHistory(res.history || []);
            } catch {
                setHistory([]);
            } finally {
                setLoadingHistory(false);
            }
        };
        fetchHistory();

        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [asset.symbol, onClose]);

    // Fetch Price History
    useEffect(() => {
        if (activeTab === "price") {
            setLoadingCandles(true);
            api.getCandles(asset.symbol, timeframe)
                .then(res => setCandles(res.data || []))
                .catch(() => setCandles([]))
                .finally(() => setLoadingCandles(false));
        }
    }, [activeTab, timeframe, asset.symbol]);

    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    // Fetch live most recent price for Simulator defaults
    useEffect(() => {
        api.getCandles(asset.symbol, "1D").then(res => {
            if (res.data && res.data.length > 0) {
                const latest = res.data[res.data.length - 1];
                if (latest && latest.close) {
                    setSimCurrentPrice(Number(latest.close.toFixed(3)));
                }
            }
        }).catch(() => { });
    }, [asset.symbol]);

    // Build automated strategy recommendations based on ATR
    const { recBuy, recSell } = useMemo(() => {
        const details = asset.details_json as any;
        const atr = details?.compression?.current_atr || (simCurrentPrice * 0.05) || 0;
        return {
            recBuy: simCurrentPrice > 0 ? Math.max(0, simCurrentPrice - (atr * 1.5)) : 0,
            recSell: simCurrentPrice > 0 ? simCurrentPrice + (atr * 2.5) : 0
        };
    }, [asset, simCurrentPrice]);

    // Update target price automatically to recSell only if the user hasn't typed a custom one
    useEffect(() => {
        if (!hasManuallySetTarget && recSell > 0) {
            setSimTargetPrice(Number(recSell.toFixed(3)));
        }
    }, [recSell, hasManuallySetTarget]);

    // Simulator calcs
    const shares = simCurrentPrice > 0 ? simInvest / simCurrentPrice : 0;
    const projectedValue = shares * simTargetPrice;
    const profit = projectedValue - simInvest;
    const roi = simInvest > 0 ? (profit / simInvest) * 100 : 0;

    const hasData = history.length >= 2;

    const TabButton = ({ id, label }: { id: TabType, label: string }) => (
        <button
            onClick={() => setActiveTab(id)}
            style={{
                padding: "12px 16px",
                background: "transparent",
                border: "none",
                borderBottom: activeTab === id ? `2px solid ${stateColor}` : "2px solid transparent",
                color: activeTab === id ? "var(--text-primary)" : "var(--text-muted)",
                fontSize: "0.875rem",
                fontWeight: activeTab === id ? 600 : 500,
                cursor: "pointer",
                transition: "all 0.2s ease"
            }}
        >
            {label}
        </button>
    );

    return (
        <>
            <div
                onClick={onClose}
                style={{
                    position: "fixed", inset: 0, zIndex: 1000,
                    background: "rgba(0,0,0,0.7)",
                    backdropFilter: "blur(6px)",
                    animation: "fadeIn 0.18s ease",
                }}
            />

            <div style={{
                position: "fixed",
                top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 1001,
                width: "min(840px, 95vw)",
                maxHeight: "90vh",
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

                        <button
                            onClick={onClose}
                            style={{
                                background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)",
                                borderRadius: "50%", width: 32, height: 32, cursor: "pointer",
                                color: "var(--text-secondary)", fontSize: "1rem",
                                display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                        >×</button>
                    </div>

                    {/* Score row */}
                    <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
                        {[
                            { label: "Structural", value: asset.trend_persistence_score, color: "var(--score-structural)" },
                            { label: "Narrative", value: narrative?.narrative_persistence_score ?? 0, color: "var(--score-narrative)" },
                            { label: "Combined", value: combined, color: "var(--score-combined)" },
                        ].map((s) => (
                            <div key={s.label} style={{ flex: 1 }}>
                                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                                    {s.label}
                                </div>
                                <div style={{ fontSize: "2rem", fontWeight: 800, color: s.color, letterSpacing: "-0.04em", lineHeight: 1 }}>
                                    {s.value}
                                </div>
                                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 6 }}>
                                    <div style={{ width: `${Math.max(0, s.value)}%`, height: "100%", background: s.color, borderRadius: 2, transition: "width 0.5s ease" }} />
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
                                Vol ×{asset.volume_spike_ratio?.toFixed(1) ?? "—"}
                            </div>
                        </div>
                    </div>
                </div>

                {/* TABS */}
                <div style={{ display: "flex", borderBottom: "1px solid var(--border)", margin: "0 28px" }}>
                    <TabButton id="scores" label="Historial de Scores" />
                    <TabButton id="price" label="Evolución Estructural" />
                    <TabButton id="simulator" label="Simulador de Estrategia" />
                </div>

                {/* TAB CONTENT: SCORES */}
                {activeTab === "scores" && (
                    <div style={{ padding: "24px 28px 0", animation: "fadeIn 0.2s ease" }}>
                        {loadingHistory && (
                            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                                Cargando historial...
                            </div>
                        )}
                        {!loadingHistory && !hasData && (
                            <div style={{
                                height: 220, display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center",
                                color: "var(--text-muted)", fontSize: "0.875rem",
                                background: "rgba(255,255,255,0.02)",
                                borderRadius: "var(--radius-md)", border: "1px dashed var(--border)",
                            }}>
                                <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>📊</div>
                                <div>Historial disponible tras {2 - history.length} scan{history.length === 0 ? "s" : ""} más</div>
                            </div>
                        )}
                        {!loadingHistory && hasData && (
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={history} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
                                    <defs>
                                        <linearGradient id={`gs-${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--score-structural)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="var(--score-structural)" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id={`gn-${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--score-narrative)" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="var(--score-narrative)" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id={`gc-${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--score-combined)" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="var(--score-combined)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                    <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} axisLine={false} hide />
                                    <YAxis domain={[-100, 100]} tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ background: "var(--bg-card-elevated, #1a1a2e)", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.75rem" }}
                                        labelStyle={{ color: "var(--text-secondary)", marginBottom: 4 }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: "0.7rem", color: "var(--text-muted)", paddingTop: 8 }} />
                                    <Area type="monotone" dataKey="structural_score" name="Structural" stroke="var(--score-structural)" strokeWidth={2.5} fill={`url(#gs-${asset.symbol})`} dot={false} activeDot={{ r: 4, fill: "var(--score-structural)" }} />
                                    <Area type="monotone" dataKey="narrative_score" name="Narrative" stroke="var(--score-narrative)" strokeWidth={1.5} fill={`url(#gn-${asset.symbol})`} dot={false} activeDot={{ r: 3 }} />
                                    <Area type="monotone" dataKey="combined_score" name="Combined" stroke="var(--score-combined)" strokeWidth={2} fill={`url(#gc-${asset.symbol})`} dot={false} activeDot={{ r: 4, fill: "var(--score-combined)" }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}

                        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div>
                                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Señales detectadas</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {asset.volume_spike_ratio > 1.3 && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ fontSize: "1rem" }}>📊</span>
                                            <div>
                                                <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>Pico Vol. ×{asset.volume_spike_ratio.toFixed(2)}</div>
                                            </div>
                                        </div>
                                    )}
                                    {asset.distance_from_52w_high !== undefined && asset.distance_from_52w_high < 0.15 && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ fontSize: "1rem" }}>🏔️</span>
                                            <div>
                                                <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>{(asset.distance_from_52w_high * 100).toFixed(1)}% de Máx. 52 Semanas</div>
                                            </div>
                                        </div>
                                    )}
                                    {asset.volatility_compression_days >= 20 && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ fontSize: "1rem" }}>🔄</span>
                                            <div>
                                                <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>Compresión {asset.volatility_compression_days}d</div>
                                            </div>
                                        </div>
                                    )}
                                    {asset.relative_strength_market > 0.02 && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ fontSize: "1rem" }}>🏛️</span>
                                            <div>
                                                <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>🏛️ RS-Mkt +{(asset.relative_strength_market * 100).toFixed(1)}% vs SPY</div>
                                            </div>
                                        </div>
                                    )}
                                    {asset.trend_quality > 0.6 && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ fontSize: "1rem" }}>💎</span>
                                            <div>
                                                <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>💎 Calidad de tendencia: {(asset.trend_quality * 100).toFixed(0)}%</div>
                                            </div>
                                        </div>
                                    )}
                                    {asset.atr_expansion > 1.2 && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ fontSize: "1rem" }}>⚡</span>
                                            <div>
                                                <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>⚡ Expansión ATR ×{asset.atr_expansion.toFixed(1)}</div>
                                            </div>
                                        </div>
                                    )}
                                    {asset.ma200 > 0 && asset.current_price > asset.ma200 && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ fontSize: "1rem" }}>📈</span>
                                            <div>
                                                <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>Sobre MA200</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Inteligencia narrativa</div>
                                {narrative ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {narrative.summary_ai && (
                                            <div style={{
                                                padding: "10px 12px", background: "rgba(168, 85, 247, 0.06)", border: "1px solid rgba(168, 85, 247, 0.15)",
                                                borderRadius: "var(--radius-md)", fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5,
                                            }}>
                                                🤖 {narrative.summary_ai}
                                            </div>
                                        )}
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                            {narrative.tone_change && (
                                                <span style={{
                                                    padding: "2px 8px", background: narrative.tone_change === "improving" ? "rgba(168, 85, 247, 0.15)" : "rgba(244,63,94,0.1)",
                                                    color: narrative.tone_change === "improving" ? "var(--score-narrative)" : "var(--accent-rose)", borderRadius: 20, fontSize: "0.65rem", fontWeight: 600,
                                                }}>Tono: {narrative.tone_change}</span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Sin análisis narrativo disponible.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB CONTENT: PRICE EXTENDED */}
                {activeTab === "price" && (
                    <div style={{ padding: "24px 28px 0", animation: "fadeIn 0.2s ease" }}>
                        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                            {["1D", "1S", "1M", "1A", "MAX"].map((tf) => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeframe(tf as Timeframe)}
                                    style={{
                                        padding: "4px 12px",
                                        borderRadius: 20,
                                        border: "1px solid",
                                        borderColor: timeframe === tf ? stateColor : "rgba(255,255,255,0.1)",
                                        background: timeframe === tf ? `${stateColor}22` : "transparent",
                                        color: timeframe === tf ? stateColor : "var(--text-muted)",
                                        fontSize: "0.75rem",
                                        cursor: "pointer",
                                        transition: "all 0.2s"
                                    }}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>

                        {loadingCandles ? (
                            <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                                Cargando histórico de precio...
                            </div>
                        ) : candles.length === 0 ? (
                            <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                                No hay datos de precios para este rango.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <ComposedChart data={candles} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id={`gprice-${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={stateColor} stopOpacity={0.2} />
                                            <stop offset="95%" stopColor={stateColor} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                    <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} minTickGap={30} />
                                    <YAxis domain={['auto', 'auto']} tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ background: "var(--bg-card-elevated, #1a1a2e)", border: "1px solid var(--border)", borderRadius: 8 }}
                                        labelStyle={{ color: "var(--text-secondary)", marginBottom: 4 }}
                                        formatter={(value: number | undefined) => [value !== undefined ? `$${value.toFixed(2)}` : "—", "Precio"]}
                                    />
                                    <Area type="monotone" dataKey="close" name="Precio" stroke={stateColor} strokeWidth={2} fill={`url(#gprice-${asset.symbol})`} dot={false} activeDot={{ r: 4, fill: stateColor }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                )}

                {/* TAB CONTENT: SIMULATOR */}
                {activeTab === "simulator" && (
                    <div style={{ padding: "24px 28px 0", animation: "fadeIn 0.2s ease", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                        <div>
                            <h3 style={{ fontSize: "1rem", color: "var(--text-primary)", marginBottom: 20 }}>Simulador de Inversión</h3>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6 }}>Importe a invertir (€ / $)</label>
                                <input
                                    type="number"
                                    value={simInvest}
                                    onChange={(e) => setSimInvest(Number(e.target.value))}
                                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: "1rem" }}
                                />
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6 }}>Precio de compra actual ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={simCurrentPrice}
                                    onChange={(e) => setSimCurrentPrice(Number(e.target.value))}
                                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: "1rem" }}
                                />
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6 }}>Simulación precio de venta ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={simTargetPrice}
                                    onChange={(e) => {
                                        setSimTargetPrice(Number(e.target.value));
                                        setHasManuallySetTarget(true);
                                    }}
                                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: "1rem" }}
                                />
                            </div>
                        </div>

                        <div>
                            <h3 style={{ fontSize: "1rem", color: "var(--text-primary)", marginBottom: 20 }}>Resultados y Estrategia</h3>

                            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                    <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Acciones estimadas:</span>
                                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{shares.toFixed(2)}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                    <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Valor proyectado:</span>
                                    <span style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "1.1rem" }}>${projectedValue.toFixed(2)}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                                    <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Beneficio / ROI:</span>
                                    <span style={{ color: profit >= 0 ? "var(--accent-emerald)" : "var(--accent-rose)", fontWeight: 700, fontSize: "1.1rem" }}>
                                        {profit >= 0 ? "+" : ""}{profit.toFixed(2)} ({roi.toFixed(2)}%)
                                    </span>
                                </div>
                            </div>

                            <div style={{ background: "rgba(108,99,255,0.05)", border: "1px solid rgba(108,99,255,0.2)", borderRadius: 12, padding: 20 }}>
                                <h4 style={{ color: "var(--accent-indigo)", fontSize: "0.875rem", marginBottom: 12 }}>🤖 Recomendación Estructural (Auto)</h4>
                                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
                                    Basado en la volatilidad reciente (ATR) y el estado estructural <b>{STATE_LABELS[asset.structural_state]?.replace(/^[🟢🟡🔵🔴⚪] /, "")}</b>, el sistema sugiere los siguientes niveles para órdenes automáticas:
                                </p>

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                    <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Orden de Compra / Límite:</span>
                                    <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--accent-emerald)" }}>${recBuy.toFixed(2)}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Toma de beneficios (Target):</span>
                                    <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--accent-blue)" }}>${recSell.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translate(-50%, -46%) } to { opacity: 1; transform: translate(-50%, -50%) } }
      `}</style>
        </>
    );
}
