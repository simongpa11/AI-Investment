"use client";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { ScoreHistory } from "@/lib/api";

interface MiniChartProps {
    data: ScoreHistory[];
    dataKey?: "structural_score" | "narrative_score" | "combined_score";
    color?: string;
}

export function MiniChart({
    data,
    dataKey = "combined_score",
    color = "#6C63FF",
}: MiniChartProps) {
    if (!data || data.length === 0) {
        return (
            <div
                style={{
                    height: 40,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                    fontSize: "0.7rem",
                }}
            >
                No data
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={40}>
            <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                    <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Area
                    type="monotone"
                    dataKey={dataKey}
                    stroke={color}
                    strokeWidth={1.5}
                    fill={`url(#grad-${dataKey})`}
                    dot={false}
                    isAnimationActive={false}
                />
                <Tooltip
                    content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        return (
                            <div className="custom-tooltip" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: "0.7rem" }}>
                                {payload[0].value}
                            </div>
                        );
                    }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
