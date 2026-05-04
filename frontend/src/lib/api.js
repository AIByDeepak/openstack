// Live-first fetcher with mock fallback.
// Every public function tries the real backend at API_BASE and falls back
// to the in-memory mock fixture on any failure (network, timeout, non-2xx).
// When fallback fires, useUiStore.isMockMode is flipped on.

import {
    HOSTS,
    POCKETS_DATA,
    FLAVORS,
    evaluateFlavor,
    clusterStats,
    ACTIVITY_LOG,
    SYSTEM_INFO,
    metricsSeries,
    clusterNumaCapacityReport,
    INSTANCES_ALL,
    MIGRATION_HISTORY,
    PROMETHEUS_TEXT,
} from "./mockData";
import { useUiStore } from "@/store/uiStore";

const API_BASE = "http://10.232.80.241:31597";
const TIMEOUT_MS = 2000;
// If we're served over https, browsers will block http requests as mixed
// content. Detect once at module load and skip live attempts entirely so we
// don't pay 2s per call only to fall back.
const SKIP_LIVE =
    typeof window !== "undefined" && window.location.protocol === "https:" && API_BASE.startsWith("http://");

let mockHits = 0;
let liveHits = 0;

function syncMockFlag() {
    useUiStore.getState().setMockMode(mockHits > 0 && liveHits === 0);
}

async function tryLive(path, opts = {}) {
    if (SKIP_LIVE) {
        // Pretend we tried — flip to mock mode and bubble.
        mockHits++;
        syncMockFlag();
        throw new Error("mixed-content blocked; using mocks");
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal, ...opts });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        liveHits++;
        useUiStore.getState().setMockMode(false);
        useUiStore.getState().setEndpointError(null);
        return json;
    } catch (e) {
        clearTimeout(timer);
        mockHits++;
        useUiStore.getState().setEndpointError({ path, error: e.message });
        syncMockFlag();
        throw e;
    }
}

const fakeDelay = (ms) => new Promise((r) => setTimeout(r, ms));

async function liveOrMock(path, mockFn, ms = 180) {
    try {
        return await tryLive(path);
    } catch {
        await fakeDelay(ms);
        return mockFn();
    }
}

// ───────────── public API ─────────────

export const getInfo = () => liveOrMock("/info", () => SYSTEM_INFO, 80);
export const getMetrics = () => liveOrMock("/metrics", () => metricsSeries(), 180);
export const getMetricsRaw = () => liveOrMock("/metrics", () => PROMETHEUS_TEXT, 180);

export const getHealth = () => liveOrMock("/health", () => ({ status: pickHealth(0) }), 60);
export const getHealthz = () => liveOrMock("/healthz", () => ({ status: pickHealth(1) }), 60);
export const getReadyz = () => liveOrMock("/readyz", () => ({ status: pickHealth(2) }), 60);

export const getHosts = (aggregate) =>
    liveOrMock(aggregate ? `/hosts?aggregate=${aggregate}` : "/hosts", () =>
        aggregate ? HOSTS.filter((h) => h.aggregate === aggregate) : HOSTS
    );
export const getHostsList = (aggregate) =>
    liveOrMock(aggregate ? `/hosts/list?aggregate=${aggregate}` : "/hosts/list", () =>
        HOSTS.map((h) => ({ hostname: h.hostname, aggregate: h.aggregate, status: h.status })).filter(
            (h) => !aggregate || h.aggregate === aggregate
        )
    );

export const getAgentStatus = () =>
    liveOrMock("/hosts/agent-status", () =>
        HOSTS.map((h) => ({
            hostname: h.hostname,
            agent_status: h.agentStatus,
            last_seen: h.agentLastSeen,
            agent_version: h.agentVersion,
        }))
    );

export const getNumaTopology = (h) =>
    liveOrMock(`/hosts/numa-topology/${h}`, () => {
        const host = HOSTS.find((x) => x.hostname === h);
        return host ? { hostname: h, numa_nodes: host.numa, sockets: host.sockets, cores_per_socket: host.coresPerSocket } : null;
    });

export const getHostVms = (h) =>
    liveOrMock(`/hosts/${h}/vms`, () => HOSTS.find((x) => x.hostname === h)?.vms ?? []);

