import { useEffect, useMemo, useState } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { getHosts, getInstances, getMigrationHistory } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import StatusBadge from "@/components/StatusBadge";
import ErrorBanner from "@/components/ErrorBanner";
import { ArrowRight, ShieldAlert, AlertTriangle, CheckCircle2, RefreshCcw, X } from "lucide-react";
import { toast } from "sonner";

function NumaBar({ free, total }) {
    const used = total - free;
    return (
        <div className="flex gap-0.5">
            {Array.from({ length: total }).map((_, i) => (
                <span
                    key={i}
                    className={`flex-1 h-3 rounded-sm ${i < used ? "bg-accent" : "bg-card-elev border border-border"}`}
                />
            ))}
        </div>
    );
}

function NumaState({ host, label }) {
    if (!host) return <Skeleton className="h-32 bg-card-elev" />;
    return (
        <div className="rounded-md border border-border bg-card-elev/40 p-3 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="text-[12px] font-mono">{host.hostname.split(".")[0]}</div>
            {host.numa.map((n) => (
                <div key={n.id}>
                    <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-muted-foreground">node {n.id}</span>
                        <span className="text-success">{n.freeVCpus} free</span>
                    </div>
                    <NumaBar free={n.freeVCpus} total={n.cpus} />
                </div>
            ))}
        </div>
    );
}

