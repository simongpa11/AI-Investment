"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

type ModalType = "DEPOSIT" | "BUY";

export default function TransactionModal({
    isOpen,
    onClose,
    onSuccess,
    defaultType = "DEPOSIT"
}: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    defaultType?: ModalType;
}) {
    const [type, setType] = useState<ModalType>(defaultType);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [symbol, setSymbol] = useState("");
    const [displaySymbol, setDisplaySymbol] = useState("");
    const [shares, setShares] = useState("");
    const [price, setPrice] = useState("");
    const [currency, setCurrency] = useState("EUR");
    const [totalEur, setTotalEur] = useState("");
    const [loading, setLoading] = useState(false);

    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        if (type !== "BUY" || !displaySymbol || displaySymbol.length < 2 || !showSuggestions) {
            setSuggestions([]);
            return;
        }
        const delayDebounceFn = setTimeout(async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/assets/search?q=${displaySymbol}`);
                if (res.ok) {
                    const data = await res.json();
                    setSuggestions(data.data || []);
                }
            } catch (err) {
                console.error("Error fetching suggestions:", err);
            }
        }, 350);

        return () => clearTimeout(delayDebounceFn);
    }, [displaySymbol, type, showSuggestions]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            type: type,
            date: date,
            symbol: type === "BUY" ? (symbol || displaySymbol).toUpperCase() : null,
            name: type === "BUY" ? displaySymbol : null,
            shares: type === "BUY" ? parseFloat(shares) : null,
            price_per_share: type === "BUY" ? parseFloat(price) : null,
            currency: type === "BUY" ? currency : "EUR",
            fx_rate: 1.0,
            total_eur: parseFloat(totalEur)
        };

        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const res = await fetch(`${baseUrl}/api/portfolio/ledger`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Error guardando operación");

            onSuccess();
            onClose();
            // Reset
            setSymbol("");
            setDisplaySymbol("");
            setShares("");
            setPrice("");
            setCurrency("EUR");
            setTotalEur("");
        } catch (error) {
            alert("Error guardando la operación");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
            <div className="glass-panel" style={{ width: "100%", maxWidth: "450px", padding: "32px", borderRadius: "24px" }}>
                <h2 style={{ fontSize: "1.25rem", marginBottom: "24px", color: "white" }}>
                    {type === "DEPOSIT" ? "Nuevo Depósito" : "Nueva Operación (Compra)"}
                </h2>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
                        <button
                            type="button"
                            onClick={() => setType("DEPOSIT")}
                            style={{
                                flex: 1, padding: "8px", borderRadius: "8px", border: "none", cursor: "pointer",
                                backgroundColor: type === "DEPOSIT" ? "var(--accent-blue)" : "rgba(255,255,255,0.05)",
                                color: type === "DEPOSIT" ? "white" : "var(--text-muted)"
                            }}
                        >
                            Cash In
                        </button>
                        <button
                            type="button"
                            onClick={() => setType("BUY")}
                            style={{
                                flex: 1, padding: "8px", borderRadius: "8px", border: "none", cursor: "pointer",
                                backgroundColor: type === "BUY" ? "var(--accent-blue)" : "rgba(255,255,255,0.05)",
                                color: type === "BUY" ? "white" : "var(--text-muted)"
                            }}
                        >
                            Comprar Ticker
                        </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Fecha</label>
                        <input
                            type="date"
                            required
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            style={{ padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", color: "white" }}
                        />
                    </div>

                    {type === "BUY" && (
                        <>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }}>
                                <label style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Ticker (Nombre o Símbolo)</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Nvidia o NVDA"
                                    required
                                    value={displaySymbol}
                                    onChange={e => {
                                        setDisplaySymbol(e.target.value);
                                        setSymbol("");
                                        setShowSuggestions(true);
                                    }}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    style={{ padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", color: "white", width: "100%" }}
                                />
                                {showSuggestions && suggestions.length > 0 && (
                                    <div style={{
                                        position: "absolute", top: "100%", left: 0, right: 0, marginTop: "4px",
                                        background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.2)",
                                        borderRadius: "8px", overflow: "hidden", zIndex: 10, maxHeight: "250px", overflowY: "auto",
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
                                    }}>
                                        {suggestions.map((s, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    padding: "12px 16px", cursor: "pointer",
                                                    borderBottom: idx < suggestions.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                                                    display: "flex", justifyContent: "space-between", alignItems: "center"
                                                }}
                                                onClick={() => {
                                                    setSymbol(s.symbol);
                                                    setDisplaySymbol(s.description || s.symbol);
                                                    setShowSuggestions(false);
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                                                onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                                            >
                                                <span style={{ fontWeight: 600, color: "var(--accent-blue)" }}>{s.symbol}</span>
                                                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", textAlign: "right", maxWidth: "60%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {s.description}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: "flex", gap: "16px" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                                    <label style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Acciones</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={shares}
                                        onChange={e => setShares(e.target.value)}
                                        style={{ padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", color: "white" }}
                                    />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                                    <label style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Precio/Acción</label>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <input
                                            type="number"
                                            step="any"
                                            placeholder="En divisa original"
                                            required
                                            value={price}
                                            onChange={e => setPrice(e.target.value)}
                                            style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", color: "white", width: "100%" }}
                                        />
                                        <select
                                            value={currency}
                                            onChange={e => setCurrency(e.target.value)}
                                            style={{ padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", color: "white", width: "80px", cursor: "pointer" }}
                                        >
                                            <option value="EUR">EUR</option>
                                            <option value="USD">USD</option>
                                            <option value="GBP">GBP</option>
                                            <option value="CNY">CNY</option>
                                            <option value="JPY">JPY</option>
                                            <option value="CHF">CHF</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                            {type === "DEPOSIT" ? "Importe (EUR)" : "Coste Total Cargado (EUR)"}
                        </label>
                        <input
                            type="number"
                            step="any"
                            required
                            value={totalEur}
                            onChange={e => setTotalEur(e.target.value)}
                            placeholder="Ej: 1000.00"
                            style={{ padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", color: "white" }}
                        />
                        {type === "BUY" && (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Introduce el impacto total real en tu cuenta en euros (incluyendo comisiones y tipo de cambio broker).
                            </span>
                        )}
                    </div>

                    <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "white", cursor: "pointer" }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary"
                            style={{ flex: 1, padding: "12px", border: "none", cursor: "pointer" }}
                        >
                            {loading ? "Guardando..." : "Guardar"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
