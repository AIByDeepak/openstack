import { useEffect, useState, useMemo } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { getMetricsRaw, getMetrics } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorBanner from "@/components/ErrorBanner";
import { Gauge, Copy } from "lucide-react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    AreaChart,
    Area,
} from "recharts";
import { toast } from "sonner";

// Minimal Prometheus text exposition parser
function parsePromText(text) {
    if (!text || typeof text !== "string") return [];
    const out = [];
    text.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        // metric{labels} value timestamp?
        const m = trimmed.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+(-?[0-9eE.+-]+)/);
        if (!m) return;
        out.push({ name: m[1], labels: m[2] || "", value: Number(m[3]) });
    });
    return out;
}

const KPI_KEYS = [
    { key: "scheduler_placements_total", label: "Placements", color: "hsl(var(--success))" },
    { key: "scheduler_placements_failed", label: "Failed", color: "hsl(var(--danger))" },
    { key: "scheduler_decision_ms", label: "Decision (ms)", color: "hsl(var(--accent))" },
    { key: "scheduler_cache_miss_rate", label: "Cache miss %", color: "hsl(var(--warning))" },
    { key: "scheduler_active_hosts", label: "Active hosts", color: "hsl(var(--success))" },
    { key: "scheduler_free_vcpus", label: "Free vCPUs", color: "hsl(var(--teal))" },
];

export default function Metrics() {
    const { tick } = useDashboard();
    const [raw, setRaw] = useState("");
    const [series, setSeries] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshTs, setRefreshTs] = useState(Date.now());

    const load = async () => {
        try {
            setLoading(true);
            const [r, s] = await Promise.all([getMetricsRaw(), getMetrics()]);
            setRaw(typeof r === "string" ? r : JSON.stringify(r, null, 2));
            setSeries(s);
            setRefreshTs(Date.now());
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [tick]);

    // Independent 15s poll for metrics
    useEffect(() => {
        const id = setInterval(load, 15000);
        return () => clearInterval(id);
    // eslint-disable-next-line
    }, []);

    const parsed = useMemo(() => parsePromText(raw), [raw]);
    const byKey = useMemo(() => Object.fromEntries(parsed.map((p) => [p.name, p.value])), [parsed]);

    const combined = useMemo(() => {
        if (!series) return [];
        return series.placements_per_min.map((p, i) => ({
            t: p.t,
            placements: p.v,
            decision: series.avg_decision_ms[i]?.v ?? 0,
        }));
    }, [series]);

    const copyRaw = () => {
        navigator.clipboard.writeText(raw);
        toast.success("Prometheus text copied");
    };

    if (error) return <ErrorBanner message={error} onRetry={load} />;

    return (
        <div className="space-y-5 animate-fade-up">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
                    <p className="text-[13px] text-muted-foreground mt-1 font-mono">/metrics · 15s poll · last refresh {new Date(refreshTs).toLocaleTimeString()}</p>
                </div>
            </div>

            {loading && !series ? (
                <Skeleton className="h-32 bg-card" />
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    {KPI_KEYS.map((k) => (
                        <div key={k.key} data-testid={`kpi-${k.key}`} className="rounded-lg border border-border bg-card p-4">
                            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                                <Gauge className="w-3 h-3" style={{ color: k.color }} />
                                {k.label}
                            </div>
                            <div className="text-xl lg:text-2xl font-mono font-semibold mt-1.5 tabular-nums" style={{ color: k.color }}>
                                {byKey[k.key]?.toLocaleString() ?? "—"}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <section className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Placement throughput · 24h</h3>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">placements / min</span>
                </div>
                <div className="h-[260px]">
                    {!series ? <Skeleton className="w-full h-full bg-card-elev" /> : (
                        <ResponsiveContainer>
                            <AreaChart data={combined} margin={{ left: 0, right: 8 }}>
                                <defs>
                                    <linearGradient id="g-pl" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.5} />
                                        <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="t" tick={{ fontSize: 9, fontFamily: "JetBrains Mono" }} stroke="hsl(var(--border))" />
                                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--border))" />
                                <Tooltip contentStyle={{ background: "hsl(var(--card-elev))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
                                <Area type="monotone" dataKey="placements" stroke="hsl(var(--accent))" fill="url(#g-pl)" strokeWidth={1.75} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Decision latency · 24h</h3>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">avg ms</span>
                </div>
                <div className="h-[220px]">
                    {!series ? <Skeleton className="w-full h-full bg-card-elev" /> : (
                        <ResponsiveContainer>
                            <LineChart data={combined} margin={{ left: 0, right: 8 }}>
                                <XAxis dataKey="t" tick={{ fontSize: 9, fontFamily: "JetBrains Mono" }} stroke="hsl(var(--border))" />
                                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--border))" />
                                <Tooltip contentStyle={{ background: "hsl(var(--card-elev))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
                                <Legend wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                                <Line type="monotone" dataKey="decision" stroke="hsl(var(--teal))" strokeWidth={1.5} dot={false} name="ms" />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </section>

            {/* Raw Prometheus text */}
            <section data-testid="prometheus-raw" className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold">Raw Prometheus output</h3>
                    <button onClick={copyRaw} className="text-[11px] font-mono inline-flex items-center gap-1.5 px-2 py-1 rounded bg-card-elev border border-border hover:border-accent">
                        <Copy className="w-3 h-3" /> copy
                    </button>
                </div>
                <pre className="text-[11px] font-mono text-muted-foreground p-4 overflow-x-auto whitespace-pre">
                    {typeof raw === "string" ? raw : "—"}
                </pre>
            </section>
        </div>
    );
}
