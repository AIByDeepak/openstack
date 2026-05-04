import { useEffect, useState } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { getCpuConfig } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "@/components/StatusBadge";
import ErrorBanner from "@/components/ErrorBanner";
import { ChevronDown } from "lucide-react";

function CpuCell({ index, kind, used }) {
    let cls;
    if (kind === "dedicated") cls = used ? "bg-accent" : "bg-accent/25 border border-accent/40";
    else cls = used ? "bg-teal" : "bg-teal/20 border border-teal/40";
    return <div title={`CPU ${index} · ${kind} · ${used ? "used" : "free"}`} className={`w-5 h-5 rounded-sm ${cls}`} />;
}

function HostCard({ host }) {
    const [open, setOpen] = useState(false);
    const dedPct = (host.dedicatedCpus.length / (host.dedicatedCpus.length + host.sharedCpus.length)) * 100;
    const sharedPct = 100 - dedPct;

    return (
        <div data-testid={`cpu-card-${host.id}`} className="rounded-lg border border-border bg-card p-5 hover:border-border-strong transition-colors">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="font-mono text-[13px]">{host.hostname}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                        {host.dedicatedCpus.length} dedicated · {host.sharedCpus.length} shared
                    </div>
                </div>
                <StatusBadge status={host.status} />
            </div>

            <div className="mt-4 h-2 rounded-full overflow-hidden flex bg-card-elev">
                <div className="bg-accent" style={{ width: `${dedPct}%` }} />
                <div className="bg-teal" style={{ width: `${sharedPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1.5">
                <span><span className="inline-block w-2 h-2 rounded-sm bg-accent mr-1.5" />dedicated · {Math.round(dedPct)}%</span>
                <span><span className="inline-block w-2 h-2 rounded-sm bg-teal mr-1.5" />shared · {Math.round(sharedPct)}%</span>
            </div>

            <button
                onClick={() => setOpen((o) => !o)}
                data-testid={`expand-${host.id}`}
                className="mt-4 w-full flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground py-1"
            >
                <span>{open ? "hide details" : "show details"}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="mt-3 space-y-3 animate-fade-up">
                    <div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">visual map</div>
                        <div className="flex flex-wrap gap-1">
                            {host.dedicatedCpus.map((i) => <CpuCell key={`d${i}`} index={i} kind="dedicated" used={i < host.usedDedicated} />)}
                            {host.sharedCpus.map((i, k) => <CpuCell key={`s${i}`} index={i} kind="shared" used={k < host.usedShared} />)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">cpu pills</div>
                        <div className="flex flex-wrap gap-1">
                            {host.dedicatedCpus.slice(0, 16).map((i) => (
                                <span key={`pd${i}`} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/30">cpu{i}</span>
                            ))}
                            {host.dedicatedCpus.length > 16 && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-muted-foreground">+{host.dedicatedCpus.length - 16}</span>
                            )}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">cpuset (dedicated)</div>
                        <code className="block font-mono text-[11px] bg-card-elev border border-border rounded px-2.5 py-1.5 text-accent">{host.cpusetDedicated}</code>
                    </div>
                    <div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">cpuset (shared)</div>
                        <code className="block font-mono text-[11px] bg-card-elev border border-border rounded px-2.5 py-1.5 text-teal">{host.cpusetShared}</code>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CpuConfig() {
    const { tick } = useDashboard();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = async () => {
        try { setLoading(true); setData(await getCpuConfig()); setError(null); }
        catch (e) { setError(e.message); } finally { setLoading(false); }
    };
    useEffect(() => { load(); }, [tick]);

    if (error) return <ErrorBanner message={error} onRetry={load} />;

    return (
        <div className="space-y-5 animate-fade-up">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">CPU Configuration</h1>
                <p className="text-[13px] text-muted-foreground mt-1 font-mono">Per-host dedicated and shared CPU allocation across the cluster</p>
            </div>
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 bg-card" />)}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {data.map((h) => <HostCard key={h.id} host={h} />)}
                </div>
            )}
        </div>
    );
}
