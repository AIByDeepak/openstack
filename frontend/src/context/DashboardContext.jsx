import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";

const Ctx = createContext(null);

export function DashboardProvider({ children }) {
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [tick, setTick] = useState(0);
    const [lastRefresh, setLastRefresh] = useState(new Date());

    const refresh = useCallback((silent = false) => {
        setTick((t) => t + 1);
        setLastRefresh(new Date());
        if (!silent) toast.success("Data refreshed", { description: new Date().toLocaleTimeString() });
    }, []);

    useEffect(() => {
        if (!autoRefresh) return;
        const id = setInterval(() => {
            setTick((t) => t + 1);
            setLastRefresh(new Date());
        }, 600000);
        return () => clearInterval(id);
    }, [autoRefresh]);

    const value = useMemo(
        () => ({ autoRefresh, setAutoRefresh, tick, refresh, lastRefresh, version: "v0.2.1", env: "ani_staging" }),
        [autoRefresh, tick, refresh, lastRefresh]
    );

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboard() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
    return ctx;
}