export const getVmCapacity = (h, vcpu, ram_gb, flavor) => {
    const qs = new URLSearchParams({ vcpu, ram_gb, ...(flavor ? { flavor } : {}) });
    return liveOrMock(`/hosts/vm-capacity/${h}?${qs}`, () => {
        const host = HOSTS.find((x) => x.hostname === h);
        if (!host) return null;
        return {
            hostname: h,
            requested: { vcpu: +vcpu, ram_gb: +ram_gb, flavor },
            capacity: {
                fits: host.freeVCpus >= vcpu && host.ramTotalGb - host.ramUsedGb >= ram_gb,
                free_vcpus: host.freeVCpus,
                free_ram_gb: host.ramTotalGb - host.ramUsedGb,
            },
            numa: host.numa,
        };
    });
};

export const getPockets = (host) =>
    liveOrMock(host ? `/pockets?host=${host}` : "/pockets", () =>
        host ? POCKETS_DATA.filter((p) => p.name === host) : POCKETS_DATA
    );

export const getCpuConfig = () =>
    liveOrMock("/hosts/cpu-config", () =>
        HOSTS.map((h) => ({
            id: h.id,
            hostname: h.hostname,
            status: h.status,
            dedicatedCpus: h.dedicatedCpus,
            sharedCpus: h.sharedCpus,
            usedDedicated: h.usedDedicated,
            usedShared: h.usedShared,
            cpusetDedicated: h.cpusetDedicated,
            cpusetShared: h.cpusetShared,
        }))
    );

export const getCpuPins = (host) =>
    liveOrMock(host ? `/hosts/cpu-pins?host_name=${host}` : "/hosts/cpu-pins", () =>
        HOSTS.map((h) => ({
            hostname: h.hostname,
            pinned: h.dedicatedCpus.slice(0, h.usedDedicated),
            unpinned: h.sharedCpus,
        })).filter((h) => !host || h.hostname === host)
    );

export const getFlavors = () => liveOrMock("/flavors", () => FLAVORS, 100);

export const getFlavorVisibility = (flavor, aggregate) => {
    const path = `/hosts/cluster/flavor-visibility?flavor=${flavor}${aggregate ? `&aggregate=${aggregate}` : ""}`;
    return liveOrMock(path, () => {
        const f = FLAVORS.find((x) => x.name === flavor) || FLAVORS[0];
        let results = evaluateFlavor(f);
        if (aggregate) results = results.filter((r) => r.aggregate === aggregate);
        return { flavor: f, results };
    });
};

export const getVisibilityList = () =>
    liveOrMock("/hosts/visibility", () => {
        const f = FLAVORS[2]; // m1.large default
        return evaluateFlavor(f);
    });

export const getVisibilityHost = (host, flavor) =>
    liveOrMock(`/hosts/visibility/${host}${flavor ? `?flavor=${flavor}` : ""}`, () => {
        const f = FLAVORS.find((x) => x.name === flavor) || FLAVORS[2];
        const all = evaluateFlavor(f);
        return all.find((r) => r.hostname === host);
    });

export const getOverview = () =>
    liveOrMock("/overview", () => ({ stats: clusterStats(), activity: ACTIVITY_LOG }));

export const quickPlacementCheck = (flavor) =>
    liveOrMock(`/hosts/placement-check?flavor=${flavor}`, () => {
        const f = FLAVORS.find((x) => x.name === flavor);
        if (!f) throw new Error(`Unknown flavor "${flavor}"`);
        return { flavor: f, results: evaluateFlavor(f) };
    });

export const getClusterNumaCapacityReport = () =>
    liveOrMock("/hosts/cluster-numa-capacity-report", clusterNumaCapacityReport);

export const getBestHost = (flavor, aggregate, vcpus, ram_mb) => {
    const qs = flavor
        ? `?flavor=${flavor}${aggregate ? `&aggregate=${aggregate}` : ""}`
        : `?vcpus=${vcpus}&ram_mb=${ram_mb}${aggregate ? `&aggregate=${aggregate}` : ""}`;
    return liveOrMock(`/hosts/best-host${qs}`, () => {
        const f = flavor
            ? FLAVORS.find((x) => x.name === flavor)
            : { name: "manual", vcpus, ram: ram_mb / 1024 };
        if (!f) return null;
        const ranked = evaluateFlavor(f)
            .filter((r) => r.canPlace)
            .filter((r) => !aggregate || r.aggregate === aggregate)
            .sort((a, b) => b.freeVCpus - a.freeVCpus);
        const winner = ranked[0];
        if (!winner) return { error: "no eligible host" };
        const winningHost = HOSTS.find((h) => h.hostname === winner.hostname);
        return {
            best: winner,
            host: winningHost,
            score: { utilization: 0.62, numa_fit: 0.95, pocket_match: 0.88, total: 0.83 },
            alternatives: ranked.slice(1, 6),
            derived_flavor: {
                name: `df-${(f.name || "manual").replace(/[.\s]/g, "-")}-${winner.hostname.split("-")[1]}`,
                vcpus: f.vcpus,
                ram: f.ram,
                numa_pin: 0,
                cpu_set: winningHost ? winningHost.dedicatedCpus.slice(winningHost.usedDedicated, winningHost.usedDedicated + f.vcpus) : [],
            },
        };
    });
};

