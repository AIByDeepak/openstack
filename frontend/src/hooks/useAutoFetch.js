import { useState, useEffect, useRef, useCallback } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { toast } from "sonner";

// Auto-fetch helper. Default 10 minutes per spec. Supports manual refresh,
// pause when document hidden, and toast only when visible.
export function useAutoFetch(fetchFn, intervalMs = 600_000, opts = {}) {
    const { silent = false, key = "" } = opts;
    const [state, setState] = useState({ data: null, loading: true, error: null, isMock: false, lastUpdated: null });
    const timerRef = useRef(null);
    const dashTick = useDashboard().tick;

    const run = useCallback(async () => {
        try {
            const result = await fetchFn();
            // Support both {data,isMock} and bare-data return shapes.
            const data = result && typeof result === "object" && "data" in result ? result.data : result;
            const isMock = result && typeof result === "object" && "isMock" in result ? result.isMock : false;
            setState({ data, isMock, error: null, loading: false, lastUpdated: new Date() });
            if (!silent && document.visibilityState === "visible") {
                // tiny toast on auto-refresh — only when tab visible
                if (key) toast.success(`Refreshed: ${key}`, { duration: 1200 });
            }
        } catch (e) {
            setState((s) => ({ ...s, error: e.message, loading: false }));
        }
    }, [fetchFn, silent, key]);

    useEffect(() => {
        run();
        if (intervalMs > 0) {
            timerRef.current = setInterval(run, intervalMs);
        }
        return () => clearInterval(timerRef.current);
    }, [run, intervalMs]);

    // Manual refresh from top bar triggers re-run via DashboardContext.tick
    useEffect(() => {
        if (dashTick > 0) run();
        // eslint-disable-next-line
    }, [dashTick]);

    return { ...state, refresh: run };
}
