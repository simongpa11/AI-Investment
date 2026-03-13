"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { StructuralScore } from "@/lib/api";
import { AssetCard } from "./AssetCard";

interface MobileCardDeckProps {
    assets: StructuralScore[];
    watchedSymbols: Set<string>;
    onWatchToggle: (symbol: string, watched: boolean) => void;
    accentColor?: string;
}

export function MobileCardDeck({
    assets,
    watchedSymbols,
    onWatchToggle,
    accentColor = "var(--accent-indigo)",
}: MobileCardDeckProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    // Spring resistance state
    const touchStartX = useRef(0);
    const touchStartScroll = useRef(0);
    const isAtEdge = useRef(false);
    const springOffset = useRef(0);
    const rafId = useRef<number | null>(null);

    const total = assets.length;

    // Update dot indicator on scroll
    const handleScroll = useCallback(() => {
        if (!trackRef.current) return;
        const el = trackRef.current;
        const cardWidth = el.firstElementChild
            ? (el.firstElementChild as HTMLElement).offsetWidth + 12 // gap
            : el.offsetWidth;
        const idx = Math.round(el.scrollLeft / cardWidth);
        setActiveIndex(Math.min(idx, total - 1));
    }, [total]);

    useEffect(() => {
        const el = trackRef.current;
        if (!el) return;
        el.addEventListener("scroll", handleScroll, { passive: true });
        return () => el.removeEventListener("scroll", handleScroll);
    }, [handleScroll]);

    // ── Spring / rubber-band touch handlers ──────────────────────────────────
    const applySpring = useCallback((offset: number) => {
        if (!trackRef.current) return;
        trackRef.current.style.transform = `translateX(${offset}px)`;
    }, []);

    const releaseSPring = useCallback(() => {
        if (!trackRef.current) return;
        springOffset.current = 0;
        trackRef.current.style.transition = "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)";
        trackRef.current.style.transform = "translateX(0px)";
        setTimeout(() => {
            if (trackRef.current) trackRef.current.style.transition = "";
        }, 450);
    }, []);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartScroll.current = trackRef.current?.scrollLeft ?? 0;
        isAtEdge.current = false;
        if (rafId.current) cancelAnimationFrame(rafId.current);
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!trackRef.current) return;
        const el = trackRef.current;
        const dx = e.touches[0].clientX - touchStartX.current;
        const atStart = el.scrollLeft <= 0;
        const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2;

        // Apply rubber-band resistance when at an edge
        if ((atStart && dx > 0) || (atEnd && dx < 0)) {
            isAtEdge.current = true;
            // Resistance: only 20% of actual gesture moves the track
            const resistance = dx * 0.18;
            springOffset.current = resistance;
            applySpring(resistance);
        } else {
            if (isAtEdge.current) {
                isAtEdge.current = false;
                applySpring(0);
            }
        }
    }, [applySpring]);

    const handleTouchEnd = useCallback(() => {
        if (isAtEdge.current) {
            releaseSPring();
        }
        isAtEdge.current = false;
    }, [releaseSPring]);

    if (total === 0) return null;

    return (
        <div className="deck-wrapper">
            {/* Counter badge */}
            <div className="deck-counter" style={{ color: accentColor }}>
                <span>{activeIndex + 1}</span>
                <span style={{ opacity: 0.4 }}> / {total}</span>
            </div>

            {/* Card track */}
            <div
                ref={trackRef}
                className="snap-deck"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {assets.map((asset) => (
                    <div key={asset.symbol} className="snap-card">
                        <AssetCard
                            asset={asset}
                            isWatched={watchedSymbols.has(asset.symbol)}
                            onWatchToggle={onWatchToggle}
                        />
                    </div>
                ))}
            </div>

            {/* Dot pagination */}
            {total > 1 && (
                <div className="deck-dots">
                    {assets.map((_, i) => (
                        <button
                            key={i}
                            className={`deck-dot ${i === activeIndex ? "active" : ""}`}
                            style={i === activeIndex ? { background: accentColor } : {}}
                            onClick={() => {
                                if (!trackRef.current) return;
                                const cardWidth =
                                    (trackRef.current.firstElementChild as HTMLElement | null)?.offsetWidth ?? trackRef.current.offsetWidth;
                                trackRef.current.scrollTo({
                                    left: i * (cardWidth + 12),
                                    behavior: "smooth",
                                });
                            }}
                            aria-label={`Card ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
