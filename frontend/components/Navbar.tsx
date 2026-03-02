"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function Navbar() {
    const pathname = usePathname();
    const [lastScanAt, setLastScanAt] = useState<string | null>(null);

    useEffect(() => {
        // Fetch the most recent created_at from structural_scores globally
        fetch(`${API_URL}/api/assets/last-scan`)
            .then(r => r.json())
            .then(d => {
                if (d?.last_scan) setLastScanAt(d.last_scan);
            })
            .catch(() => null);

        // Also refresh the timestamp every 3 minutes so it stays updated
        const interval = setInterval(() => {
            fetch(`${API_URL}/api/assets/last-scan`)
                .then(r => r.json())
                .then(d => {
                    if (d?.last_scan) setLastScanAt(d.last_scan);
                })
                .catch(() => null);
        }, 180000);
        return () => clearInterval(interval);
    }, []);

    const formatScanTime = (iso: string) => {
        const d = new Date(iso);
        const today = new Date();
        const isToday =
            d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear();

        const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
        if (isToday) return `Hoy · ${time}`;
        return `${d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} · ${time}`;
    };

    return (
        <nav className="navbar">
            <div className="navbar-logo">
                <div className="navbar-logo-icon">📈</div>
                <span className="navbar-logo-text">AI Investment</span>
            </div>
            <div className="navbar-nav">
                <Link href="/" className={`nav-link ${pathname === "/" ? "active" : ""}`}>
                    Dashboard
                </Link>
                <Link href="/watchlist" className={`nav-link ${pathname === "/watchlist" ? "active" : ""}`}>
                    Watchlist
                </Link>
                <Link href="/docs" className={`nav-link ${pathname === "/docs" ? "active" : ""}`} style={{ opacity: 0.7 }}>
                    Docs
                </Link>
            </div>
            <div className="navbar-actions">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: lastScanAt ? "var(--accent-emerald)" : "#4B5563",
                        boxShadow: lastScanAt ? "0 0 7px var(--accent-emerald)" : "none",
                        flexShrink: 0,
                        transition: "all 0.4s ease",
                    }} />
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {lastScanAt ? (
                            <>Último scan · <span style={{ color: "var(--text-secondary)" }}>{formatScanTime(lastScanAt)}</span></>
                        ) : (
                            "Cargando..."
                        )}
                    </span>
                </div>
            </div>
        </nav>
    );
}
