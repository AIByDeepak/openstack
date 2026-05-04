import { useEffect, useState } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { getOverview, getHosts, quickPlacementCheck, getFlavors, getInfo, getMetrics } from "@/lib/api";
import StatCard from "@/components/StatCard";
import ErrorBanner from "@/components/ErrorBanner";
import { sparkline } from "@/lib/mockData";
import {
    Server,
    Boxes,
    Cpu,
    AlertTriangle,
    Send,
    Activity,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Info,
    Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, AreaChart, Area } from "recharts";
import { toast } from "sonner";

function ActivityIcon({ status }) {
    if (status === "success") return <CheckCircle2 className="w-3.5 h-3.5 text-success" />;
    if (status === "warning") return <AlertCircle className="w-3.5 h-3.5 text-warning" />;
    if (status === "error") return <XCircle className="w-3.5 h-3.5 text-danger" />;
    return <Activity className="w-3.5 h-3.5 text-info" />;
}

function fmtUptime(sec) {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
}

export default function Overview() {
    const { tick } = useDashboard();
    const [data, setData] = useState(null);
    const [hosts, setHosts] = useState([]);
    const [flavors, setFlavors] = useState([]);
    const [info, setInfo] = useState(null);
    const [metrics, setMetrics] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    const [flavorInput, setFlavorInput] = useState("m1.large");
    const [checkResult, setCheckResult] = useState(null);
    const [checking, setChecking] = useState(false);

    const load = async () => {
        try {
            setLoading(true);
            const [o, h, f, i, m] = await Promise.all([getOverview(), getHosts(), getFlavors(), getInfo(), getMetrics()]);
            setData(o);
            setHosts(h);
            setFlavors(f);
            setInfo(i);
            setMetrics(m);
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [tick]);

    const onCheck = async () => {
        if (!flavorInput.trim()) return;
        setChecking(true);
        try {
            const res = await quickPlacementCheck(flavorInput.trim());
            setCheckResult(res);
            const ok = res.results.filter((r) => r.canPlace).length;
            toast.success(`Placement check complete`, { description: `${ok}/${res.results.length} hosts can place ${res.flavor.name}` });
        } catch (e) {
            toast.error(e.message);
            setCheckResult(null);
        } finally {
            setChecking(false);
        }
    };

    if (error) return <ErrorBanner message={error} onRetry={load} />;

    const stats = data?.stats;
    const cpuChart = hosts.map((h) => {
        const pct = Math.round(((h.usedDedicated + h.usedShared) / h.totalCpus) * 100);
        return {
            hostname: h.hostname.split(".")[0].replace("cn-", ""),
            pct,
            fill: pct > 90 ? "hsl(var(--danger))" : pct > 70 ? "hsl(var(--warning))" : "hsl(var(--success))",
        };
    });

    return (
        <div className="space-y-6 animate-fade-up">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Cluster Overview</h1>
                    <p className="text-[13px] text-muted-foreground mt-1 font-mono">
                        Real-time NUMA-aware placement intelligence across {stats?.total ?? 0} compute nodes
                    </p>
                </div>
            </div>

            {loading && !data ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 bg-card" />)}
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard testId="kpi-total-hosts" label="Total Hosts" value={stats.total} delta={4.2} deltaLabel={`${stats.active} active · ${stats.degraded} degraded`} sparklineData={sparkline(1, 15, 4)} color="accent" icon={Server} />
                    <StatCard testId="kpi-active-pockets" label="Active Pockets" value={stats.pockets} delta={0} deltaLabel="across 3 regions" sparklineData={sparkline(2, 4, 2)} color="success" icon={Boxes} />
                    <StatCard testId="kpi-hosts-free" label="Hosts With Free vCPUs" value={stats.hostsFree} delta={-2.8} deltaLabel={`${stats.totalCpus - stats.usedCpus} free vCPUs total`} sparklineData={sparkline(3, 12, 5)} color="warning" icon={Cpu} />
                    <StatCard testId="kpi-degraded" label="Degraded Hosts" value={stats.degraded + stats.down} delta={stats.degraded > 0 ? 12.5 : -5.2} deltaLabel={`${stats.degraded} degraded · ${stats.down} down`} sparklineData={sparkline(4, 3, 3)} color="danger" icon={AlertTriangle} />
                </div>
            )}

            {/* /info card + /metrics panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <section data-testid="system-info-card" className="rounded-lg border border-border bg-card p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Info className="w-3.5 h-3.5 text-accent" />
                        <h2 className="text-sm font-semibold">System Info</h2>
                        <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-muted-foreground">/info</span>
                    </div>
                    {info ? (
                        <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-[11px] font-mono">
                            <dt className="text-muted-foreground">name</dt><dd>{info.name}</dd>
                            <dt className="text-muted-foreground">version</dt><dd className="text-accent">{info.version}</dd>
                            <dt className="text-muted-foreground">build</dt><dd>{info.build}</dd>
                            <dt className="text-muted-foreground">git</dt><dd className="text-teal">{info.git_sha}</dd>
                            <dt className="text-muted-foreground">region</dt><dd>{info.region}</dd>
                            <dt className="text-muted-foreground">env</dt><dd>{info.environment}</dd>
                            <dt className="text-muted-foreground">policy</dt><dd>{info.policy}</dd>
                            <dt className="text-muted-foreground">uptime</dt><dd>{fmtUptime(info.uptime_seconds)}</dd>
                            <dt className="text-muted-foreground">schedulers</dt><dd>{info.schedulers}</dd>
                            <dt className="text-muted-foreground col-span-2 pt-2 border-t border-border mt-1">api base</dt>
                            <dd className="col-span-2 truncate text-info">{info.api_base}</dd>
                        </dl>
                    ) : (
                        <Skeleton className="h-40 bg-card-elev" />
                    )}
                </section>

                <section data-testid="metrics-panel" className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Gauge className="w-3.5 h-3.5 text-accent" />
                        <h2 className="text-sm font-semibold">Scheduler Metrics</h2>
                        <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-muted-foreground">/metrics · last 24h</span>
                    </div>
                    {metrics ? (
                        <>
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                                {[
                                    ["placements", metrics.counters.placements_total.toLocaleString()],
                                    ["failed", metrics.counters.placements_failed.toLocaleString(), "danger"],
                                    ["migrations", metrics.counters.migrations_total.toLocaleString()],
                                    ["cache hits", metrics.counters.cache_hits.toLocaleString(), "success"],
                                    ["miss rate", `${metrics.counters.cache_miss_rate}%`, "warning"],
                                ].map(([label, value, color]) => (
                                    <div key={label} className="rounded-md border border-border bg-card-elev/50 p-2.5">
                                        <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
                                        <div className={`text-sm font-mono mt-0.5 ${
                                            color === "danger" ? "text-danger" : color === "success" ? "text-success" : color === "warning" ? "text-warning" : ""
                                        }`}>{value}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                {[
                                    { key: "placements_per_min", label: "placements / min", color: "hsl(var(--accent))" },
                                    { key: "avg_decision_ms", label: "avg decision (ms)", color: "hsl(var(--teal))" },
                                ].map((s) => (
                                    <div key={s.key}>
                                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{s.label}</div>
                                        <div className="h-24">
                                            <ResponsiveContainer>
                                                <AreaChart data={metrics[s.key]} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor={s.color} stopOpacity={0.5} />
                                                            <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <XAxis dataKey="t" hide />
                                                    <YAxis hide domain={["dataMin - 4", "dataMax + 4"]} />
                                                    <Area type="monotone" dataKey="v" stroke={s.color} fill={`url(#g-${s.key})`} strokeWidth={1.75} isAnimationActive animationDuration={900} />
                                                    <Tooltip cursor={{ stroke: "hsl(var(--border))" }} contentStyle={{ background: "hsl(var(--card-elev))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <Skeleton className="h-48 bg-card-elev" />
                    )}
                </section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <section className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-sm font-semibold">Cluster vCPU Usage</h2>
                            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">per-host utilisation · color-coded</p>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-success" /> &lt; 70%</span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-warning" /> 70-90%</span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-danger" /> &gt; 90%</span>
                        </div>
                    </div>
                    <div className="h-[340px]">
                        <ResponsiveContainer>
                            <BarChart data={cpuChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--border))" />
                                <YAxis type="category" dataKey="hostname" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} width={120} stroke="hsl(var(--border))" />
                                <Tooltip cursor={{ fill: "hsl(var(--card-elev))" }} contentStyle={{ background: "hsl(var(--card-elev))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
                                <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                                    {cpuChart.map((d, i) => <Cell key={i} fill={d.fill} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                <section className="rounded-lg border border-border bg-card p-5">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                        <Send className="w-3.5 h-3.5 text-accent" /> Quick Placement Check
                    </h2>
                    <p className="text-[11px] font-mono text-muted-foreground mt-1">Test a flavor against the cluster.</p>
                    <div className="flex gap-2 mt-4">
                        <input
                            data-testid="placement-flavor-input"
                            value={flavorInput}
                            onChange={(e) => setFlavorInput(e.target.value)}
                            list="flavor-list"
                            placeholder="m1.large"
                            className="flex-1 h-9 px-3 rounded-md bg-card-elev border border-border text-[13px] font-mono outline-none focus:border-accent"
                        />
                        <datalist id="flavor-list">{flavors.map((f) => <option key={f.name} value={f.name} />)}</datalist>
                        <Button data-testid="placement-check-btn" onClick={onCheck} disabled={checking} className="bg-accent hover:bg-accent/90 text-white h-9">
                            {checking ? "Checking..." : "Check"}
                        </Button>
                    </div>
                    {checkResult && (
                        <div data-testid="placement-result" className="mt-4 space-y-2 max-h-72 overflow-y-auto pr-1">
                            <div className="text-[11px] font-mono text-muted-foreground">
                                {checkResult.results.filter((r) => r.canPlace).length}/{checkResult.results.length} can place ·{" "}
                                <span className="text-foreground">{checkResult.flavor.name}</span>{" "}
                                <span className="opacity-70">({checkResult.flavor.vcpus} vCPU / {checkResult.flavor.ram} GB)</span>
                            </div>
                            {checkResult.results.map((r) => (
                                <div key={r.hostId} className={`rounded-md border p-2.5 text-[11px] font-mono ${r.canPlace ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5"}`}>
                                    <div className="flex items-center justify-between">
                                        <span>{r.hostname}</span>
                                        {r.canPlace ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <XCircle className="w-3.5 h-3.5 text-danger" />}
                                    </div>
                                    {!r.canPlace && <div className="text-muted-foreground mt-1">{r.reasons.join(" · ")}</div>}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <section className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold">Recent Activity</h2>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">last 10 events</span>
                </div>
                <ul data-testid="activity-log" className="divide-y divide-border">
                    {(data?.activity ?? []).map((a) => (
                        <li key={a.id} className="flex items-center gap-3 py-2.5 text-[12px]">
                            <ActivityIcon status={a.status} />
                            <span className="flex-1 font-mono">{a.text}</span>
                            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{a.time}</span>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
