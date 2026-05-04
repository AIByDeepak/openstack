import { useEffect, useState, useRef } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { getPockets } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorBanner from "@/components/ErrorBanner";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, Boxes } from "lucide-react";

const COLORS = ["hsl(var(--accent))", "hsl(var(--teal))", "hsl(var(--warning))"];

function PocketCard({ pocket }) {
    return (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md grid place-items-center bg-accent-soft border border-accent/30">
                        <Boxes className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                        <div className="font-mono text-base">{pocket.name}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">{pocket.hosts} hosts · {pocket.utilization}% utilised</div>
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
                    <span><span className="text-success text-base mr-1">{pocket.freeVCpus}</span> free vCPUs</span>
                    <span><span className="text-success text-base mr-1">{pocket.freeRamGb}</span> GB free RAM</span>
                </div>
            </div>

            <div className="grid md:grid-cols-2">
                <div className="p-6 border-r border-border">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3">NUMA breakdown</div>
                    <div className="h-[220px]">
                        <ResponsiveContainer>
                            <BarChart data={pocket.numa} margin={{ left: -10 }}>
                                <XAxis dataKey="node" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} stroke="hsl(var(--border))" />
                                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--border))" />
                                <Tooltip cursor={{ fill: "hsl(var(--card-elev))" }} contentStyle={{ background: "hsl(var(--card-elev))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
                                <Bar dataKey="free" name="free vCPUs" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="ram" name="free RAM (GB)" fill="hsl(var(--teal))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="p-6">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3">category split</div>
                    <div className="h-[220px]">
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie data={pocket.category} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={4} stroke="hsl(var(--bg))" strokeWidth={2}>
                                    {pocket.category.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: "hsl(var(--card-elev))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-2 text-[10px] font-mono text-muted-foreground">
                        {pocket.category.map((c, i) => (
                            <span key={c.name} className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm" style={{ background: COLORS[i] }} />{c.name}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Pockets() {
    const { tick } = useDashboard();
    const [pockets, setPockets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [active, setActive] = useState(0);
    const intervalRef = useRef(null);

    const load = async () => {
        try { setLoading(true); setPockets(await getPockets()); setError(null); }
        catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, [tick]);

    useEffect(() => {
        if (pockets.length === 0) return;
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => setActive((a) => (a + 1) % pockets.length), 8000);
        return () => clearInterval(intervalRef.current);
    }, [pockets.length, active]);

    if (error) return <ErrorBanner message={error} onRetry={load} />;
    if (loading) return <Skeleton className="h-[480px] bg-card" />;
    if (pockets.length === 0) return <div className="text-muted-foreground">No pockets configured.</div>;

    const go = (dir) => setActive((a) => (a + dir + pockets.length) % pockets.length);

    return (
        <div className="space-y-5 animate-fade-up">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">NUMA Pockets</h1>
                    <p className="text-[13px] text-muted-foreground mt-1 font-mono">Resource allocation grouped by aggregate · auto-rotates every 8s</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button data-testid="pocket-prev" variant="outline" size="icon" className="h-9 w-9 bg-card border-border" onClick={() => go(-1)}><ChevronLeft className="w-4 h-4" /></Button>
                    <span className="font-mono text-[12px] text-muted-foreground tabular-nums">{active + 1} / {pockets.length}</span>
                    <Button data-testid="pocket-next" variant="outline" size="icon" className="h-9 w-9 bg-card border-border" onClick={() => go(1)}><ChevronRight className="w-4 h-4" /></Button>
                </div>
            </div>

            <div data-testid="pocket-carousel" className="overflow-hidden rounded-lg">
                <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${active * 100}%)` }}>
                    {pockets.map((p) => (
                        <div key={p.id} className="w-full shrink-0 px-px">
                            <PocketCard pocket={p} />
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-center gap-2">
                {pockets.map((_, i) => (
                    <button
                        key={i}
                        data-testid={`pocket-dot-${i}`}
                        onClick={() => setActive(i)}
                        className={`h-1.5 rounded-full transition-all ${i === active ? "w-8 bg-accent" : "w-1.5 bg-border-strong hover:bg-muted-foreground"}`}
                    />
                ))}
            </div>
        </div>
    );
}
