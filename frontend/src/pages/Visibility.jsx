import { useEffect, useMemo, useState, useRef } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
    getFlavors,
    getFlavorVisibility,
    getVisibilityHost,
    csvFromVisibility,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import StatusBadge from "@/components/StatusBadge";
import ErrorBanner from "@/components/ErrorBanner";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Cell,
    PieChart,
    Pie,
} from "recharts";
import {
    LayoutGrid,
    Table as TableIcon,
    BarChart3,
    Download,
    CheckCircle2,
    XCircle,
    Search,
    Copy,
} from "lucide-react";
import { toast } from "sonner";

const AGGREGATES = ["all", "ANI-perf", "ANI-default", "ANI-gpu", "ANI-edge"];
const HEAT_SIZES = { S: 32, M: 44, L: 60 };

export default function Visibility() {
    const { tick } = useDashboard();
    const [flavors, setFlavors] = useState([]);
    const [selected, setSelected] = useState("m1.large");
    const [aggregate, setAggregate] = useState("all");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState("all");
    const [view, setView] = useState("table");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [heatSize, setHeatSize] = useState("M");
    const [drawerHost, setDrawerHost] = useState(null);
    const [drawerDetail, setDrawerDetail] = useState(null);
    const tableScrollRef = useRef(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    const load = async () => {
        try {
            setLoading(true);
            const [fs, vis] = await Promise.all([
                getFlavors(),
                getFlavorVisibility(selected, aggregate === "all" ? null : aggregate),
            ]);
            setFlavors(fs);
            setData(vis);
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line
    }, [tick, selected, aggregate]);

    useEffect(() => {
        if (!drawerHost) return;
        getVisibilityHost(drawerHost, selected).then(setDrawerDetail);
    }, [drawerHost, selected]);

    const filtered = useMemo(() => {
        if (!data) return [];
        let arr = data.results;
        if (debouncedSearch)
            arr = arr.filter((r) =>
                r.hostname.toLowerCase().includes(debouncedSearch.toLowerCase())
            );
        if (filter === "can") arr = arr.filter((r) => r.canPlace);
        if (filter === "cannot") arr = arr.filter((r) => !r.canPlace);
        return arr;
    }, [data, debouncedSearch, filter]);

    const canCount = data?.results.filter((r) => r.canPlace).length ?? 0;
    const cannotCount = (data?.results.length ?? 0) - canCount;
    const placementRate = data ? Math.round((canCount / data.results.length) * 100) : 0;

    const rowVirtualizer = useVirtualizer({
        count: filtered.length,
        getScrollElement: () => tableScrollRef.current,
        estimateSize: () => 40,
        overscan: 12,
    });

    const exportCsv = () => {
        const csv = csvFromVisibility(data?.results || [], selected);
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `visibility-${selected}-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("CSV downloaded", { description: `visibility-${selected}.csv` });
    };

    const copyHostname = (h) => {
        navigator.clipboard.writeText(h);
        toast.success("Hostname copied", { description: h });
    };

    const chartData = useMemo(
        () =>
            (data?.results ?? [])
                .slice()
                .sort((a, b) => b.freeVCpus - a.freeVCpus)
                .slice(0, 30)
                .map((r) => ({
                    name: r.hostname.split(".")[0].replace("cn-", ""),
                    free: r.freeVCpus,
                    fill: r.canPlace ? "hsl(var(--success))" : "hsl(var(--danger))",
                })),
        [data]
    );

    const donutData = data
        ? [
              { name: "Can", value: canCount, fill: "hsl(var(--success))" },
              { name: "Cannot", value: cannotCount, fill: "hsl(var(--danger))" },
          ]
        : [];

    if (error) return <ErrorBanner message={error} onRetry={load} />;

    return (
        <div className="space-y-5 animate-fade-up">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Flavor Visibility</h1>
                    <p className="text-[13px] text-muted-foreground mt-1 font-mono">
                        Which hosts can place a given flavor — and why some cannot.
                    </p>
                </div>
            </div>

            {/* Top controls */}
            <div className="flex items-center gap-3 flex-wrap rounded-lg border border-border bg-card p-3">
                <Select value={selected} onValueChange={setSelected}>
                    <SelectTrigger
                        data-testid="flavor-select"
                        className="w-56 bg-card-elev border-border h-9 font-mono text-[13px]"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                        {flavors.map((f) => (
                            <SelectItem key={f.name} value={f.name} className="font-mono text-[13px]">
                                {f.name}
                                <span className="text-muted-foreground ml-2">
                                    ({f.vcpus}vC / {f.ram}G)
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={aggregate} onValueChange={setAggregate}>
                    <SelectTrigger
                        data-testid="aggregate-select"
                        className="w-44 bg-card-elev border-border h-9 font-mono text-[13px]"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                        {AGGREGATES.map((a) => (
                            <SelectItem key={a} value={a} className="font-mono text-[13px]">
                                {a}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="flex items-center gap-2 px-2.5 h-9 rounded-md border border-border bg-card-elev w-72">
                    <Search className="w-3.5 h-3.5 text-muted-foreground" />
                    <input
                        data-testid="visibility-search"
                        placeholder="filter hostname..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 bg-transparent outline-none text-[13px] font-mono"
                    />
                </div>

                <Button
                    data-testid="csv-export"
                    onClick={exportCsv}
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2 bg-card-elev border-border ml-auto"
                >
                    <Download className="w-3.5 h-3.5" /> CSV
                </Button>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="rounded-lg border border-border bg-card p-4">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Total Hosts
                    </div>
                    <div className="text-2xl font-mono font-semibold mt-1">
                        {data?.results.length ?? 0}
                    </div>
                </div>
                <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Can Place
                    </div>
                    <div
                        className="text-2xl font-mono font-semibold text-success mt-1"
                        data-testid="can-place-count"
                    >
                        {canCount}
                    </div>
                </div>
                <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Cannot Place
                    </div>
                    <div
                        className="text-2xl font-mono font-semibold text-danger mt-1"
                        data-testid="cannot-place-count"
                    >
                        {cannotCount}
                    </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Unknown
                    </div>
                    <div className="text-2xl font-mono font-semibold text-muted-foreground mt-1">
                        0
                    </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-4 col-span-2 lg:col-span-1">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Placement Rate
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="text-2xl font-mono font-semibold">{placementRate}%</div>
                    </div>
                    <div className="h-1.5 mt-2 rounded-full bg-card-elev overflow-hidden">
                        <div
                            className="h-full bg-success transition-all duration-700"
                            style={{ width: `${placementRate}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex bg-card border border-border rounded-md overflow-hidden">
                    {[
                        ["table", TableIcon, "Table"],
                        ["heatmap", LayoutGrid, "Heatmap"],
                        ["chart", BarChart3, "Chart"],
                    ].map(([k, Icon, label]) => (
                        <button
                            key={k}
                            data-testid={`view-${k}`}
                            onClick={() => setView(k)}
                            className={`px-3 h-9 text-[12px] font-mono inline-flex items-center gap-1.5 ${
                                view === k
                                    ? "bg-accent-soft text-accent"
                                    : "text-muted-foreground hover:bg-card-elev"
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" /> {label}
                        </button>
                    ))}
                </div>

                <div className="flex bg-card border border-border rounded-md overflow-hidden text-[11px] font-mono">
                    {[
                        ["all", "All"],
                        ["can", "Can"],
                        ["cannot", "Cannot"],
                    ].map(([k, l]) => (
                        <button
                            key={k}
                            data-testid={`filter-${k}`}
                            onClick={() => setFilter(k)}
                            className={`px-3 h-9 ${
                                filter === k
                                    ? "bg-accent text-white"
                                    : "text-muted-foreground hover:bg-card-elev"
                            }`}
                        >
                            {l}
                        </button>
                    ))}
                </div>

                {view === "heatmap" && (
                    <div className="flex bg-card border border-border rounded-md overflow-hidden text-[11px] font-mono">
                        {Object.keys(HEAT_SIZES).map((s) => (
                            <button
                                key={s}
                                data-testid={`heatmap-size-${s}`}
                                onClick={() => setHeatSize(s)}
                                className={`px-3 h-9 ${
                                    heatSize === s
                                        ? "bg-accent text-white"
                                        : "text-muted-foreground hover:bg-card-elev"
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Body */}
            {loading && !data ? (
                <Skeleton className="h-96 bg-card" />
            ) : view === "table" ? (
                <div className="rounded-lg border border-border bg-card">
                    <div className="grid grid-cols-[1fr_120px_90px_90px_70px_2fr] gap-2 px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                        <div>hostname</div>
                        <div>aggregate</div>
                        <div className="text-right">free vCPUs</div>
                        <div className="text-right">free RAM</div>
                        <div className="text-center">place</div>
                        <div>blocking reasons</div>
                    </div>
                    <div
                        ref={tableScrollRef}
                        data-testid="visibility-table"
                        className="h-[480px] overflow-auto"
                    >
                        <div
                            style={{
                                height: rowVirtualizer.getTotalSize(),
                                position: "relative",
                                width: "100%",
                            }}
                        >
                            {rowVirtualizer.getVirtualItems().map((vi) => {
                                const r = filtered[vi.index];
                                return (
                                    <div
                                        key={vi.key}
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            transform: `translateY(${vi.start}px)`,
                                            width: "100%",
                                            height: vi.size,
                                        }}
                                        onClick={() => setDrawerHost(r.hostname)}
                                        className="grid grid-cols-[1fr_120px_90px_90px_70px_2fr] gap-2 px-4 py-2 text-[12px] font-mono items-center border-b border-border hover:bg-card-elev/60 cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="truncate">{r.hostname}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    copyHostname(r.hostname);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 hover:text-accent"
                                            >
                                                <Copy className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="text-muted-foreground truncate">{r.aggregate}</div>
                                        <div className="text-right tabular-nums">{r.freeVCpus}</div>
                                        <div className="text-right tabular-nums">{r.freeRam}</div>
                                        <div className="text-center">
                                            {r.canPlace ? (
                                                <CheckCircle2 className="inline w-3.5 h-3.5 text-success" />
                                            ) : (
                                                <XCircle className="inline w-3.5 h-3.5 text-danger" />
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {r.canPlace ? (
                                                <span className="text-success text-[11px]">eligible</span>
                                            ) : (
                                                r.reasons.slice(0, 3).map((reason, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-1.5 py-0.5 rounded bg-danger/10 text-danger border border-danger/30 text-[10px]"
                                                    >
                                                        {reason}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ) : view === "heatmap" ? (
                <div className="rounded-lg border border-border bg-card p-5">
                    <div className="flex items-center gap-4 mb-4 text-[10px] font-mono text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-success/30 border border-success/40" /> can place
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-danger/15 border border-danger/40" /> cannot
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-card-elev border border-border" /> unknown
                        </span>
                    </div>
                    <div
                        data-testid="heatmap"
                        className="grid gap-1.5"
                        style={{
                            gridTemplateColumns: `repeat(auto-fill, minmax(${HEAT_SIZES[heatSize]}px, 1fr))`,
                        }}
                    >
                        {filtered.map((r) => (
                            <button
                                key={r.hostId}
                                onClick={() => setDrawerHost(r.hostname)}
                                title={`${r.hostname} · ${r.freeVCpus} vCPUs free${
                                    r.canPlace ? " · CAN" : " · " + (r.reasons[0] || "")
                                }`}
                                style={{ height: HEAT_SIZES[heatSize] }}
                                className={`rounded-md flex flex-col justify-between p-1.5 text-[9px] font-mono cursor-pointer transition-transform hover:scale-110 hover:z-10 hover:shadow-lg ${
                                    r.canPlace
                                        ? "bg-success/20 border border-success/40 text-success"
                                        : r.freeVCpus === 0
                                        ? "bg-card-elev border border-border text-muted-foreground"
                                        : "bg-danger/15 border border-danger/40 text-danger"
                                }`}
                            >
                                <span className="truncate text-left text-[8px]">
                                    {r.hostname.split("-").slice(1, 3).join("-").split(".")[0]}
                                </span>
                                <span className="text-right text-base font-semibold tabular-nums">
                                    {r.freeVCpus}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="grid lg:grid-cols-[1fr_360px] gap-5">
                    <div className="rounded-lg border border-border bg-card p-5">
                        <h3 className="text-sm font-semibold mb-3">Top 30 Hosts by Free vCPUs</h3>
                        <div className="h-[400px]">
                            <ResponsiveContainer>
                                <BarChart data={chartData} margin={{ left: 0, right: 8 }}>
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 9, fontFamily: "JetBrains Mono" }}
                                        stroke="hsl(var(--border))"
                                        angle={-45}
                                        textAnchor="end"
                                        height={70}
                                    />
                                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--border))" />
                                    <Tooltip
                                        cursor={{ fill: "hsl(var(--card-elev))" }}
                                        contentStyle={{
                                            background: "hsl(var(--card-elev))",
                                            border: "1px solid hsl(var(--border))",
                                            borderRadius: 6,
                                            fontSize: 11,
                                        }}
                                    />
                                    <Bar dataKey="free" radius={[4, 4, 0, 0]}>
                                        {chartData.map((d, i) => (
                                            <Cell key={i} fill={d.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-5">
                        <h3 className="text-sm font-semibold mb-3">Breakdown</h3>
                        <div className="h-[280px]">
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={donutData}
                                        dataKey="value"
                                        nameKey="name"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={4}
                                        stroke="hsl(var(--bg))"
                                        strokeWidth={2}
                                        label={(d) => `${d.name}: ${d.value}`}
                                    >
                                        {donutData.map((d, i) => (
                                            <Cell key={i} fill={d.fill} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Side panel */}
            <Sheet open={!!drawerHost} onOpenChange={(o) => !o && setDrawerHost(null)}>
                <SheetContent
                    side="right"
                    data-testid="visibility-drawer"
                    className="w-full sm:max-w-lg bg-background border-l border-border"
                >
                    <SheetHeader>
                        <SheetTitle className="font-mono text-base">{drawerHost}</SheetTitle>
                        <SheetDescription className="text-[12px]">
                            Visibility detail · flavor{" "}
                            <span className="text-foreground font-mono">{selected}</span>
                        </SheetDescription>
                    </SheetHeader>
                    {drawerDetail ? (
                        <div className="mt-5 space-y-4 text-[12px] font-mono">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded border border-border bg-card-elev/50 p-3">
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                        free vCPUs
                                    </div>
                                    <div className="text-lg mt-1">{drawerDetail.freeVCpus}</div>
                                </div>
                                <div className="rounded border border-border bg-card-elev/50 p-3">
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                        free RAM (GB)
                                    </div>
                                    <div className="text-lg mt-1">{drawerDetail.freeRam}</div>
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                                    can place {selected}?
                                </div>
                                {drawerDetail.canPlace ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-success/15 text-success border border-success/40">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-danger/15 text-danger border border-danger/40">
                                        <XCircle className="w-3.5 h-3.5" /> No
                                    </span>
                                )}
                            </div>
                            {!drawerDetail.canPlace && (
                                <div>
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                                        all blocking constraints
                                    </div>
                                    <ul className="space-y-1.5">
                                        {drawerDetail.reasons.map((r, i) => (
                                            <li
                                                key={i}
                                                className="px-3 py-1.5 rounded bg-danger/10 text-danger border border-danger/30 text-[11px]"
                                            >
                                                {r}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                                    aggregate
                                </div>
                                <StatusBadge status="Active" /> <span className="ml-2">{drawerDetail.aggregate}</span>
                            </div>
                        </div>
                    ) : (
                        <Skeleton className="h-40 mt-5 bg-card-elev" />
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
