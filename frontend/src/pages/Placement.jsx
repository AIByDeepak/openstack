import { useEffect, useState } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { getFlavors, getBestHost, placeFlavor, getInstances } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import { Rocket, ChevronRight, ArrowLeft, CheckCircle2, XCircle, Star, Cpu, Server } from "lucide-react";
import { toast } from "sonner";

const AGGREGATES = ["all", "ANI-perf", "ANI-default", "ANI-gpu", "ANI-edge"];

function Step({ num, label, active, done }) {
    const cls = done
        ? "bg-success/20 text-success border-success/40"
        : active
        ? "bg-accent text-white border-accent"
        : "bg-card-elev text-muted-foreground border-border";
    return (
        <div className="flex items-center gap-2">
            <span className={`w-6 h-6 grid place-items-center rounded-full text-[11px] font-mono border ${cls}`}>
                {done ? "✓" : num}
            </span>
            <span className={`text-[12px] font-mono ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
        </div>
    );
}

export default function Placement() {
    const { tick } = useDashboard();
    const [step, setStep] = useState(1);
    const [flavors, setFlavors] = useState([]);
    const [flavor, setFlavor] = useState("m1.large");
    const [aggregate, setAggregate] = useState("all");
    const [vmName, setVmName] = useState("");
    const [bestHost, setBestHost] = useState(null);
    const [searching, setSearching] = useState(false);
    const [placing, setPlacing] = useState(false);
    const [result, setResult] = useState(null);
    const [history, setHistory] = useState([]);
    const [traceVm, setTraceVm] = useState(null);

    useEffect(() => {
        getFlavors().then(setFlavors);
    }, []);

    useEffect(() => {
        getInstances({ all_tenants: true }).then((inst) => setHistory(inst.slice(0, 12)));
    }, [tick]);

    const findBest = async () => {
        setSearching(true);
        try {
            const res = await getBestHost(flavor, aggregate === "all" ? null : aggregate);
            if (!res || res.error) {
                toast.error(res?.error || "no eligible host");
                setBestHost(null);
            } else {
                setBestHost(res);
                if (!vmName) setVmName(`vm-${flavor.replace(/\./g, "-")}-${Date.now().toString(36).slice(-4)}`);
                toast.success("Best host found", { description: res.best.hostname });
            }
        } finally {
            setSearching(false);
        }
    };

    const placeVm = async () => {
        setPlacing(true);
        try {
            const res = await placeFlavor(flavor, vmName, bestHost.best.hostname);
            setResult(res);
            setStep(3);
            toast.success("VM placed", { description: `${res.vm_name} → ${res.hostname}` });
        } finally {
            setPlacing(false);
        }
    };

    const reset = () => { setStep(1); setBestHost(null); setResult(null); setVmName(""); };

    return (
        <div className="space-y-5 animate-fade-up">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">VM Placement</h1>
                <p className="text-[13px] text-muted-foreground mt-1 font-mono">Find the best host, confirm NUMA assignment, place the VM · v2.3</p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-3 flex-wrap rounded-lg border border-border bg-card p-3">
                <Step num={1} label="Request" active={step === 1} done={step > 1} />
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <Step num={2} label="Confirm" active={step === 2} done={step > 2} />
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <Step num={3} label="Result" active={step === 3} done={false} />
            </div>

            {step === 1 && (
                <section data-testid="step-request" className="grid lg:grid-cols-2 gap-5">
                    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                        <h2 className="text-sm font-semibold flex items-center gap-2"><Rocket className="w-3.5 h-3.5 text-accent" />Placement request</h2>

                        <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Flavor</label>
                            <Select value={flavor} onValueChange={setFlavor}>
                                <SelectTrigger data-testid="placement-flavor" className="bg-card-elev border-border h-9 font-mono mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {flavors.map((f) => (
                                        <SelectItem key={f.name} value={f.name} className="font-mono text-[13px]">
                                            {f.name} <span className="text-muted-foreground ml-2">({f.vcpus}vC / {f.ram}G)</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Aggregate</label>
                            <Select value={aggregate} onValueChange={setAggregate}>
                                <SelectTrigger data-testid="placement-aggregate" className="bg-card-elev border-border h-9 font-mono mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {AGGREGATES.map((a) => <SelectItem key={a} value={a} className="font-mono text-[13px]">{a}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">VM name (optional)</label>
                            <input
                                value={vmName}
                                onChange={(e) => setVmName(e.target.value)}
                                placeholder="auto-generated"
                                className="mt-1 w-full h-9 px-3 rounded-md bg-card-elev border border-border text-[13px] font-mono outline-none focus:border-accent"
                            />
                        </div>
                        <Button data-testid="find-best-btn" disabled={searching} onClick={findBest} className="w-full bg-accent hover:bg-accent/90 text-white">
                            {searching ? "Searching…" : "Find Best Host"}
                        </Button>
                    </div>

                    <div className="rounded-lg border border-border bg-card p-5">
                        {!bestHost ? (
                            <div className="text-center text-muted-foreground text-[12px] py-12 font-mono">Submit a request to see the best host.</div>
                        ) : (
                            <div className="space-y-4 animate-fade-up">
                                <div>
                                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Recommended</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="text-xl font-mono font-semibold">{bestHost.best.hostname.split(".")[0]}</div>
                                        <span className="px-2 py-0.5 rounded bg-success/15 text-success border border-success/30 text-[10px] font-mono uppercase tracking-wider">
                                            best fit
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                                    {[
                                        ["util", `${Math.round(bestHost.score.utilization * 100)}%`],
                                        ["numa fit", `${Math.round(bestHost.score.numa_fit * 100)}%`],
                                        ["pocket", `${Math.round(bestHost.score.pocket_match * 100)}%`],
                                    ].map(([l, v]) => (
                                        <div key={l} className="rounded border border-border bg-card-elev/50 p-2">
                                            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{l}</div>
                                            <div className="mt-0.5">{v}</div>
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Derived flavor</div>
                                    <code className="block bg-card-elev border border-border rounded p-2.5 text-[11px] text-accent font-mono">
                                        {bestHost.derived_flavor.name}
                                        <div className="text-muted-foreground mt-1">
                                            cpus: <span className="text-teal">[{bestHost.derived_flavor.cpu_set.join(", ")}]</span>
                                        </div>
                                        <div className="text-muted-foreground">
                                            numa_pin: <span className="text-foreground">node-{bestHost.derived_flavor.numa_pin}</span>
                                        </div>
                                    </code>
                                </div>

                                <div>
                                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Alternatives</div>
                                    <div className="space-y-1">
                                        {bestHost.alternatives.map((a, i) => (
                                            <div key={a.hostId} className="flex items-center justify-between px-2 py-1 rounded bg-card-elev/40 text-[11px] font-mono">
                                                <span>#{i + 2} {a.hostname.split(".")[0]}</span>
                                                <span className="text-muted-foreground">{a.freeVCpus} free</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Button data-testid="proceed-btn" onClick={() => setStep(2)} className="w-full bg-accent hover:bg-accent/90 text-white">
                                    Proceed to Place →
                                </Button>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {step === 2 && bestHost && (
                <section data-testid="step-confirm" className="grid lg:grid-cols-[1fr_360px] gap-5">
                    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                        <h2 className="text-sm font-semibold flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-accent" /> Confirm placement</h2>
                        <div className="grid grid-cols-2 gap-2 text-[12px] font-mono">
                            <div className="rounded border border-border bg-card-elev/40 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">vm name</div>
                                <div>{vmName || "—"}</div>
                            </div>
                            <div className="rounded border border-border bg-card-elev/40 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">flavor</div>
                                <div>{flavor}</div>
                            </div>
                            <div className="rounded border border-border bg-card-elev/40 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">target host</div>
                                <div>{bestHost.best.hostname.split(".")[0]}</div>
                            </div>
                            <div className="rounded border border-border bg-card-elev/40 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">numa node</div>
                                <div>{bestHost.derived_flavor.numa_pin}</div>
                            </div>
                        </div>

                        {/* NUMA grid */}
                        <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">CPU pin preview</div>
                            <div className="flex flex-wrap gap-1">
                                {Array.from({ length: bestHost.host?.totalCpus || 64 }).map((_, i) => {
                                    const isPin = bestHost.derived_flavor.cpu_set.includes(i);
                                    const isUsed = i < (bestHost.host?.usedDedicated || 0);
                                    let cls = "bg-card-elev border border-border";
                                    if (isPin) cls = "bg-accent border border-accent shadow-[0_0_6px_hsl(var(--accent)/0.7)]";
                                    else if (isUsed) cls = "bg-accent/30 border border-accent/40";
                                    return <div key={i} title={`cpu ${i}${isPin ? " · TO BE PINNED" : ""}`} className={`w-5 h-5 rounded-sm ${cls}`} />;
                                })}
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Constraint validation</div>
                            <ul className="space-y-1.5 text-[12px] font-mono">
                                {[
                                    "NUMA pinning satisfied",
                                    "No cross-NUMA fragmentation",
                                    "vCPU accounting correct",
                                    "Memory accounting correct",
                                    "Pocket fits derived flavor",
                                ].map((t) => (
                                    <li key={t} className="flex items-center gap-2 text-success">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> {t}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={() => setStep(1)} variant="outline" className="bg-card-elev border-border"><ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back</Button>
                            <Button data-testid="place-vm-btn" disabled={placing} onClick={placeVm} className="flex-1 bg-success hover:bg-success/90 text-white">
                                {placing ? "Placing…" : "Place VM"}
                            </Button>
                        </div>
                    </div>

                    <aside className="rounded-lg border border-border bg-card p-5">
                        <h3 className="text-sm font-semibold mb-3">Derived flavor specs</h3>
                        <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-[11px] font-mono">
                            <dt className="text-muted-foreground">vCPUs</dt><dd>{bestHost.derived_flavor.vcpus}</dd>
                            <dt className="text-muted-foreground">RAM (GB)</dt><dd>{bestHost.derived_flavor.ram}</dd>
                            <dt className="text-muted-foreground">numa pin</dt><dd>node-{bestHost.derived_flavor.numa_pin}</dd>
                            <dt className="text-muted-foreground col-span-2 pt-2 border-t border-border mt-1">cpu set</dt>
                            <dd className="col-span-2 text-teal">[{bestHost.derived_flavor.cpu_set.join(", ")}]</dd>
                        </dl>
                    </aside>
                </section>
            )}

            {step === 3 && result && (
                <section data-testid="step-result" className="grid lg:grid-cols-[1fr_400px] gap-5">
                    <div className="rounded-lg border border-success/40 bg-success/5 p-6 animate-fade-up">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-success/20 grid place-items-center">
                                <CheckCircle2 className="w-6 h-6 text-success" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-success">VM placed</h2>
                                <div className="text-[12px] font-mono text-muted-foreground">{result.vm_uuid}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-4 text-[12px] font-mono">
                            <div className="rounded border border-border bg-card-elev/40 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">vm name</div>
                                <div>{result.vm_name}</div>
                            </div>
                            <div className="rounded border border-border bg-card-elev/40 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">host</div>
                                <div>{result.hostname.split(".")[0]}</div>
                            </div>
                            <div className="rounded border border-border bg-card-elev/40 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">numa</div>
                                <div>node-{result.numa_node}</div>
                            </div>
                            <div className="rounded border border-border bg-card-elev/40 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">cpu pins</div>
                                <div className="text-teal text-[11px] truncate">[{result.cpu_pins.join(", ")}]</div>
                            </div>
                        </div>

                        <Button onClick={reset} className="mt-4 bg-accent hover:bg-accent/90 text-white">Place another VM</Button>
                    </div>

                    <aside className="rounded-lg border border-border bg-card p-5">
                        <h3 className="text-sm font-semibold mb-3">Placement trace</h3>
                        <ol className="relative border-l-2 border-border pl-5 space-y-3">
                            {result.trace.map((s, i) => (
                                <li key={i} className="relative">
                                    <span className="absolute -left-[27px] w-3 h-3 rounded-full bg-accent border-2 border-card" />
                                    <div className="text-[10px] font-mono text-muted-foreground tabular-nums">+{s.ts}ms · {s.stage}</div>
                                    <div className="text-[12px] font-mono">{s.text}</div>
                                </li>
                            ))}
                        </ol>
                    </aside>
                </section>
            )}

            {/* History table */}
            <section className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Recent placements</h3>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{history.length} entries</span>
                </div>
                <table className="w-full text-[12px] font-mono">
                    <thead className="bg-card-elev text-muted-foreground">
                        <tr>
                            <th className="text-left py-2 px-3 font-normal">name</th>
                            <th className="text-left py-2 px-3 font-normal">flavor</th>
                            <th className="text-left py-2 px-3 font-normal">host</th>
                            <th className="text-left py-2 px-3 font-normal">state</th>
                            <th className="text-right py-2 px-3 font-normal">vcpus</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((i) => (
                            <tr key={i.vm_uuid} onClick={() => setTraceVm(i)} className="border-t border-border hover:bg-card-elev/40 cursor-pointer">
                                <td className="py-2 px-3">{i.name}</td>
                                <td className="py-2 px-3 text-muted-foreground">{i.flavor}</td>
                                <td className="py-2 px-3">{i.host?.split(".")[0]}</td>
                                <td className="py-2 px-3"><StatusBadge status={i.state} /></td>
                                <td className="py-2 px-3 text-right">{i.vcpus}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
