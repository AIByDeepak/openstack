import { useEffect, useMemo, useState } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { getHosts, getAgentStatus } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import StatusBadge from "@/components/StatusBadge";
import HostDrawer from "@/components/HostDrawer";
import EmptyState from "@/components/EmptyState";
import ErrorBanner from "@/components/ErrorBanner";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Eye, Terminal, Power, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["Active", "Degraded", "Down"];

export default function Hosts() {
    const { tick } = useDashboard();
    const [hosts, setHosts] = useState([]);
    const [agentMap, setAgentMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState({ Active: true, Degraded: true, Down: true });
    const [dedRange, setDedRange] = useState([0, 128]);
    const [freeRange, setFreeRange] = useState([0, 128]);
    const [sort, setSort] = useState({ key: "hostname", dir: "asc" });
    const [selected, setSelected] = useState(new Set());
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;
    const [activeHost, setActiveHost] = useState(null);

    const load = async () => {
        try {
            setLoading(true);
            const [data, agents] = await Promise.all([getHosts(), getAgentStatus()]);
            setHosts(data);
            const map = {};
            agents.forEach((a) => { map[a.hostname] = a; });
            setAgentMap(map);
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [tick]);

    const filtered = useMemo(() => {
        let arr = hosts.filter((h) => {
            if (search && !h.hostname.toLowerCase().includes(search.toLowerCase())) return false;
            if (!statusFilter[h.status]) return false;
            if (h.dedicatedCpuCount < dedRange[0] || h.dedicatedCpuCount > dedRange[1]) return false;
            if (h.freeVCpus < freeRange[0] || h.freeVCpus > freeRange[1]) return false;
            return true;
        });
        const dir = sort.dir === "asc" ? 1 : -1;
        arr = [...arr].sort((a, b) => {
            const va = a[sort.key]; const vb = b[sort.key];
            if (typeof va === "number") return (va - vb) * dir;
            return String(va).localeCompare(String(vb)) * dir;
        });
        return arr;
    }, [hosts, search, statusFilter, dedRange, freeRange, sort]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const toggleSort = (key) => {
        setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    };

    const SortIcon = ({ k }) => {
        if (sort.key !== k) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
        return sort.dir === "asc" ? <ArrowUp className="w-3 h-3 text-accent" /> : <ArrowDown className="w-3 h-3 text-accent" />;
    };

    const toggleSelect = (id) => {
        setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };

    const allSelected = paged.length > 0 && paged.every((h) => selected.has(h.id));
    const toggleSelectAll = () => {
        setSelected((s) => {
            const n = new Set(s);
            if (allSelected) paged.forEach((h) => n.delete(h.id));
            else paged.forEach((h) => n.add(h.id));
            return n;
        });
    };

    if (error) return <ErrorBanner message={error} onRetry={load} />;

    return (
        <div className="space-y-5 animate-fade-up">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Hosts</h1>
                    <p className="text-[13px] text-muted-foreground mt-1 font-mono">{filtered.length} of {hosts.length} compute nodes</p>
                </div>
                {selected.size > 0 && (
                    <div data-testid="bulk-actions" className="flex items-center gap-2 text-[12px]">
                        <span className="text-muted-foreground font-mono">{selected.size} selected</span>
                        <Button variant="outline" size="sm" className="h-8 bg-card border-border">Drain</Button>
                        <Button variant="outline" size="sm" className="h-8 bg-card border-border">Reboot</Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
                <aside data-testid="host-filters" className="rounded-lg border border-border bg-card p-4 space-y-5 h-fit lg:sticky lg:top-20">
                    <div>
                        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Search</div>
                        <div className="flex items-center gap-2 px-2.5 h-9 rounded-md border border-border bg-card-elev">
                            <Search className="w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                data-testid="host-search"
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                placeholder="hostname..."
                                className="flex-1 bg-transparent outline-none text-[13px] font-mono"
                            />
                        </div>
                    </div>

                    <div>
                        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Status</div>
                        <div className="space-y-1.5">
                            {STATUSES.map((s) => (
                                <label key={s} className="flex items-center gap-2 text-[12px] font-mono cursor-pointer hover:text-foreground text-muted-foreground">
                                    <Checkbox
                                        data-testid={`filter-status-${s.toLowerCase()}`}
                                        checked={statusFilter[s]}
                                        onCheckedChange={() => { setStatusFilter((sf) => ({ ...sf, [s]: !sf[s] })); setPage(1); }}
                                    />
                                    <StatusBadge status={s} />
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex justify-between">
                            <span>Dedicated CPUs</span>
                            <span className="text-foreground tabular-nums">{dedRange[0]}-{dedRange[1]}</span>
                        </div>
                        <Slider min={0} max={128} step={4} value={dedRange} onValueChange={(v) => { setDedRange(v); setPage(1); }} />
                    </div>

                    <div>
                        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex justify-between">
                            <span>Free vCPUs</span>
                            <span className="text-foreground tabular-nums">{freeRange[0]}-{freeRange[1]}</span>
                        </div>
                        <Slider min={0} max={128} step={2} value={freeRange} onValueChange={(v) => { setFreeRange(v); setPage(1); }} />
                    </div>
                </aside>

                <div className="rounded-lg border border-border bg-card overflow-hidden">
                    {loading ? (
                        <div className="p-4 space-y-2">
                            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 bg-card-elev" />)}
                        </div>
                    ) : paged.length === 0 ? (
                        <EmptyState title="No hosts match your filters" description="Try widening the ranges or clearing the search." />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-[12px]" data-testid="hosts-table">
                                    <thead className="bg-card-elev text-muted-foreground sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2.5 w-8"><Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} data-testid="select-all" /></th>
                                            {[
                                                { key: "hostname", label: "hostname" },
                                                { key: "status", label: "status" },
                                                { key: "dedicatedCpuCount", label: "dedicated" },
                                                { key: "sharedCpuCount", label: "shared" },
                                                { key: "freeVCpus", label: "free vCPUs" },
                                                { key: "ramTotalGb", label: "RAM (GB)" },
                                                { key: "numaNodes", label: "NUMA" },
                                            ].map((c) => (
                                                <th key={c.key} className="text-left font-mono font-normal px-3 py-2.5">
                                                    <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-foreground">
                                                        {c.label} <SortIcon k={c.key} />
                                                    </button>
                                                </th>
                                            ))}
                                            <th className="text-right font-mono font-normal px-3 py-2.5">actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paged.map((h) => (
                                            <tr
                                                key={h.id}
                                                data-testid={`host-row-${h.id}`}
                                                className="border-t border-border hover:bg-card-elev/60 cursor-pointer"
                                                onClick={() => setActiveHost(h)}
                                            >
                                                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox checked={selected.has(h.id)} onCheckedChange={() => toggleSelect(h.id)} />
                                                </td>
                                                <td className="px-3 py-2.5 font-mono">
                                                    <div className="flex items-center gap-2">
                                                        {(() => {
                                                            const a = agentMap[h.hostname];
                                                            const cls = a?.agent_status === "healthy" ? "bg-success live-dot" : a?.agent_status === "degraded" ? "bg-warning" : "bg-danger";
                                                            const tip = a ? `agent · ${a.agent_status} · ${a.last_seen}` : "agent";
                                                            return <span title={tip} className={`w-1.5 h-1.5 rounded-full ${cls}`} />;
                                                        })()}
                                                        <span>{h.hostname}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5"><StatusBadge status={h.status} /></td>
                                                <td className="px-3 py-2.5 font-mono tabular-nums">{h.dedicatedCpuCount}</td>
                                                <td className="px-3 py-2.5 font-mono tabular-nums">{h.sharedCpuCount}</td>
                                                <td className="px-3 py-2.5 font-mono tabular-nums">
                                                    <span className={h.freeVCpus === 0 ? "text-danger" : h.freeVCpus < 10 ? "text-warning" : "text-success"}>{h.freeVCpus}</span>
                                                </td>
                                                <td className="px-3 py-2.5 font-mono tabular-nums">{h.ramTotalGb}</td>
                                                <td className="px-3 py-2.5 font-mono tabular-nums text-muted-foreground">{h.numaNodes}</td>
                                                <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                                                    <div className="inline-flex items-center gap-1">
                                                        <button onClick={() => setActiveHost(h)} title="View" className="p-1.5 rounded hover:bg-card-elev text-muted-foreground hover:text-foreground"><Eye className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => toast.info(`SSH ${h.hostname}`)} title="SSH" className="p-1.5 rounded hover:bg-card-elev text-muted-foreground hover:text-foreground"><Terminal className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => toast.warning(`Reboot scheduled for ${h.hostname}`)} title="Reboot" className="p-1.5 rounded hover:bg-card-elev text-muted-foreground hover:text-warning"><Power className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-[12px] font-mono">
                                <span className="text-muted-foreground">Page {page} of {totalPages}</span>
                                <div className="flex items-center gap-1">
                                    <Button variant="outline" size="icon" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="h-8 w-8 bg-card-elev border-border"><ChevronLeft className="w-3.5 h-3.5" /></Button>
                                    <Button variant="outline" size="icon" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="h-8 w-8 bg-card-elev border-border"><ChevronRight className="w-3.5 h-3.5" /></Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <HostDrawer host={activeHost} open={!!activeHost} onOpenChange={(o) => !o && setActiveHost(null)} />
        </div>
    );
}
