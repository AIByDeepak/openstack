import { useEffect, useState } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { useUiStore } from "@/store/uiStore";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, Search, Bell, Database } from "lucide-react";
import { getHealth, getHealthz, getReadyz } from "@/lib/api";

const COLOR = {
    ok: "bg-success",
    degraded: "bg-warning",
    down: "bg-danger",
};

function HealthDot({ name, status }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    data-testid={`health-${name}`}
                    className={`w-2 h-2 rounded-full ${COLOR[status] || COLOR.ok} ${status === "ok" ? "live-dot" : "animate-pulse"}`}
                />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-mono text-[11px] bg-card-elev border-border">
                /{name} · <span className={status === "ok" ? "text-success" : "text-warning"}>{status}</span>
            </TooltipContent>
        </Tooltip>
    );
}

export default function TopBar() {
    const { autoRefresh, setAutoRefresh, refresh, lastRefresh, version, env } = useDashboard();
    const isMockMode = useUiStore((s) => s.isMockMode);
    const [health, setHealth] = useState({ health: "ok", healthz: "ok", readyz: "ok" });
    const [spinning, setSpinning] = useState(false);
    const secondsAgo = Math.floor((Date.now() - lastRefresh.getTime()) / 1000);
    const [, setNow] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setNow((n) => n + 1), 5000);
        return () => clearInterval(id);
    }, []);
    const staleColor = secondsAgo > 120 ? "text-danger" : secondsAgo > 60 ? "text-warning" : "text-muted-foreground";

    useEffect(() => {
        let mounted = true;
        const ping = async () => {
            try {
                const [h, hz, rz] = await Promise.all([getHealth(), getHealthz(), getReadyz()]);
                if (!mounted) return;
                setHealth({
                    health: h.status === "ok" ? "ok" : "degraded",
                    healthz: hz.status === "ok" ? "ok" : "degraded",
                    readyz: rz.status === "ok" ? "ok" : "degraded",
                });
            } catch {
                if (mounted) setHealth({ health: "down", healthz: "down", readyz: "down" });
            }
        };
        ping();
        const id = setInterval(ping, 30_000);
        return () => { mounted = false; clearInterval(id); };
    }, []);

    const onManualRefresh = () => {
        setSpinning(true);
        refresh();
        setTimeout(() => setSpinning(false), 700);
    };

    return (
        <TooltipProvider delayDuration={120}>
            <header
                data-testid="app-topbar"
                className="sticky top-0 z-30 h-14 border-b border-border bg-background/80 backdrop-blur-md flex items-center px-6 gap-4"
            >
                <div className="flex items-center gap-2.5 mr-2 md:hidden">
                    <div className="w-7 h-7 rounded-md bg-accent" />
                    <span className="text-sm font-semibold">SS v2.0</span>
                </div>

                <div className="hidden md:flex items-center gap-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-border text-muted-foreground" data-testid="version-badge">
                        {version}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-warning/15 text-warning border border-warning/30" data-testid="env-badge">
                        {env}
                    </span>
                    {isMockMode && (
                        <span data-testid="mock-mode-badge" className="text-[10px] font-mono px-2 py-0.5 rounded bg-warning/20 text-warning border border-warning/40 inline-flex items-center gap-1">
                            <Database className="w-2.5 h-2.5" /> MOCK DATA
                        </span>
                    )}
                    <div className="ml-2 flex items-center gap-1.5 px-2 h-6 rounded border border-border bg-card" data-testid="health-dots">
                        <HealthDot name="health" status={health.health} />
                        <HealthDot name="healthz" status={health.healthz} />
                        <HealthDot name="readyz" status={health.readyz} />
                    </div>
                </div>

                <div className="flex-1 max-w-md hidden lg:flex items-center gap-2 px-3 h-9 rounded-md border border-border bg-card text-muted-foreground">
                    <Search className="w-4 h-4" />
                    <input
                        placeholder="Search hosts, flavors, VMs..."
                        className="bg-transparent flex-1 outline-none text-[13px] placeholder:text-muted-foreground"
                    />
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-card-elev border border-border">⌘K</kbd>
                </div>

                <div className="ml-auto flex items-center gap-3">
                    <div className="hidden md:flex items-center gap-2 text-[12px] text-muted-foreground">
                        <span className="font-mono">auto-refresh</span>
                        <Switch
                            data-testid="auto-refresh-toggle"
                            checked={autoRefresh}
                            onCheckedChange={setAutoRefresh}
                        />
                        <span className={`font-mono text-[11px] ${staleColor}`} data-testid="stale-badge">
                            {secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`}
                        </span>
                    </div>

                    <Button
                        data-testid="manual-refresh-btn"
                        onClick={onManualRefresh}
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2 bg-card border-border hover:bg-card-elev"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${spinning ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline text-[12px]">Refresh</span>
                    </Button>

                    <button
                        aria-label="notifications"
                        className="relative w-9 h-9 grid place-items-center rounded-md border border-border bg-card hover:bg-card-elev"
                    >
                        <Bell className="w-4 h-4 text-muted-foreground" />
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-danger" />
                    </button>
                </div>
            </header>
        </TooltipProvider>
    );
}
