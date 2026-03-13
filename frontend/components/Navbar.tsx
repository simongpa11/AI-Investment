"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const NAV_ITEMS = [
    { href: "/", label: "Scanner", icon: "🔍" },
    { href: "/watchlist", label: "Siguiendo", icon: "★" },
    { href: "/portfolio", label: "Posiciones", icon: "💼" },
    { href: "/docs", label: "Docs", icon: "📖" },
];

export function Navbar() {
    const pathname = usePathname();
    const [lastScanAt, setLastScanAt] = useState<string | null>(null);

    useEffect(() => {
        const fetchScan = () => {
            fetch(`${API_URL}/api/assets/last-scan`)
                .then(r => r.json())
                .then(d => { if (d?.last_scan) setLastScanAt(d.last_scan); })
                .catch(() => null);
        };
        fetchScan();
        const interval = setInterval(fetchScan, 180000);
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
        <>
            {/* ── DESKTOP / tablet top bar ── */}
            <nav className="navbar">
                <div className="navbar-logo">
                    <div className="navbar-logo-icon">📈</div>
                    <span className="navbar-logo-text">AI Investment</span>
                </div>
                <div className="navbar-nav">
                    {NAV_ITEMS.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`nav-link ${pathname === item.href ? "active" : ""}`}
                            style={item.href === "/docs" ? { opacity: 0.7 } : {}}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>
                <div className="navbar-actions">
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: lastScanAt ? "var(--accent-emerald)" : "#4B5563",
                            boxShadow: lastScanAt ? "0 0 7px var(--accent-emerald)" : "none",
                            flexShrink: 0, transition: "all 0.4s ease",
                        }} />
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                            {lastScanAt ? (
                                <>Último scan · <span style={{ color: "var(--text-secondary)" }}>{formatScanTime(lastScanAt)}</span></>
                            ) : "Cargando..."}
                        </span>
                    </div>
                </div>
            </nav>

            {/* ── MOBILE compact top strip ── */}
            <div className="mobile-topbar">
                <div className="navbar-logo" style={{ gap: 8 }}>
                    <div className="navbar-logo-icon" style={{ width: 28, height: 28, fontSize: 14 }}>📈</div>
                    <span className="navbar-logo-text" style={{ fontSize: "1rem" }}>AI Investment</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: lastScanAt ? "var(--accent-emerald)" : "#4B5563",
                        boxShadow: lastScanAt ? "0 0 6px var(--accent-emerald)" : "none",
                    }} />
                    <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                        {lastScanAt ? formatScanTime(lastScanAt) : "—"}
                    </span>
                </div>
            </div>

            {/* ── MOBILE bottom tab bar ── */}
            <nav className="mobile-bottombar">
                {NAV_ITEMS.map(item => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="mobile-tab"
                            style={{
                                color: isActive ? "var(--accent-indigo)" : "var(--text-muted)",
                                borderTop: isActive ? "2px solid var(--accent-indigo)" : "2px solid transparent",
                            }}
                        >
                            <span className="mobile-tab-icon">{item.icon}</span>
                            <span className="mobile-tab-label">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </>
    );
}
