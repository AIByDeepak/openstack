import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import StatusBadge from "./StatusBadge";
import { Cpu, Server, MemoryStick, Clock, Layers } from "lucide-react";

function MetaItem({ label, value, icon: Icon }) {
    return (
        <div className="rounded-md border border-border bg-card-elev/50 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {Icon && <Icon className="w-3 h-3" />} {label}
            </div>
            <div className="text-sm font-mono mt-1">{value}</div>
        </div>
    );
}

function CpuGrid({ host }) {
    const total = host.totalCpus;
    const cells = Array.from({ length: total }, (_, i) => {
        const isDedicated = i < host.dedicatedCpuCount;
        const used = isDedicated ? i < host.usedDedicated : i - host.dedicatedCpuCount < host.usedShared;
        let cls = "bg-card-elev border border-border";
        if (isDedicated && used) cls = "bg-accent border border-accent/60 shadow-[0_0_4px_hsl(var(--accent)/0.6)]";
        else if (isDedicated && !used) cls = "bg-accent/30 border border-accent/40";
        else if (!isDedicated && used) cls = "bg-teal border border-teal";
        else cls = "bg-teal/20 border border-teal/40";
        return <div key={i} title={`CPU ${i} ${isDedicated ? "dedicated" : "shared"} ${used ? "used" : "free"}`} className={`w-5 h-5 rounded-sm ${cls}`} />;
    });
    return <div className="flex flex-wrap gap-1">{cells}</div>;
}

export default function HostDrawer({ host, open, onOpenChange }) {
    if (!host) return null;
    const ramPct = Math.round((host.ramUsedGb / host.ramTotalGb) * 100);
    const cpuPct = Math.round(((host.usedDedicated + host.usedShared) / host.totalCpus) * 100);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                data-testid="host-drawer"
                side="right"
                className="w-full sm:max-w-2xl bg-background border-l border-border p-0 flex flex-col"
            >
                <SheetHeader className="px-6 pt-6 pb-4 border-b border-border space-y-2">
                    <div className="flex items-center justify-between gap-3">
                        <SheetTitle className="font-mono text-base text-foreground" data-testid="drawer-hostname">
                            {host.hostname}
                        </SheetTitle>
                        <StatusBadge status={host.status} />
                    </div>
                    <SheetDescription className="text-[12px] text-muted-foreground">
                        Pocket <span className="text-foreground font-mono">{host.pocket}</span> · Hypervisor{" "}
                        <span className="text-foreground font-mono">{host.hypervisor}</span>
                    </SheetDescription>
                </SheetHeader>

                <Tabs defaultValue="summary" className="flex-1 flex flex-col min-h-0">
                    <TabsList className="mx-6 mt-4 bg-card-elev border border-border w-fit">
                        <TabsTrigger data-testid="tab-summary" value="summary">Summary</TabsTrigger>
                        <TabsTrigger data-testid="tab-vms" value="vms">VMs ({host.vms.length})</TabsTrigger>
                        <TabsTrigger data-testid="tab-cpu" value="cpu">CPU Config</TabsTrigger>
                    </TabsList>

                    <ScrollArea className="flex-1">
                        <TabsContent value="summary" className="px-6 py-5 space-y-5">
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                <MetaItem label="NUMA Nodes" value={host.numaNodes} icon={Layers} />
                                <MetaItem label="Sockets" value={host.sockets} icon={Server} />
                                <MetaItem label="Cores / Socket" value={host.coresPerSocket} icon={Cpu} />
                                <MetaItem label="Total vCPUs" value={host.totalCpus} icon={Cpu} />
                                <MetaItem label="RAM" value={`${host.ramTotalGb} GB`} icon={MemoryStick} />
                                <MetaItem label="Uptime" value={`${host.uptimeDays} days`} icon={Clock} />
                            </div>

                            <div className="space-y-3">
                                <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">CPU Usage · {cpuPct}%</div>
                                <div className="h-2 rounded-full bg-card-elev overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-accent to-teal transition-all"
                                        style={{ width: `${cpuPct}%` }}
                                    />
                                </div>
                                <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-3">RAM Usage · {ramPct}%</div>
                                <div className="h-2 rounded-full bg-card-elev overflow-hidden">
                                    <div
                                        className={`h-full transition-all ${ramPct > 85 ? "bg-danger" : ramPct > 70 ? "bg-warning" : "bg-success"}`}
                                        style={{ width: `${ramPct}%` }}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">NUMA Topology</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {host.numa.map((n) => (
                                        <div key={n.id} className="rounded-md border border-border bg-card-elev/40 p-3">
                                            <div className="flex items-center justify-between text-[12px]">
                                                <span className="font-mono">node {n.id}</span>
                                                <span className="text-muted-foreground">{n.cpus} CPUs</span>
                                            </div>
                                            <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5 font-mono">
                                                <div>free vCPUs: <span className="text-success">{n.freeVCpus}</span></div>
                                                <div>free RAM: <span className="text-success">{n.freeRam} GB</span></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="vms" className="px-6 py-5">
                            {host.vms.length === 0 ? (
                                <div className="text-center text-[13px] text-muted-foreground py-12">No VMs running on this host.</div>
                            ) : (
                                <div className="rounded-md border border-border overflow-hidden">
                                    <table className="w-full text-[12px]">
                                        <thead className="bg-card-elev text-muted-foreground">
                                            <tr>
                                                <th className="text-left font-mono font-normal px-3 py-2">name</th>
                                                <th className="text-left font-mono font-normal px-3 py-2">flavor</th>
                                                <th className="text-left font-mono font-normal px-3 py-2">state</th>
                                                <th className="text-right font-mono font-normal px-3 py-2">vCPUs</th>
                                                <th className="text-right font-mono font-normal px-3 py-2">RAM</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {host.vms.map((vm) => (
                                                <tr key={vm.id} className="border-t border-border hover:bg-card-elev/50">
                                                    <td className="px-3 py-2 font-mono">{vm.name}</td>
                                                    <td className="px-3 py-2 font-mono text-muted-foreground">{vm.flavor}</td>
                                                    <td className="px-3 py-2"><StatusBadge status={vm.state} /></td>
                                                    <td className="px-3 py-2 text-right font-mono">{vm.vcpus}</td>
                                                    <td className="px-3 py-2 text-right font-mono">{vm.ram} GB</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="cpu" className="px-6 py-5 space-y-5">
                            <div>
                                <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3">Visual CPU Map · {host.totalCpus} cores</div>
                                <CpuGrid host={host} />
                                <div className="flex items-center gap-4 mt-3 text-[10px] font-mono text-muted-foreground">
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent" /> dedicated · used</span>
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent/30" /> dedicated · free</span>
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal" /> shared · used</span>
                                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal/20 border border-teal/40" /> shared · free</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div>
                                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">cpuset · dedicated</div>
                                    <code className="block mt-1 font-mono text-[12px] bg-card-elev border border-border rounded px-3 py-2 text-accent">
                                        {host.cpusetDedicated}
                                    </code>
                                </div>
                                <div>
                                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">cpuset · shared</div>
                                    <code className="block mt-1 font-mono text-[12px] bg-card-elev border border-border rounded px-3 py-2 text-teal">
                                        {host.cpusetShared}
                                    </code>
                                </div>
                            </div>
                        </TabsContent>
                    </ScrollArea>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}
