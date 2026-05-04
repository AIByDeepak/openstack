import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getInstances, getPlacementTrace } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import StatusBadge from "@/components/StatusBadge";
import ErrorBanner from "@/components/ErrorBanner";
import { Search, Copy } from "lucide-react";
import { toast } from "sonner";

export default function Instances() {
    const { tick } = useDashboard();
    const [instances, setInstances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [allTenants, setAllTenants] = useState(true);
    const [drawer, setDrawer] = useState(null);
    const [trace, setTrace] = useState(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    const load = async () => {
        try {
            setLoading(true);
            setInstances(await getInstances({ all_tenants: allTenants }));
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [tick, allTenants]);

    useEffect(() => {
        if (!drawer) return;
        getPlacementTrace(drawer.vm_uuid).then(setTrace);
    }, [drawer]);

    const filtered = useMemo(() => {
        if (!debounced) return instances;
        const q = debounced.toLowerCase();
        return instances.filter((i) => i.name.includes(q) || i.host?.toLowerCase().includes(q) || i.flavor.includes(q));
    }, [instances, debounced]);

    const rowVirt = useVirtualizer({
        count: filtered.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => 40,
        overscan: 12,
    });

    const copy = (s) => {
        navigator.clipboard.writeText(s);
        toast.success("copied", { description: s });
    };

    if (error) return <ErrorBanner message={error} onRetry={load} />;

    return (
        <div className="space-y-5 animate-fade-up">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Instances</h1>
                    <p className="text-[13px] text-muted-foreground mt-1 font-mono">{filtered.length} of {instances.length} VMs across the cluster</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-2.5 h-9 rounded-md border border-border bg-card w-72">
                        <Search className="w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            data-testid="instances-search"
                            placeholder="search vm, host, flavor..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 bg-transparent outline-none text-[13px] font-mono"
                        />
                    </div>
                    <label className="flex items-center gap-2 text-[12px] font-mono text-muted-foreground">
                        <input type="checkbox" checked={allTenants} onChange={(e) => setAllTenants(e.target.checked)} />
                        all tenants
                    </label>
                </div>
            </div>

            <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="grid grid-cols-[40px_1fr_140px_1fr_100px_70px_70px] gap-2 px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                    <div></div>
                    <div>name</div>
                    <div>flavor</div>
                    <div>host</div>
                    <div>state</div>
                    <div className="text-right">vcpus</div>
                    <div className="text-right">RAM</div>
                </div>
                {loading ? (
                    <div className="p-4 space-y-1.5">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 bg-card-elev" />)}</div>
                ) : (
                    <div ref={scrollRef} data-testid="instances-table" className="h-[560px] overflow-auto">
                        <div style={{ height: rowVirt.getTotalSize(), position: "relative", width: "100%" }}>
                            {rowVirt.getVirtualItems().map((vi) => {
                                const i = filtered[vi.index];
                                return (
                                    <div
                                        key={vi.key}
                                        style={{ position: "absolute", top: 0, left: 0, transform: `translateY(${vi.start}px)`, width: "100%", height: vi.size }}
                                        onClick={() => setDrawer(i)}
                                        className="grid grid-cols-[40px_1fr_140px_1fr_100px_70px_70px] gap-2 px-4 py-2 text-[12px] font-mono items-center border-b border-border hover:bg-card-elev/60 cursor-pointer"
                                    >
                                        <div onClick={(e) => { e.stopPropagation(); copy(i.vm_uuid); }} className="text-muted-foreground hover:text-accent">
                                            <Copy className="w-3 h-3" />
                                        </div>
                                        <div className="truncate">{i.name}</div>
                                        <div className="text-muted-foreground truncate">{i.flavor}</div>
                                        <div className="text-muted-foreground truncate">{i.host?.split(".")[0]}</div>
                                        <div><StatusBadge status={i.state} /></div>
                                        <div className="text-right tabular-nums">{i.vcpus}</div>
                                        <div className="text-right tabular-nums">{i.ram_gb}G</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <Sheet open={!!drawer} onOpenChange={(o) => { if (!o) { setDrawer(null); setTrace(null); } }}>
                <SheetContent side="right" data-testid="instance-drawer" className="w-full sm:max-w-lg bg-background border-l border-border">
                    <SheetHeader>
                        <SheetTitle className="font-mono text-base">{drawer?.name}</SheetTitle>
                        <SheetDescription className="text-[12px] font-mono break-all">{drawer?.vm_uuid}</SheetDescription>
                    </SheetHeader>
                    {drawer && (
                        <div className="mt-5 space-y-4 text-[12px] font-mono">
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    ["flavor", drawer.flavor],
                                    ["state", drawer.state],
                                    ["host", drawer.host?.split(".")[0]],
                                    ["aggregate", drawer.aggregate],
                                    ["vcpus", drawer.vcpus],
                                    ["ram", drawer.ram_gb + " GB"],
                                ].map(([l, v]) => (
                                    <div key={l} className="rounded border border-border bg-card-elev/40 p-3">
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div>
                                        <div className="mt-0.5">{v}</div>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">placement trace</div>
                                {trace ? (
                                    <ol className="relative border-l-2 border-border pl-5 space-y-3">
                                        {trace.steps.map((s, i) => (
                                            <li key={i}>
                                                <span className="absolute -left-[7px] w-3 h-3 rounded-full bg-accent border-2 border-card" />
                                                <div className="text-[10px] text-muted-foreground tabular-nums">+{s.ts}ms · {s.stage}</div>
                                                <div className="text-[12px]">{s.text}</div>
                                            </li>
                                        ))}
                                    </ol>
                                ) : (
                                    <Skeleton className="h-32 bg-card-elev" />
                                )}
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
