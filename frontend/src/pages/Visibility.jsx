import { useEffect, useMemo, useState } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { getFlavors, getFlavorVisibility } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import ErrorBanner from "@/components/ErrorBanner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { LayoutGrid, Table as TableIcon, CheckCircle2, XCircle } from "lucide-react";

export default function Visibility() {
    const { tick } = useDashboard();
    const [flavors, setFlavors] = useState([]);
    const [selected, setSelected] = useState("m1.large");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState("all"); // all / can / cannot
    const [view, setView] = useState("table");

    const load = async () => {
        try {
            setLoading(true);
            const [fs, vis] = await Promise.all([getFlavors(), getFlavorVisibility(selected)]);
            setFlavors(fs); setData(vis); setError(null);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [tick, selected]);

    const filteredResults = useMemo(() => {
        if (!data) return [];
        if (filter === "can") return data.results.filter((r) => r.canPlace);
        if (filter === "cannot") return data.results.filter((r) => !r.canPlace);
        return data.results;
    }, [data, filter]);

    const canCount = data?.results.filter((r) => r.canPlace).length ?? 0;
    const cannotCount = (data?.results.length ?? 0) - canCount;

    const chartData = useMemo(() => (data?.results ?? []).map((r) => ({
        name: r.hostname.split(".")[0].replace("cn-", ""),
        free: r.freeVCpus,
        fill: r.canPlace ? "hsl(var(--success))" : "hsl(var(--danger))",
    })), [data]);

    if (error) return <ErrorBanner message={error} onRetry={load} />;

    return (
        <div className="space-y-5 animate-fade-up">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Flavor Visibility</h1>
                    <p className="text-[13px] text-muted-foreground mt-1 font-mono">See which hosts can place a given flavor — and why some cannot.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={selected} onValueChange={setSelected}>
                        <SelectTrigger data-testid="flavor-select" className="w-56 bg-card border-border h-9 font-mono text-[13px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                            {flavors.map((f) => (
                                <SelectItem key={f.name} value={f.name} className="font-mono text-[13px]">
                                    {f.name} <span className="text-muted-foreground ml-2">({f.vcpus}vC / {f.ram}G)</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex bg-card border border-border rounded-md overflow-hidden">
                        <button
                            data-testid="view-table"
                            onClick={() => setView("table")}
                            className={`px-2.5 h-9 ${view === "table" ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-card-elev"}`}
                        ><TableIcon className="w-4 h-4" /></button>
                        <button
                            data-testid="view-heatmap"
                            onClick={() => setView("heatmap")}
                            className={`px-2.5 h-9 ${view === "heatmap" ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-card-elev"}`}
                        ><LayoutGrid className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Can Place</div>
                    <div className="text-3xl font-mono font-semibold text-success mt-1" data-testid="can-place-count">{canCount}</div>
                </div>
                <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Cannot Place</div>
                    <div className="text-3xl font-mono font-semibold text-danger mt-1" data-testid="cannot-place-count">{cannotCount}</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Flavor</div>
                    <div className="text-base font-mono mt-1">{data?.flavor.name}</div>
                    <div className="text-[11px] font-mono text-muted-foreground">{data?.flavor.vcpus} vCPU · {data?.flavor.ram} GB · {data?.flavor.disk} GB disk</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Hit Rate</div>
                    <div className="text-3xl font-mono font-semibold mt-1">
                        {data ? Math.round((canCount / data.results.length) * 100) : 0}<span className="text-base text-muted-foreground">%</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-5">
                <section className="rounded-lg border border-border bg-card p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold">Free vCPUs per Host</h2>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">green = can place</span>
                    </div>
                    <div className="h-[360px]">
                        {loading ? <Skeleton className="w-full h-full bg-card-elev" /> : (
                            <ResponsiveContainer>
                                <BarChart data={chartData} margin={{ left: 0, right: 8 }}>
                                    <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: "JetBrains Mono" }} stroke="hsl(var(--border))" angle={-45} textAnchor="end" height={70} />
                                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--border))" />
                                    <Tooltip cursor={{ fill: "hsl(var(--card-elev))" }} contentStyle={{ background: "hsl(var(--card-elev))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
                                    <Bar dataKey="free" radius={[4, 4, 0, 0]}>
                                        {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </section>

                <section className="rounded-lg border border-border bg-card p-5 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold">Filters</h2>
                        <div className="flex bg-card-elev border border-border rounded-md overflow-hidden text-[11px] font-mono">
                            {[["all", "All"], ["can", "Can"], ["cannot", "Cannot"]].map(([k, l]) => (
                                <button
                                    key={k}
                                    data-testid={`filter-${k}`}
                                    onClick={() => setFilter(k)}
                                    className={`px-3 h-7 ${filter === k ? "bg-accent text-white" : "text-muted-foreground hover:bg-card"}`}
                                >{l}</button>
                            ))}
                        </div>
                    </div>

                    {view === "table" ? (
                        <div className="overflow-y-auto flex-1 max-h-[360px]">
                            <table className="w-full text-[11px]" data-testid="visibility-table">
                                <thead className="text-muted-foreground sticky top-0 bg-card">
                                    <tr><th className="text-left font-mono font-normal py-2">host</th><th className="text-right font-mono font-normal py-2">free</th><th className="text-left font-mono font-normal py-2 pl-4">reason</th></tr>
                                </thead>
                                <tbody>
                                    {filteredResults.map((r) => (
                                        <tr key={r.hostId} className="border-t border-border">
                                            <td className="py-2 font-mono">{r.hostname.split(".")[0]}</td>
                                            <td className="py-2 text-right font-mono tabular-nums">{r.freeVCpus}</td>
                                            <td className="py-2 pl-4 font-mono text-muted-foreground">
                                                {r.canPlace ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="w-3 h-3" /> can place</span>
                                                    : <span className="inline-flex items-center gap-1 text-danger"><XCircle className="w-3 h-3" /> {r.reasons[0]}</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div data-testid="heatmap" className="flex-1 grid grid-cols-5 gap-2 content-start">
                            {(data?.results ?? []).map((r) => (
                                <div
                                    key={r.hostId}
                                    title={`${r.hostname} · free: ${r.freeVCpus}${r.canPlace ? " · CAN" : " · " + (r.reasons[0] || "")}`}
                                    className={`aspect-square rounded-md p-2 flex flex-col justify-between text-[9px] font-mono cursor-help transition-transform hover:scale-105 ${
                                        r.canPlace
                                            ? "bg-success/20 border border-success/40 text-success"
                                            : r.freeVCpus === 0
                                                ? "bg-card-elev border border-border text-muted-foreground"
                                                : "bg-danger/15 border border-danger/40 text-danger"
                                    }`}
                                >
                                    <span className="truncate">{r.hostname.split("-").slice(1, 3).join("-")}</span>
                                    <span className="text-base font-semibold tabular-nums">{r.freeVCpus}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
