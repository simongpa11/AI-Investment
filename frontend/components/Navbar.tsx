"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navbar() {
    const pathname = usePathname();

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
            </div>
            <div className="navbar-actions">
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    Daily scan · EOD
                </span>
            </div>
        </nav>
    );
}
