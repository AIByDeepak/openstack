import { useEffect, useMemo, useState } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { getHosts, getFlavors, getFlavorVisibility, csvFromVisibility } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import ErrorBanner from "@/components/ErrorBanner";
import { Search, Layers3, Star, Plus, X, Download, LayoutGrid } from "lucide-react";
import { toast } from "sonner";

const AGGREGATES = ["ANI-perf", "ANI-default", "ANI-gpu", "ANI-edge"];

export default function Aggregator() {
    const { tick } = useDashboard();
    const [allHosts, setAllHosts] = useState([]);
    const [flavors, setFlavors] = useState([]);
    const [activeAgg, setActiveAgg] = useState(AGGREGATES[0]);
    const [search, setSearch] = useState("");
    const [flavor, setFlavor] = useState("m1.large");
    const [aggHosts, setAggHosts] = useState([]);
    const [comparison, setComparison] = useState([]);
    const [matrix, setMatrix] = useState(null);
    const [view, setView] = useState("detail"); // detail | matrix
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = async () => {
        try {
            setLoading(true);
            const [hs, fs] = await Promise.all([getHosts(), getFlavors()]);
            setAllHosts(hs);
            setFlavors(fs);
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, [tick]);

    useEffect(() => {
        if (!flavor || !activeAgg) return;
        getFlavorVisibility(flavor, activeAgg).then((v) => setAggHosts(v.results));
    }, [flavor, activeAgg, tick]);

    const aggregateCards = useMemo(
        () =>
            AGGREGATES.map((agg) => {
                const hosts = allHosts.filter((h) => h.aggregate === agg);
                const healthy = hosts.filter((h) => h.status === "Active").length;
                return { name: agg, total: hosts.length, healthy };
            }).filter((a) =>
                !search ? true : a.name.toLowerCase().includes(search.toLowerCase())
            ),
        [allHosts, search]
    );

    const buildMatrix = async () => {
        toast.info("Building matrix...");
        const result = {};
        for (const f of flavors) {
            result[f.name] = {};
            for (const a of AGGREGATES) {
                // eslint-disable-next-line no-await-in-loop
                const v = await getFlavorVisibility(f.name, a);
                const can = v.results.filter((r) => r.canPlace).length;
                const total = v.results.length;
                result[f.name][a] = { can, total };
            }
        }
        setMatrix(result);
        toast.success("Matrix ready", { description: `${flavors.length} flavors × ${AGGREGATES.length} aggregates` });
    };

    const addCompare = (fname) => {
        if (comparison.includes(fname) || comparison.length >= 4) return;
        setComparison([...comparison, fname]);
    };
    const removeCompare = (fname) => setComparison(comparison.filter((c) => c !== fname));

    const [comparisonResults, setComparisonResults] = useState({});
    useEffect(() => {
        comparison.forEach((fname) => {
            if (comparisonResults[fname]) return;
            getFlavorVisibility(fname, activeAgg).then((v) =>
                setComparisonResults((prev) => ({ ...prev, [fname]: v.results }))
            );
        });
        // eslint-disable-next-line
    }, [comparison, activeAgg]);

    const exportComparison = () => {
        const headers = ["hostname", ...comparison].join(",");
        const lines = aggHosts.map((h) => {
            const row = [h.hostname];
            comparison.forEach((c) => {
                const r = (comparisonResults[c] || []).find((x) => x.hostname === h.hostname);
                row.push(r?.canPlace ? "yes" : "no");
            });
            return row.join(",");
        });
        const csv = [headers, ...lines].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `comparison-${activeAgg}.csv`;
        a.click();
        toast.success("Comparison exported");
    };

    const exportAggCsv = () => {
        const csv = csvFromVisibility(aggHosts, flavor);
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${activeAgg}-${flavor}.csv`;
        a.click();
    };

    if (error) return <ErrorBanner message={error} onRetry={load} />;

    const canPlaceCount = aggHosts.filter((r) => r.canPlace).length;
    const bestHosts = aggHosts.filter((r) => r.canPlace).sort((a, b) => b.freeVCpus - a.freeVCpus).slice(0, 5).map((b) => b.hostname);
    const aggHostObjs = allHosts.filter((h) => h.aggregate === activeAgg);
    const aggHealth = {
        active: aggHostObjs.filter((h) => h.status === "Active").length,
        degraded: aggHostObjs.filter((h) => h.status === "Degraded").length,
        down: aggHostObjs.filter((h) => h.status === "Down").length,
    };
    const total = aggHostObjs.length || 1;

    return (
        <div className="space-y-5 animate-fade-up">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Host Aggregator</h1>
                    <p className="text-[13px] text-muted-foreground mt-1 font-mono">Map flavors across host aggregates · v2.2</p>
                </div>
                <div className="flex bg-card border border-border rounded-md overflow-hidden">
                    <button
                        data-testid="agg-view-detail"
                        onClick={() => setView("detail")}
                        className={`px-3 h-9 text-[12px] font-mono ${view === "detail" ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-card-elev"}`}
                    >
                        Detail
                    </button>
                    <button
                        data-testid="agg-view-matrix"
                        onClick={() => { setView("matrix"); if (!matrix && flavors.length) buildMatrix(); }}
                        className={`px-3 h-9 text-[12px] font-mono inline-flex items-center gap-1.5 ${view === "matrix" ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-card-elev"}`}
                    >
                        <LayoutGrid className="w-3.5 h-3.5" /> Matrix
                    </button>
                </div>
            </div>

            {view === "matrix" ? (
                <div className="rounded-lg border border-border bg-card p-5 overflow-x-auto" data-testid="agg-matrix">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold">Flavor → Aggregate Matrix</h3>
                        <Button variant="outline" size="sm" className="h-8 bg-card-elev border-border" onClick={buildMatrix}>Rebuild</Button>
                    </div>
                    {!matrix ? (
                        <Skeleton className="h-64 bg-card-elev" />
                    ) : (
                        <table className="w-full text-[12px] font-mono border-collapse">
                            <thead>
                                <tr>
                                    <th className="text-left pb-2 pr-4 text-muted-foreground font-normal">flavor</th>
                                    {AGGREGATES.map((a) => (
                                        <th key={a} className="text-center pb-2 px-2 text-muted-foreground font-normal">{a}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {flavors.map((f) => (
                                    <tr key={f.name} className="border-t border-border">
                                        <td className="py-2 pr-4">{f.name}</td>
                                        {AGGREGATES.map((a) => {
                                            const cell = matrix[f.name]?.[a];
                                            if (!cell) return <td key={a} className="text-center"><Skeleton className="h-5 w-12 mx-auto bg-card-elev" /></td>;
                                            const pct = cell.total ? cell.can / cell.total : 0;
                                            const cls = pct > 0.8 ? "bg-success/15 text-success border-success/30" : pct > 0.5 ? "bg-warning/15 text-warning border-warning/30" : "bg-danger/15 text-danger border-danger/30";
                                            return (
                                                <td key={a} className="text-center py-2 px-2">
                                                    <button onClick={() => { setView("detail"); setActiveAgg(a); setFlavor(f.name); }} className={`px-2 py-0.5 rounded border ${cls}`}>
                                                        {cell.can}/{cell.total}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
                    {/* LEFT panel */}
                    <aside className="space-y-3">
                        <div className="flex items-center gap-2 px-2.5 h-9 rounded-md border border-border bg-card">
                            <Search className="w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                placeholder="search aggregate..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="flex-1 bg-transparent outline-none text-[13px] font-mono"
                                data-testid="agg-search"
                            />
                        </div>
                        {loading && allHosts.length === 0 ? (
                            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 bg-card" />)
                        ) : (
                            aggregateCards.map((agg) => (
                                <button
                                    key={agg.name}
                                    data-testid={`agg-card-${agg.name}`}
                                    onClick={() => setActiveAgg(agg.name)}
                                    className={`w-full text-left rounded-lg border bg-card p-4 transition-colors hover:border-border-strong ${
                                        activeAgg === agg.name ? "border-accent" : "border-border"
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Layers3 className="w-3.5 h-3.5 text-accent" />
                                        <span className="font-mono text-[13px]">{agg.name}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-2 text-[11px] font-mono text-muted-foreground">
                                        <span>{agg.total} hosts</span>
                                        <span className="text-success">{agg.healthy} healthy</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </aside>

                    {/* RIGHT panel */}
                    <section className="space-y-4">
                        <div className="rounded-lg border border-border bg-card p-5">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <h2 className="text-base font-semibold">{activeAgg}</h2>
                                    <p className="text-[11px] font-mono text-muted-foreground">
                                        {aggHostObjs.length} hosts · metadata: tier=performance, region=eu-west-1
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select value={flavor} onValueChange={setFlavor}>
                                        <SelectTrigger className="w-44 bg-card-elev border-border h-8 font-mono text-[12px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card border-border">
                                            {flavors.map((f) => (
                                                <SelectItem key={f.name} value={f.name} className="font-mono text-[12px]">{f.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={exportAggCsv} variant="outline" size="sm" className="h-8 bg-card-elev border-border gap-1.5">
                                        <Download className="w-3 h-3" /> CSV
                                    </Button>
                                </div>
                            </div>

                            {/* Health bar */}
                            <div className="mt-4">
                                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">aggregate health</div>
                                <div className="h-2 rounded-full overflow-hidden flex bg-card-elev">
                                    <div className="bg-success" style={{ width: `${(aggHealth.active / total) * 100}%` }} />
                                    <div className="bg-warning" style={{ width: `${(aggHealth.degraded / total) * 100}%` }} />
                                    <div className="bg-danger" style={{ width: `${(aggHealth.down / total) * 100}%` }} />
                                </div>
                                <div className="flex justify-between mt-1 text-[10px] font-mono text-muted-foreground">
                                    <span><span className="text-success">{aggHealth.active}</span> active</span>
                                    <span><span className="text-warning">{aggHealth.degraded}</span> degraded</span>
                                    <span><span className="text-danger">{aggHealth.down}</span> down</span>
                                </div>
                            </div>

                            <div className="mt-4 text-[12px] font-mono">
                                <span className="text-muted-foreground">{flavor}: </span>
                                <span className="text-success">{canPlaceCount}</span>
                                <span className="text-muted-foreground"> / {aggHosts.length} hosts can place</span>
                            </div>
                        </div>

                        {/* Hosts table */}
                        <div className="rounded-lg border border-border bg-card overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                                hosts in {activeAgg}
                            </div>
                            <div className="max-h-72 overflow-y-auto">
                                {aggHosts.length === 0 ? (
                                    <Skeleton className="h-32 bg-card-elev m-3" />
                                ) : (
                                    <table className="w-full text-[12px] font-mono">
                                        <thead className="text-muted-foreground sticky top-0 bg-card">
                                            <tr>
                                                <th className="text-left font-normal py-2 px-3">host</th>
                                                <th className="text-right font-normal py-2 px-3">free vCPUs</th>
                                                <th className="text-right font-normal py-2 px-3">free RAM</th>
                                                <th className="text-center font-normal py-2 px-3">place</th>
                                                <th className="text-left font-normal py-2 px-3">reason</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {aggHosts.map((r) => (
                                                <tr key={r.hostId} className="border-t border-border hover:bg-card-elev/40">
                                                    <td className="py-2 px-3 flex items-center gap-1.5">
                                                        {bestHosts.includes(r.hostname) && <Star className="w-3 h-3 text-warning fill-warning" />}
                                                        {r.hostname.split(".")[0]}
                                                    </td>
                                                    <td className="py-2 px-3 text-right tabular-nums">{r.freeVCpus}</td>
                                                    <td className="py-2 px-3 text-right tabular-nums">{r.freeRam}</td>
                                                    <td className="py-2 px-3 text-center">
                                                        {r.canPlace
                                                            ? <span className="text-success">✓</span>
                                                            : <span className="text-danger">✗</span>}
                                                    </td>
                                                    <td className="py-2 px-3 text-muted-foreground text-[11px]">
                                                        {r.canPlace ? "eligible" : r.reasons[0]}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* Multi-flavor comparison */}
                        <div className="rounded-lg border border-border bg-card p-5">
                            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                <h3 className="text-sm font-semibold">Multi-flavor comparison <span className="text-muted-foreground text-[11px] ml-2">{comparison.length}/4</span></h3>
                                {comparison.length > 0 && (
                                    <Button onClick={exportComparison} variant="outline" size="sm" className="h-7 bg-card-elev border-border gap-1.5">
                                        <Download className="w-3 h-3" /> CSV
                                    </Button>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {comparison.map((c) => (
                                    <span key={c} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-accent-soft text-accent border border-accent/30 text-[11px] font-mono">
                                        {c}
                                        <button onClick={() => removeCompare(c)}><X className="w-3 h-3" /></button>
                                    </span>
                                ))}
                                {comparison.length < 4 && (
                                    <Select onValueChange={addCompare}>
                                        <SelectTrigger className="w-44 bg-card-elev border-border h-7 text-[11px] font-mono"><SelectValue placeholder={<><Plus className="w-3 h-3 inline" /> add flavor</>} /></SelectTrigger>
                                        <SelectContent className="bg-card border-border">
                                            {flavors.filter((f) => !comparison.includes(f.name)).map((f) => (
                                                <SelectItem key={f.name} value={f.name} className="font-mono text-[11px]">{f.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                            {comparison.length > 0 && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[11px] font-mono">
                                        <thead className="text-muted-foreground">
                                            <tr>
                                                <th className="text-left py-2 px-2 font-normal">host</th>
                                                {comparison.map((c) => <th key={c} className="text-center py-2 px-2 font-normal">{c}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {aggHosts.slice(0, 12).map((h) => (
                                                <tr key={h.hostId} className="border-t border-border">
                                                    <td className="py-1.5 px-2">{h.hostname.split(".")[0]}</td>
                                                    {comparison.map((c) => {
                                                        const r = (comparisonResults[c] || []).find((x) => x.hostname === h.hostname);
                                                        return <td key={c} className="text-center">{r?.canPlace ? <span className="text-success">✓</span> : <span className="text-danger">✗</span>}</td>;
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