export const getFlavorPlacement = (flavor) =>
    liveOrMock(`/flavors/${flavor}/placement`, () => quickPlacementCheck(flavor));

// Phase 2 placement execution (mocked)
export const placeFlavor = (flavor, vmName, hostname) =>
    liveOrMock(`/hosts/flavor-placement?flavor=${flavor}`, () => {
        const f = FLAVORS.find((x) => x.name === flavor);
        const host = HOSTS.find((h) => h.hostname === hostname);
        return {
            success: true,
            vm_uuid: `${Date.now().toString(16)}-aaaa-bbbb-cccc-dddddddddddd`,
            vm_name: vmName,
            flavor: f?.name,
            hostname,
            numa_node: 0,
            cpu_pins: host?.dedicatedCpus.slice(host.usedDedicated, host.usedDedicated + (f?.vcpus || 4)) ?? [],
            placed_at: new Date().toISOString(),
            trace: makeTrace(flavor, hostname),
        };
    });

function makeTrace(flavor, hostname) {
    return [
        { ts: 0, stage: "received", text: `Received flavor ${flavor}` },
        { ts: 4, stage: "filter:status", text: `Evaluated ${HOSTS.length} hosts; ${HOSTS.filter((h) => h.status === "Active").length} active` },
        { ts: 9, stage: "filter:capacity", text: `Filtered to ${HOSTS.filter((h) => h.freeVCpus > 0).length} candidates by capacity` },
        { ts: 12, stage: "filter:numa", text: "Detected pocket on NUMA node 0" },
        { ts: 17, stage: "derive", text: `Generated derived flavor df-${flavor.replace(/\./g, "-")}` },
        { ts: 21, stage: "map", text: "Mapped user flavor → derived flavor" },
        { ts: 24, stage: "submit", text: "Submitted to Nova Scheduler" },
        { ts: 31, stage: "confirm", text: `Placement confirmed on ${hostname}` },
    ];
}

export const getInstances = (filters = {}) =>
    liveOrMock(
        `/instances${filters.all_tenants ? "?all_tenants=true" : filters.host ? `?host=${filters.host}` : ""}`,
        () => {
            let inst = INSTANCES_ALL;
            if (filters.host) inst = inst.filter((i) => i.host === filters.host);
            return inst;
        }
    );

export const getPlacementTrace = (vmUuid) =>
    liveOrMock(`/instances/${vmUuid}/placement-trace`, () => {
        const inst = INSTANCES_ALL.find((i) => i.vm_uuid === vmUuid);
        return {
            vm_uuid: vmUuid,
            vm_name: inst?.name,
            decision_ms: 14,
            steps: makeTrace(inst?.flavor || "m1.large", inst?.host || "cn-compute-001"),
            chosen: inst?.host,
        };
    });

export const getMigrationHistory = () => liveOrMock("/migrations/history", () => MIGRATION_HISTORY);

export const refreshCache = () => liveOrMock("/hosts/refresh-cache", () => ({ ok: true, refreshed_at: new Date().toISOString() }));

// ───────────── helpers ─────────────

let _healthTick = 0;
function pickHealth(idx) {
    _healthTick++;
    const flip = _healthTick % 11 === 0 ? Math.floor(Math.random() * 3) : -1;
    return idx === flip ? "degraded" : "ok";
}

export function csvFromVisibility(rows, flavor) {
    const header = ["hostname", "aggregate", "free_vcpus", "free_ram_gb", "can_place", "reasons"];
    const body = rows.map((r) => [r.hostname, r.aggregate || "", r.freeVCpus, r.freeRam, r.canPlace, (r.reasons || []).join(" | ")].join(","));
    return [`# flavor=${flavor || "default"}`, header.join(","), ...body].join("\n");
}

export const API_BASE_URL = API_BASE;