export default function Migration() {
    const { tick } = useDashboard();
    const [hosts, setHosts] = useState([]);
    const [instances, setInstances] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [sourceId, setSourceId] = useState(null);
    const [destId, setDestId] = useState(null);
    const [selectedVms, setSelectedVms] = useState(new Set());
    const [activeMigrations, setActiveMigrations] = useState([]);

    const load = async () => {
        try {
            setLoading(true);
            const [h, inst, hist] = await Promise.all([getHosts(), getInstances({ all_tenants: true }), getMigrationHistory()]);
            setHosts(h);
            setInstances(inst);
            setHistory(hist);
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [tick]);

    // Poll Masakari every 15s (independent of global tick)
    useEffect(() => {
        const id = setInterval(() => {
            getInstances({ all_tenants: true }).then(setInstances);
        }, 15000);
        return () => clearInterval(id);
    }, []);

    const source = hosts.find((h) => h.id === sourceId);
    const dest = hosts.find((h) => h.id === destId);
    const sourceVms = useMemo(() => (source ? source.vms : []), [source]);

    const fragmentedScore = source ? source.numa.length : 0;
    const masakariEvents = useMemo(
        () => instances.filter((i) => i.state === "ERROR" || i.state === "BUILDING"),
        [instances]
    );
    const showAlert = masakariEvents.length > 3;

    const startMigration = () => {
        if (!source || !dest || selectedVms.size === 0) {
            toast.error("Pick source, destination, and at least one VM");
            return;
        }
        const newMigs = Array.from(selectedVms).map((id) => {
            const vm = sourceVms.find((v) => v.id === id);
            return { id: `${id}-${Date.now()}`, vm: vm.name, from: source.hostname, to: dest.hostname, progress: 0, step: 1, status: "active" };
        });
        setActiveMigrations((prev) => [...newMigs, ...prev]);
        toast.success(`Started ${newMigs.length} migration(s)`);

        newMigs.forEach((m) => {
            let p = 0, s = 1;
            const interval = setInterval(() => {
                p += 12;
                if (p > 16 * s) s = Math.min(6, s + 1);
                setActiveMigrations((prev) =>
                    prev.map((x) => (x.id === m.id ? { ...x, progress: Math.min(p, 100), step: s } : x))
                );
                if (p >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        setActiveMigrations((prev) =>
                            prev.map((x) => (x.id === m.id ? { ...x, status: "complete", progress: 100, step: 6 } : x))
                        );
                        toast.success(`Migration complete: ${m.vm}`);
                    }, 200);
                }
            }, 600);
        });

        setSelectedVms(new Set());
    };

    const cancelMigration = (id) => {
        setActiveMigrations((prev) => prev.filter((m) => m.id !== id));
        toast.warning("Migration cancelled");
    };

    const stats = {
        runs: history.length,
        pockets: history.reduce((a, h) => a + (h.pocket_gained || 0), 0),
        vcpus: history.reduce((a, h) => a + (h.pocket_gained || 0) * 2, 0),
    };

    if (error) return <ErrorBanner message={error} onRetry={load} />;

    return (
        <div className="space-y-5 animate-fade-up">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Migration & Masakari</h1>
                <p className="text-[13px] text-muted-foreground mt-1 font-mono">Cross-host defragmentation, live migration, and Masakari failover · v2.3</p>
            </div>

            {showAlert && (
                <div data-testid="masakari-alert" className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 flex items-center gap-2 text-[13px] text-danger">
                    <ShieldAlert className="w-4 h-4" />
                    <strong>{masakariEvents.length} simultaneous Masakari events</strong> — cluster recovery may be degraded
                </div>
            )}

            {/* Defrag planner */}
            <section className="grid lg:grid-cols-2 gap-5">
                <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                    <h2 className="text-sm font-semibold">Source host (fragmented)</h2>
                    {loading ? <Skeleton className="h-32 bg-card-elev" /> : (
                        <div className="max-h-72 overflow-y-auto space-y-1">
                            {hosts.map((h) => (
                                <button
                                    key={h.id}
                                    onClick={() => setSourceId(h.id)}
                                    data-testid={`source-${h.id}`}
                                    className={`w-full text-left rounded-md p-2.5 border transition-colors ${
                                        sourceId === h.id ? "border-accent bg-accent-soft" : "border-border bg-card-elev/40 hover:bg-card-elev"
                                    }`}
                                >
                                    <div className="flex items-center justify-between text-[12px] font-mono">
                                        <span>{h.hostname.split(".")[0]}</span>
                                        <span className="text-muted-foreground">{h.freeVCpus} free · {h.numaNodes} numa</span>
                                    </div>
                                    <div className="h-1.5 mt-1.5 rounded-full bg-card-elev overflow-hidden">
                                        <div className="h-full bg-accent" style={{ width: `${(h.freeVCpus / h.totalCpus) * 100}%` }} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                    <h2 className="text-sm font-semibold">Destination host (best fit)</h2>
                    {loading ? <Skeleton className="h-32 bg-card-elev" /> : (
                        <div className="max-h-72 overflow-y-auto space-y-1">
                            {hosts.filter((h) => h.id !== sourceId && h.status === "Active").map((h) => (
                                <button
                                    key={h.id}
                                    onClick={() => setDestId(h.id)}
                                    data-testid={`dest-${h.id}`}
                                    className={`w-full text-left rounded-md p-2.5 border transition-colors ${
                                        destId === h.id ? "border-success bg-success/10" : "border-border bg-card-elev/40 hover:bg-card-elev"
                                    }`}
                                >
                                    <div className="flex items-center justify-between text-[12px] font-mono">
                                        <span>{h.hostname.split(".")[0]}</span>
                                        <span className="text-success">{h.freeVCpus} free</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Defrag simulator */}
            {source && dest && (
                <section className="rounded-lg border border-border bg-card p-5 space-y-4 animate-fade-up">
                    <h2 className="text-sm font-semibold">Defragmentation simulator</h2>
                    <div className="grid lg:grid-cols-3 gap-4 items-start">
                        <NumaState host={source} label="before · source" />
                        <div className="flex flex-col items-center justify-center gap-2 py-4">
                            <ArrowRight className="w-6 h-6 text-accent" />
                            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">migrate</span>
                        </div>
                        <NumaState
                            host={{
                                ...source,
                                hostname: source.hostname + " (after)",
                                numa: source.numa.map((n, i) => (i === 0 ? { ...n, freeVCpus: n.freeVCpus + 4 } : n)),
                            }}
                            label="after · pocket created!"
                        />
                    </div>

                    {/* Risk + VMs */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">VMs to migrate</div>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                                {sourceVms.slice(0, 12).map((v) => (
                                    <label key={v.id} className="flex items-center gap-2 text-[11px] font-mono px-2 py-1.5 rounded hover:bg-card-elev/50 cursor-pointer">
                                        <Checkbox
                                            data-testid={`vm-${v.id}`}
                                            checked={selectedVms.has(v.id)}
                                            onCheckedChange={() => {
                                                setSelectedVms((s) => {
                                                    const n = new Set(s);
                                                    n.has(v.id) ? n.delete(v.id) : n.add(v.id);
                                                    return n;
                                                });
                                            }}
                                        />
                                        <span className="flex-1">{v.name}</span>
                                        <span className="text-muted-foreground">{v.flavor}</span>
                                        <StatusBadge status={v.state} />
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Risk assessment</div>
                            <div className="rounded border border-border bg-card-elev/40 p-3 space-y-1.5">
                                <div className="flex items-center justify-between text-[12px] font-mono">
                                    <span>live migration risk</span>
                                    <span className="px-2 py-0.5 rounded bg-success/15 text-success border border-success/30 text-[10px] uppercase tracking-wider">low</span>
                                </div>
                                <div className="flex items-center justify-between text-[12px] font-mono">
                                    <span>est. downtime</span>
                                    <span>~ 280 ms</span>
                                </div>
                                <div className="flex items-center justify-between text-[12px] font-mono">
                                    <span>cascading risk</span>
                                    <span className="text-muted-foreground">none</span>
                                </div>
                            </div>
                            <Button data-testid="start-migration-btn" onClick={startMigration} disabled={selectedVms.size === 0} className="w-full bg-accent hover:bg-accent/90 text-white">
                                Start Migration ({selectedVms.size})
                            </Button>
                        </div>
                    </div>
                </section>
            )}

            {/* Active migrations */}
            {activeMigrations.length > 0 && (
                <section data-testid="active-migrations" className="rounded-lg border border-border bg-card p-5 space-y-3">
                    <h2 className="text-sm font-semibold">Active migrations</h2>
                    {activeMigrations.map((m) => (
                        <div key={m.id} className="rounded-md border border-border bg-card-elev/40 p-3">
                            <div className="flex items-center justify-between text-[12px] font-mono">
                                <span>{m.vm}</span>
                                <span className="text-muted-foreground">{m.from.split(".")[0]} → {m.to.split(".")[0]}</span>
                                {m.status === "active" ? (
                                    <button onClick={() => cancelMigration(m.id)} className="text-muted-foreground hover:text-danger"><X className="w-3.5 h-3.5" /></button>
                                ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                                )}
                            </div>
                            <div className="h-1.5 mt-2 rounded-full bg-card-elev overflow-hidden">
                                <div className={`h-full transition-all duration-500 ${m.status === "complete" ? "bg-success" : "bg-accent"}`} style={{ width: `${m.progress}%` }} />
                            </div>
                            <div className="flex justify-between mt-1.5 text-[10px] font-mono text-muted-foreground">
                                {["validate", "reserve", "migrate", "update", "release", "verify"].map((s, i) => (
                                    <span key={s} className={i + 1 <= m.step ? "text-accent" : ""}>{i + 1}. {s}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </section>
            )}

            {/* Masakari panel */}
            <section data-testid="masakari-panel" className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold flex items-center gap-2"><ShieldAlert className="w-3.5 h-3.5 text-warning" /> Masakari failover</h2>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning live-dot" /> 15s poll · {masakariEvents.length} events
                    </span>
                </div>
                {masakariEvents.length === 0 ? (
                    <div className="text-[12px] font-mono text-muted-foreground py-4 text-center">No active recoveries.</div>
                ) : (
                    <table className="w-full text-[12px] font-mono">
                        <thead className="text-muted-foreground">
                            <tr>
                                <th className="text-left py-2 px-3 font-normal">vm</th>
                                <th className="text-left py-2 px-3 font-normal">host</th>
                                <th className="text-left py-2 px-3 font-normal">failure reason</th>
                                <th className="text-left py-2 px-3 font-normal">recovery</th>
                            </tr>
                        </thead>
                        <tbody>
                            {masakariEvents.slice(0, 10).map((e) => (
                                <tr key={e.vm_uuid} className="border-t border-border">
                                    <td className="py-2 px-3">{e.name}</td>
                                    <td className="py-2 px-3">{e.host?.split(".")[0]}</td>
                                    <td className="py-2 px-3 text-muted-foreground">
                                        {e.state === "ERROR" ? "agent timeout" : "boot stalled"}
                                    </td>
                                    <td className="py-2 px-3">
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-warning/15 text-warning border border-warning/30">
                                            <span className="w-1 h-1 rounded-full bg-warning live-dot" /> recovering
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            {/* History */}
            <section data-testid="defrag-history" className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold">Defrag history</h3>
                    <div className="flex gap-4 text-[11px] font-mono text-muted-foreground">
                        <span>runs: <span className="text-foreground">{stats.runs}</span></span>
                        <span>pockets: <span className="text-success">{stats.pockets}</span></span>
                        <span>vCPUs freed: <span className="text-teal">{stats.vcpus}</span></span>
                    </div>
                </div>
                <table className="w-full text-[12px] font-mono">
                    <thead className="bg-card-elev text-muted-foreground">
                        <tr>
                            <th className="text-left py-2 px-3 font-normal">when</th>
                            <th className="text-left py-2 px-3 font-normal">from</th>
                            <th className="text-left py-2 px-3 font-normal">to</th>
                            <th className="text-left py-2 px-3 font-normal">vm</th>
                            <th className="text-right py-2 px-3 font-normal">pocket</th>
                            <th className="text-right py-2 px-3 font-normal">duration</th>
                            <th className="text-right py-2 px-3 font-normal">status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((m) => (
                            <tr key={m.id} className="border-t border-border">
                                <td className="py-2 px-3 text-muted-foreground">{m.ts}</td>
                                <td className="py-2 px-3">{m.from}</td>
                                <td className="py-2 px-3">{m.to}</td>
                                <td className="py-2 px-3">{m.vm}</td>
                                <td className="py-2 px-3 text-right text-success">+{m.pocket_gained}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{m.duration_ms}ms</td>
                                <td className="py-2 px-3 text-right">
                                    {m.status === "success" ? (
                                        <span className="text-success inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> success</span>
                                    ) : (
                                        <span className="text-danger inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> failed</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
