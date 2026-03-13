"use client";
import { useState, useEffect, useCallback } from "react";
import { api, WatchlistItem, StructuralScore } from "@/lib/api";
import { AssetCard } from "@/components/AssetCard";
import { MobileCardDeck } from "@/components/MobileCardDeck";

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= 768);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);
    return isMobile;
}

export default function WatchlistPage() {
    const [items, setItems] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const isMobile = useIsMobile();

    const loadWatchlist = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.getWatchlist();
            setItems(res.watchlist || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadWatchlist(); }, [loadWatchlist]);

    const handleWatchToggle = useCallback((symbol: string, nowWatched: boolean) => {
        if (!nowWatched) {
            setItems(prev => prev.filter(i => i.symbol !== symbol));
            api.unwatch(symbol).catch(() => { loadWatchlist(); });
        }
    }, [loadWatchlist]);

    const active = items.filter((i) => (i.structural?.trend_persistence_score ?? 0) >= 45);
    const monitor = items.filter((i) => (i.structural?.trend_persistence_score ?? 0) < 45);

    const emptySet = new Set<string>();

    const activeAssets: StructuralScore[] = active.map(i => i.structural!).filter(Boolean);
    const monitorAssets: StructuralScore[] = monitor.map(i => i.structural!).filter(Boolean);

    const watchedSymbols = new Set(items.map(i => i.symbol));

    return (
        <div style={{ paddingBottom: 60 }}>
            <div className="dashboard-header">
                <h1 className="dashboard-title">Mi Watchlist</h1>
                <p className="dashboard-subtitle">
                    Activos en seguimiento · Historial completo y tesis disponibles en el dossier
                </p>
                <div className="stats-row" style={{ marginTop: 24 }}>
                    <div className="stat-chip">
                        <div className="stat-dot" style={{ background: "var(--accent-emerald)" }} />
                        <div>
                            <div className="stat-chip-value">{active.length}</div>
                            <div className="stat-chip-label">Activas</div>
                        </div>
                    </div>
                    <div className="stat-chip">
                        <div className="stat-dot" style={{ background: "var(--accent-amber)" }} />
                        <div>
                            <div className="stat-chip-value">{monitor.length}</div>
                            <div className="stat-chip-label">En Vigilancia</div>
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="asset-grid">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="skeleton skeleton-card" />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className="empty-state" style={{ paddingTop: 80 }}>
                    <div className="empty-state-icon">★</div>
                    <p style={{ fontSize: "1rem", marginBottom: 8 }}>Tu watchlist está vacía</p>
                    <p>Usa el buscador o el scanner para añadir activos que quieras monitorizar.</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
                    {active.length > 0 && (
                        <section>
                            <div className="section-header">
                                <div className="section-title">
                                    <span style={{ fontSize: "1.2rem" }}>🟢</span>
                                    <h2>Tendencias Activas</h2>
                                    <span className="section-pill confirmed">{active.length}</span>
                                </div>
                            </div>
                            {isMobile ? (
                                <MobileCardDeck
                                    assets={activeAssets}
                                    watchedSymbols={watchedSymbols}
                                    onWatchToggle={handleWatchToggle}
                                    accentColor="#00D4AA"
                                />
                            ) : (
                                <div className="asset-grid">
                                    {activeAssets.map((asset) => (
                                        <AssetCard
                                            key={asset.symbol}
                                            asset={asset}
                                            isWatched={true}
                                            onWatchToggle={handleWatchToggle}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {monitor.length > 0 && (
                        <section>
                            <div className="section-header">
                                <div className="section-title">
                                    <span style={{ fontSize: "1.2rem" }}>🟡</span>
                                    <h2>Momentum Bajo / Consolidación</h2>
                                    <span className="section-pill emerging">{monitor.length}</span>
                                </div>
                            </div>
                            {isMobile ? (
                                <MobileCardDeck
                                    assets={monitorAssets}
                                    watchedSymbols={watchedSymbols}
                                    onWatchToggle={handleWatchToggle}
                                    accentColor="#F59E0B"
                                />
                            ) : (
                                <div className="asset-grid">
                                    {monitorAssets.map((asset) => (
                                        <AssetCard
                                            key={asset.symbol}
                                            asset={asset}
                                            isWatched={true}
                                            onWatchToggle={handleWatchToggle}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
