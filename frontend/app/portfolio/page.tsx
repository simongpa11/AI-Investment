"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import TransactionModal from "@/components/TransactionModal";

export default function PortfolioPage() {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any>(null);
    const [contributions, setContributions] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalDefaultType, setModalDefaultType] = useState<"DEPOSIT" | "BUY">("DEPOSIT");

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const [sumRes, contRes] = await Promise.all([
                fetch(`${baseUrl}/api/portfolio/summary`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }),
                fetch(`${baseUrl}/api/portfolio/contributions`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
            ]);

            const sumData = await sumRes.json();
            const contData = await contRes.json();

            setSummary(sumData);
            setContributions(contData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleDelete = async (symbol: string) => {
        if (window.confirm(`¿Estás seguro de que quieres eliminar TODAS las operaciones de ${symbol}? Esta acción no se puede deshacer y recalculará inmediatamente tus métricas XIRR y TWR.`)) {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/portfolio/ledger/${encodeURIComponent(symbol)}`, {
                    method: "DELETE"
                });
                if (res.ok) {
                    loadData();
                } else {
                    alert("Error eliminando la empresa.");
                }
            } catch (err) {
                console.error(err);
            }
        }
    };

    useEffect(() => { loadData(); }, [loadData]);

    if (loading) {
        return (
            <div className="container" style={{ paddingTop: 40 }}>
                <h2>Cargando Mi Portfolio...</h2>
            </div>
        );
    }

    return (
        <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
            {/* 1. OVERVIEW AREA */}
            <section style={{ marginBottom: 40 }}>
                <h1 style={{ fontSize: "2rem", marginBottom: "8px", fontWeight: 700 }}>Mis posiciones</h1>
                <p style={{ color: "var(--text-muted)", marginBottom: "24px" }}>
                    Visión global del rendimiento real (XIRR/TWR) calculada desde tu registro de aportaciones.
                </p>

                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 16
                }}>
                    <div className="glass-panel" style={{ padding: "24px", borderRadius: "16px" }}>
                        <h3 style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "8px" }}>Valor Total</h3>
                        <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--text-main)" }}>
                            {summary?.total_value_eur?.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                        </div>
                        <div style={{ fontSize: "0.875rem", color: summary?.total_pl_eur >= 0 ? "var(--accent-emerald)" : "var(--accent-rose)", marginTop: "8px" }}>
                            {summary?.total_pl_eur >= 0 ? "+" : ""}{summary?.total_pl_eur?.toLocaleString("es-ES", { style: "currency", currency: "EUR" })} P&L
                        </div>
                    </div>

                    <div className="glass-panel" style={{ padding: "24px", borderRadius: "16px" }}>
                        <h3 style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "8px", display: "flex", gap: "6px", alignItems: "center" }}>
                            XIRR <span style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px" }}>PRINCIPAL</span>
                        </h3>
                        <div style={{ fontSize: "2rem", fontWeight: 700, color: summary?.xirr_pct >= 0 ? "var(--accent-emerald)" : "var(--accent-rose)" }}>
                            {summary?.xirr_pct >= 0 ? "+" : ""}{summary?.xirr_pct?.toFixed(2)}%
                        </div>
                        <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "8px" }}>
                            Rentabilidad anualizada real
                        </div>
                    </div>

                    <div className="glass-panel" style={{ padding: "24px", borderRadius: "16px" }}>
                        <h3 style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "8px" }}>TWR</h3>
                        <div style={{ fontSize: "2rem", fontWeight: 700, color: summary?.twr_pct >= 0 ? "var(--text-main)" : "var(--accent-rose)" }}>
                            {summary?.twr_pct >= 0 ? "+" : ""}{summary?.twr_pct?.toFixed(2)}%
                        </div>
                        <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "8px" }}>
                            Rendimiento de la estrategia
                        </div>
                    </div>

                    <div className="glass-panel" style={{ padding: "24px", borderRadius: "16px" }}>
                        <h3 style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "8px" }}>Cash Disponible</h3>
                        <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--text-main)" }}>
                            {summary?.cash_eur?.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                        </div>
                        <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "8px" }}>
                            Invertido: {summary?.total_invested_eur?.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                        </div>
                    </div>
                </div>
            </section>

            {/* 2. POSITIONS TABLE */}
            <section style={{ marginBottom: 40 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h2 style={{ fontSize: "1.25rem", color: "var(--accent-blue)" }}>Cartera Activa</h2>
                    <button
                        className="btn btn-primary"
                        style={{ padding: "8px 16px", fontSize: "0.875rem" }}
                        onClick={() => { setModalDefaultType("BUY"); setIsModalOpen(true); }}
                    >
                        + Nueva Operación
                    </button>
                </div>

                {summary?.positions?.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">💼</div>
                        <p>No tienes posiciones abiertas actualmente. Añade tu primer depósito de cash y luego compra tu primer ticker.</p>
                    </div>
                ) : (
                    <div className="glass-panel" style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                                    <th style={{ padding: "16px", fontWeight: 500 }}>Ticker</th>
                                    <th style={{ padding: "16px", fontWeight: 500 }}>Acciones</th>
                                    <th style={{ padding: "16px", fontWeight: 500 }}>Coste Medio</th>
                                    <th style={{ padding: "16px", fontWeight: 500 }}>Precio Actual</th>
                                    <th style={{ padding: "16px", fontWeight: 500 }}>Valor Total</th>
                                    <th style={{ padding: "16px", fontWeight: 500 }}>Peso (%)</th>
                                    <th style={{ padding: "16px", fontWeight: 500 }}>P&L</th>
                                    <th style={{ padding: "16px", fontWeight: 500 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary?.positions?.map((pos: any) => (
                                    <tr key={pos.symbol} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                        <td style={{ padding: "16px", fontWeight: 600 }}>
                                            {pos.name && pos.name !== pos.symbol ? pos.name : pos.symbol}
                                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px", fontWeight: 400 }}>{pos.symbol}</div>
                                        </td>
                                        <td style={{ padding: "16px", color: "var(--text-muted)" }}>{pos.shares?.toFixed(4)}</td>
                                        <td style={{ padding: "16px", color: "var(--text-muted)" }}>€{pos.avg_cost_eur?.toFixed(2)}</td>
                                        <td style={{ padding: "16px" }}>€{pos.current_price_eur?.toFixed(2)}</td>
                                        <td style={{ padding: "16px", fontWeight: 500 }}>€{pos.value_eur?.toFixed(2)}</td>
                                        <td style={{ padding: "16px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <div style={{ width: "60px", height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", overflow: "hidden" }}>
                                                    <div style={{ width: `${pos.weight_pct}%`, height: "100%", background: "var(--accent-blue)" }}></div>
                                                </div>
                                                <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>{pos.weight_pct?.toFixed(1)}%</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: "16px", color: pos.pl_eur >= 0 ? "var(--accent-emerald)" : "var(--accent-rose)", fontWeight: 500 }}>
                                            {pos.pl_eur >= 0 ? "+" : ""}€{pos.pl_eur?.toFixed(2)} ({pos.pl_pct?.toFixed(2)}%)
                                        </td>
                                        <td style={{ padding: "16px", textAlign: "right" }}>
                                            <button
                                                onClick={() => handleDelete(pos.symbol)}
                                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--accent-rose)", fontSize: "1.1rem", padding: "4px" }}
                                                title={`Eliminar ${pos.symbol}`}
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* 3. CONTRIBUTIONS & TRIGGERS */}
            <section>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h2 style={{ fontSize: "1.25rem", color: "var(--accent-emerald)" }}>Aportaciones & Triggers</h2>
                    <button
                        className="btn"
                        style={{ padding: "8px 16px", fontSize: "0.875rem", border: "1px solid rgba(255,255,255,0.2)" }}
                        onClick={() => { setModalDefaultType("DEPOSIT"); setIsModalOpen(true); }}
                    >
                        + Nuevo Depósito
                    </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
                    {/* Triggers Policy Engine */}
                    <div className="glass-panel" style={{ padding: 24, borderRadius: 16 }}>
                        <h3 style={{ fontSize: "1rem", marginBottom: 16, color: "var(--text-main)" }}>Algoritmo de Aportación</h3>

                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                            <span style={{ color: "var(--text-muted)" }}>Drawdown Actual</span>
                            <span style={{ fontWeight: 600, color: contributions?.current_drawdown >= 10 ? "var(--accent-rose)" : "var(--text-main)" }}>
                                -{contributions?.current_drawdown?.toFixed(2)}%
                            </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                            <span style={{ color: "var(--text-muted)" }}>Aportación Base</span>
                            <span>€{contributions?.logic_state?.base_contribution?.toLocaleString()}</span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                            <span style={{ color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
                                Multiplicador Extra
                                {contributions?.logic_state?.trigger_active && (
                                    <span style={{ padding: "2px 6px", background: "var(--accent-rose)", color: "white", borderRadius: 4, fontSize: "0.65rem", marginLeft: 8 }}>
                                        {contributions.logic_state.trigger_active}
                                    </span>
                                )}
                            </span>
                            <span style={{ color: contributions?.logic_state?.extra_contribution > 0 ? "var(--accent-emerald)" : "var(--text-main)" }}>
                                +€{contributions?.logic_state?.extra_contribution?.toLocaleString()}
                            </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: "1.1rem" }}>
                            <span style={{ fontWeight: 600 }}>Total Recomendado</span>
                            <span style={{ fontWeight: 700, color: "var(--accent-emerald)" }}>€{contributions?.logic_state?.recommended_total?.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* History */}
                    <div className="glass-panel" style={{ padding: 24, borderRadius: 16 }}>
                        <h3 style={{ fontSize: "1rem", marginBottom: 16, color: "var(--text-main)" }}>Historial de Depósitos</h3>

                        {!contributions?.history || contributions?.history?.length === 0 ? (
                            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No hay registros de depósitos.</p>
                        ) : (
                            <div style={{ maxHeight: "250px", overflowY: "auto" }}>
                                <table style={{ width: "100%", textAlign: "left", fontSize: "0.875rem" }}>
                                    <thead style={{ position: "sticky", top: 0, background: "var(--bg-main)" }}>
                                        <tr style={{ color: "var(--text-muted)" }}>
                                            <th style={{ paddingBottom: 12, fontWeight: 500 }}>Fecha</th>
                                            <th style={{ paddingBottom: 12, fontWeight: 500, textAlign: "right" }}>Importe</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {contributions?.history?.map((dep: any) => (
                                            <tr key={dep.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                                <td style={{ paddingTop: 12, paddingBottom: 12 }}>{new Date(dep.date).toLocaleDateString()}</td>
                                                <td style={{ paddingTop: 12, paddingBottom: 12, textAlign: "right", color: "var(--accent-emerald)", fontWeight: 500 }}>
                                                    +€{dep.total_eur?.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                defaultType={modalDefaultType}
                onSuccess={() => loadData()}
            />
        </div>
    );
}
