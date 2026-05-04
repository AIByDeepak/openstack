import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, Tooltip } from "recharts";

export default function StatCard({ label, value, delta, deltaLabel, sparklineData, color = "accent", icon: Icon, testId }) {
    const positive = (delta ?? 0) >= 0;
    const colorVar = {
        accent: "hsl(var(--accent))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))",
    }[color];

    return (
        <div
            data-testid={testId}
            className="relative p-5 rounded-lg border border-border bg-card hover:border-border-strong transition-colors animate-fade-up overflow-hidden group"
        >
            <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-accent/40 to-transparent opacity-60" />

            <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                    {Icon && <Icon className="w-3.5 h-3.5" style={{ color: colorVar }} />}
                    {label}
                </div>
                {delta != null && (
                    <span
                        className={`inline-flex items-center gap-0.5 text-[11px] font-mono px-1.5 py-0.5 rounded ${
                            positive ? "text-success bg-success/10" : "text-danger bg-danger/10"
                        }`}
                    >
                        {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(delta).toFixed(1)}%
                    </span>
                )}
            </div>

            <div className="flex items-end justify-between gap-2">
                <div>
                    <div className="text-3xl lg:text-4xl font-semibold tracking-tight font-mono">{value}</div>
                    {deltaLabel && (
                        <div className="text-[11px] text-muted-foreground mt-1">{deltaLabel}</div>
                    )}
                </div>
                {sparklineData && (
                    <div className="w-24 h-10 -mb-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={sparklineData}>
                                <Line
                                    type="monotone"
                                    dataKey="y"
                                    stroke={colorVar}
                                    strokeWidth={1.75}
                                    dot={false}
                                    isAnimationActive
                                    animationDuration={800}
                                />
                                <Tooltip
                                    cursor={false}
                                    contentStyle={{
                                        background: "hsl(var(--card-elev))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: 6,
                                        fontSize: 11,
                                    }}
                                    labelStyle={{ display: "none" }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
