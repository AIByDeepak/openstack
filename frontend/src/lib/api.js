// Live-first fetcher with mock fallback. Returns { data, isMock } per spec.
// Falls back instantly when mixed-content blocks the http endpoint.

import {
    HOSTS as _RAW_HOSTS,
    shapeHostsResponse,
    shapeHostsList,
    shapeAgentStatus,
    shapeNumaTopology,
    shapeHostVms,
    shapeVmCapacity,
    shapeCpuConfig,
    shapeCpuConfigHost,
    shapeCpuPins,
    shapeFlavors,
    shapeFlavorVisibility,
    shapeVisibility,
    shapeVisibilityHost,
    shapePockets,
    shapePocketHost,
    shapeClusterReport,
    shapePlacementCheck,
    shapeBestHost,
    shapeInstances,
    shapePlacementTrace,
    shapeInfo,
    shapeHealth,
    shapePrometheus,
    FLAVORS_LIST,
    ACTIVITY_LOG,
} from "./mockData";
import { useUiStore } from "@/store/uiStore";

const BASE = "http://10.232.80.241:31597";
const TIMEOUT_MS = 2000;
const SKIP_LIVE =
    typeof window !== "undefined" && window.location.protocol === "https:" && BASE.startsWith("http://");

let _mockHits = 0;
let _liveHits = 0;
function _syncBadge() {
    useUiStore.getState().setMockMode(_mockHits > 0 && _liveHits === 0);
}

async function apiFetch(path, mock, asText = false) {
    if (SKIP_LIVE) {
        _mockHits++;
        _syncBadge();
        return { data: mock, isMock: true };
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const r = await fetch(BASE + path, { signal: ctrl.signal });
        clearTimeout(t);
        if (!r.ok) throw new Error(r.status);
        const data = asText ? await r.text() : await r.json();
        _liveHits++;
        useUiStore.getState().setMockMode(false);
        return { data, isMock: false };
    } catch (e) {
        clearTimeout(t);
        _mockHits++;
        useUiStore.getState().setEndpointError({ path, error: e.message });
        _syncBadge();
        return { data: mock, isMock: true };
    }
}

export const api = {
    getInfo:             () => apiFetch("/info", shapeInfo()),
    getHealth:           () => apiFetch("/health", shapeHealth()),
    getHealthz:          () => apiFetch("/healthz", { status: "ok" }),
    getReadyz:           () => apiFetch("/readyz", { status: "ok", checks: {}, version: "v0.2.1" }),
    getHosts:            (agg) => apiFetch("/hosts" + (agg ? `?aggregate=${agg}` : ""), shapeHostsResponse(agg)),
    getHostsList:        (agg) => apiFetch("/hosts/list" + (agg ? `?aggregate=${agg}` : ""), shapeHostsList(agg)),
    getAgentStatus:      () => apiFetch("/hosts/agent-status", shapeAgentStatus()),
    getNumaTopology:     (h) => apiFetch(`/hosts/numa-topology/${h}`, shapeNumaTopology(h)),
    getHostVMs:          (h) => apiFetch(`/hosts/${h}/vms`, shapeHostVms(h)),
    getVMCapacity:       (h, v, r, flavor) => {
        const qs = new URLSearchParams();
        if (v != null) qs.set("vcpu", v);
        if (r != null) qs.set("ram_gb", r);
        if (flavor) qs.set("flavor", flavor);
        return apiFetch(`/hosts/vm-capacity/${h}?${qs}`, shapeVmCapacity(h, v, r));
    },
    getCPUConfig:        () => apiFetch("/hosts/cpu-config", shapeCpuConfig()),
    getCPUConfigHost:    (h) => apiFetch(`/hosts/cpu-config/${h}`, shapeCpuConfigHost(h)),
    getCPUPins:          (h) => apiFetch("/hosts/cpu-pins" + (h ? `?host_name=${h}` : ""), shapeCpuPins(h)),
    getFlavors:          () => apiFetch("/flavors", shapeFlavors()),
    getFlavorPlacement:  (f) => apiFetch(`/flavors/${f}/placement`, { status: "PENDING", flavor: { name: f } }),
    getInstances:        (host) => apiFetch("/instances?all_tenants=true" + (host ? `&host=${host}` : ""), shapeInstances(host)),
    getPlacementTrace:   (uuid) => apiFetch(`/instances/${uuid}/placement-trace`, shapePlacementTrace(uuid)),
    getFlavorVisibility: (f, agg) => apiFetch(`/hosts/cluster/flavor-visibility?flavor=${f}` + (agg ? `&aggregate=${agg}` : ""), shapeFlavorVisibility(f, agg)),
    getVisibility:       () => apiFetch("/hosts/visibility", shapeVisibility()),
    getVisibilityHost:   (h, f) => apiFetch(`/hosts/visibility/${h}` + (f ? `?flavor=${f}` : ""), shapeVisibilityHost(h, f)),
    getVisibilityCSVUrl: (f) => BASE + "/hosts/visibility/csv" + (f ? `?flavor=${f}` : ""),
    getPockets:          (h) => apiFetch("/pockets" + (h ? `?host=${h}` : ""), shapePockets(h)),
    getPocketHost:       (h, fr) => apiFetch(`/pockets/${h}` + (fr ? "?force_refresh=true" : ""), shapePocketHost(h)),
    getClusterReport:    () => apiFetch("/hosts/cluster-numa-capacity-report", shapeClusterReport()),
    getPlacementCheck:   (f) => apiFetch(`/hosts/placement-check?flavor=${f}`, shapePlacementCheck(f)),
    getBestHost:         (f, agg) => apiFetch(`/hosts/best-host?flavor=${f}` + (agg ? `&aggregate=${agg}` : ""), shapeBestHost(f, agg)),
    getFlavorPlacementV: (f) => apiFetch(`/hosts/flavor-placement?flavor=${f}`, shapeFlavorVisibility(f, null, true)),
    getSchedulerHosts:   () => apiFetch("/api/v1/scheduler/hosts", { hosts: shapeHostsResponse().hosts.map((h) => ({ hostname: h.hostname, status: "active", pockets: [], free_pcpus: h.pcpu.free, free_memory_mb: h.memory.free, total_pcpus: h.pcpu.total, total_memory_mb: h.memory.total, numa_nodes: h.numa_topology.nodes, aggregate: h.aggregates[0] })) }),
    refreshCache:        () => apiFetch("/hosts/refresh-cache", { status: "ok", cleared: ["cpu_config", "pockets", "visibility"] }),
    getMetrics:          () => apiFetch("/metrics", shapePrometheus(), true),
};

export { ACTIVITY_LOG, FLAVORS_LIST, BASE as API_BASE };

// ───────────── legacy compatibility layer ─────────────
// Older page code expects bare-data return values matching internal shape.
// These adapters convert the new {data,isMock} envelope and convert.

function _adaptHosts() {
    return _RAW_HOSTS.map((h) => ({
        id: h._id,
        hostname: h._hostname,
        status: h._state === "up" && h._status === "enabled" ? "Active" : h._state === "down" ? "Down" : "Degraded",
        pocket: h._pocket,
        aggregate: h._aggregate,
        hypervisor: h._hypervisor,
        dedicatedCpuCount: h._dedicatedCount,
        sharedCpuCount: h._sharedCount,
        totalCpus: h._totalCpus,
        freeVCpus: h._freeVCpus,
        usedDedicated: h._usedDedicated,
        usedShared: h._usedShared,
        dedicatedCpus: h._dedicatedCpus,
        sharedCpus: h._sharedCpus,
        ramTotalGb: Math.round(h._ramTotalMB / 1024),
        ramUsedGb: Math.round(h._ramUsedMB / 1024),
        numaNodes: h._numaNodes,
        sockets: h._sockets,
        coresPerSocket: h._cores,
        uptimeDays: h._uptimeDays,
        vms: h._vms.map((v) => ({ ...v, ram: v.ram_mb / 1024 })),
        numa: h._numa.map((n) => ({
            id: n.node_id,
            cpus: n.total_cpus,
            ram: n.total_memory_mb / 1024,
            freeVCpus: n.free_cpus,
            freeRam: Math.round(n.free_memory_mb / 1024),
        })),
        cpusetDedicated: h._cpusetDedicated,
        cpusetShared: h._cpusetShared,
        agentStatus: h._agentStatus,
        agentLastSeen: h._agentStatus === "unreachable" ? "12 min ago" : "2 sec ago",
        agentVersion: "scheduler-agent/2.4.1",
    }));
}

const _delay = (ms) => new Promise((r) => setTimeout(r, ms));

export const getHosts = async (agg) => {
    await _delay(80);
    return agg ? _adaptHosts().filter((h) => h.aggregate === agg) : _adaptHosts();
};

export const getAgentStatus = async () => {
    await _delay(80);
    return _adaptHosts().map((h) => ({
        hostname: h.hostname, agent_status: h.agentStatus, last_seen: h.agentLastSeen, agent_version: h.agentVersion,
    }));
};

export const getFlavors = async () => {
    await _delay(60);
    return FLAVORS_LIST.map((f) => ({
        name: f.name, vcpus: f.vcpus, ram: f.ram / 1024, disk: f.disk,
        dedicated: f.extra_specs?.["hw:cpu_policy"] === "dedicated",
        gpu: f.extra_specs?.["pci_passthrough:alias"] ? 1 : 0,
    }));
};

export const getCpuConfig = async () => {
    await _delay(80);
    return _adaptHosts();
};

export const getPockets = async () => {
    await _delay(80);
    const pockets = ["compute-pocket-a", "compute-pocket-b", "gpu-pocket-1", "edge-pocket-east", "default"];
    return pockets
        .map((p, idx) => {
            const hosts = _adaptHosts().filter((h) => h.pocket === p);
            const totalFree = hosts.reduce((a, h) => a + h.freeVCpus, 0);
            const totalRam = hosts.reduce((a, h) => a + (h.ramTotalGb - h.ramUsedGb), 0);
            return {
                id: `pocket-${idx}`,
                name: p,
                hosts: hosts.length,
                totalCpus: hosts.reduce((a, h) => a + h.totalCpus, 0),
                freeVCpus: totalFree,
                freeRamGb: totalRam,
                utilization: hosts.length ? Math.round((1 - totalFree / hosts.reduce((a, h) => a + h.totalCpus, 0)) * 100) : 0,
                numa: [
                    { node: "NUMA-0", free: Math.floor(totalFree * 0.55), ram: Math.floor(totalRam * 0.5) },
                    { node: "NUMA-1", free: Math.floor(totalFree * 0.45), ram: Math.floor(totalRam * 0.5) },
                ],
                category: [
                    { name: "Compute", value: Math.floor(totalFree * 0.5) },
                    { name: "Memory", value: Math.floor(totalFree * 0.3) },
                    { name: "GPU", value: Math.floor(totalFree * 0.2) },
                ],
            };
        })
        .filter((p) => p.hosts > 0);
};

function _evaluate(flavor, aggregate) {
    return _adaptHosts()
        .filter((h) => !aggregate || h.aggregate === aggregate)
        .map((h) => {
            const reasons = [];
            if (h.status === "Down") reasons.push("host is down");
            if (h.status === "Degraded") reasons.push("host is degraded");
            if (flavor.vcpus > h.freeVCpus) reasons.push(`needs ${flavor.vcpus} vCPUs, only ${h.freeVCpus} free`);
            if (flavor.ram > h.ramTotalGb - h.ramUsedGb) reasons.push(`needs ${flavor.ram}GB RAM, only ${h.ramTotalGb - h.ramUsedGb}GB free`);
            if (flavor.dedicated && h.dedicatedCpuCount - h.usedDedicated < flavor.vcpus) reasons.push("insufficient dedicated CPUs");
            if (flavor.gpu && !h.pocket?.startsWith("gpu")) reasons.push("no GPU available");
            return {
                hostId: h.id,
                hostname: h.hostname,
                pocket: h.pocket,
                aggregate: h.aggregate,
                freeVCpus: h.freeVCpus,
                freeRam: h.ramTotalGb - h.ramUsedGb,
                canPlace: reasons.length === 0,
                reasons,
            };
        });
}

export const getFlavorVisibility = async (flavorName, aggregate) => {
    await _delay(80);
    const flavors = await getFlavors();
    const f = flavors.find((x) => x.name === flavorName) || flavors[0];
    const results = _evaluate(f, aggregate);
    return { flavor: f, results };
};

export const getVisibilityHost = async (host, flavor) => {
    await _delay(80);
    const all = await getFlavorVisibility(flavor || "m1.large");
    return all.results.find((r) => r.hostname === host);
};

export const getOverview = async () => {
    await _delay(80);
    const hosts = _adaptHosts();
    const total = hosts.length;
    const active = hosts.filter((h) => h.status === "Active").length;
    const degraded = hosts.filter((h) => h.status === "Degraded").length;
    const down = hosts.filter((h) => h.status === "Down").length;
    const hostsFree = hosts.filter((h) => h.freeVCpus > 0 && h.status === "Active").length;
    const totalCpus = hosts.reduce((a, h) => a + h.totalCpus, 0);
    const usedCpus = hosts.reduce((a, h) => a + h.usedDedicated + h.usedShared, 0);
    return { stats: { total, active, degraded, down, hostsFree, totalCpus, usedCpus, pockets: 4 }, activity: ACTIVITY_LOG };
};

export const quickPlacementCheck = async (flavorName) => {
    await _delay(160);
    const flavors = await getFlavors();
    const f = flavors.find((x) => x.name === flavorName);
    if (!f) throw new Error(`Unknown flavor "${flavorName}"`);
    return { flavor: f, results: _evaluate(f) };
};

export const getInfo = async () => {
    await _delay(40);
    return shapeInfo();
};

export const getMetrics = async () => {
    await _delay(80);
    return {
        placements_per_min: Array.from({ length: 24 }, (_, i) => ({ t: `${i.toString().padStart(2, "0")}:00`, v: 40 + Math.floor(Math.sin(i / 3) * 30 + 30) })),
        avg_decision_ms: Array.from({ length: 24 }, (_, i) => ({ t: `${i.toString().padStart(2, "0")}:00`, v: 10 + Math.floor(Math.cos(i / 4) * 8 + 10) })),
        counters: { placements_total: 18429, placements_failed: 312, migrations_total: 2104, cache_hits: 92481, cache_miss_rate: 4.7 },
    };
};

export const getMetricsRaw = async () => {
    await _delay(80);
    return shapePrometheus();
};

export const getHealth = async () => {
    await _delay(40);
    const r = Math.random();
    return { status: r > 0.92 ? "degraded" : "ok" };
};
export const getHealthz = async () => {
    await _delay(40);
    const r = Math.random();
    return { status: r > 0.93 ? "degraded" : "ok" };
};
export const getReadyz = async () => {
    await _delay(40);
    const r = Math.random();
    return { status: r > 0.94 ? "degraded" : "ok" };
};

export const getInstances = async (filters = {}) => {
    await _delay(80);
    const out = [];
    _adaptHosts().forEach((h) => {
        if (filters.host && h.hostname !== filters.host) return;
        h.vms.forEach((v) => {
            out.push({
                vm_uuid: v.uuid,
                name: v.name,
                flavor: v.flavor,
                state: v.state,
                host: h.hostname,
                aggregate: h.aggregate,
                vcpus: v.vcpus,
                ram_gb: v.ram,
            });
        });
    });
    return out;
};

export const getPlacementTrace = async (uuid) => {
    await _delay(120);
    return {
        vm_uuid: uuid,
        decision_ms: 14,
        steps: [
            { ts: 0, stage: "received", text: "Received request" },
            { ts: 5, stage: "filter:status", text: "Evaluated 15 hosts" },
            { ts: 9, stage: "filter:capacity", text: "Filtered to 9 candidates" },
            { ts: 14, stage: "filter:numa", text: "Detected pocket on NUMA-0" },
            { ts: 18, stage: "select", text: "Selected best host" },
        ],
    };
};

export const getBestHost = async (flavor, aggregate) => {
    await _delay(120);
    const flavors = await getFlavors();
    const f = flavors.find((x) => x.name === flavor) || flavors[2];
    const ranked = _evaluate(f, aggregate).filter((r) => r.canPlace).sort((a, b) => b.freeVCpus - a.freeVCpus);
    const best = ranked[0];
    if (!best) return { error: "no eligible host" };
    const winningHost = _adaptHosts().find((h) => h.hostname === best.hostname);
    return {
        best,
        host: winningHost,
        score: { utilization: 0.62, numa_fit: 0.95, pocket_match: 0.88, total: 0.83 },
        alternatives: ranked.slice(1, 6),
        derived_flavor: {
            name: `_internal_sched_${f.name.replace(/\./g, "_")}`,
            vcpus: f.vcpus,
            ram: f.ram,
            numa_pin: 0,
            cpu_set: winningHost ? winningHost.dedicatedCpus.slice(winningHost.usedDedicated, winningHost.usedDedicated + f.vcpus) : [],
        },
    };
};

export const placeFlavor = async (flavor, vmName, hostname) => {
    await _delay(180);
    const flavors = await getFlavors();
    const f = flavors.find((x) => x.name === flavor);
    const host = _adaptHosts().find((h) => h.hostname === hostname);
    return {
        success: true,
        vm_uuid: `${Date.now().toString(16)}-aaaa-bbbb-cccc-dddddddddddd`,
        vm_name: vmName,
        flavor: f?.name,
        hostname,
        numa_node: 0,
        cpu_pins: host?.dedicatedCpus.slice(host.usedDedicated, host.usedDedicated + (f?.vcpus || 4)) ?? [],
        placed_at: new Date().toISOString(),
        trace: [
            { ts: 0, stage: "received", text: `Received flavor ${flavor}` },
            { ts: 4, stage: "filter:status", text: `Evaluated 15 hosts; 9 active` },
            { ts: 9, stage: "filter:capacity", text: `Filtered to candidates by capacity` },
            { ts: 12, stage: "filter:numa", text: "Detected pocket on NUMA-0" },
            { ts: 17, stage: "derive", text: `Generated derived flavor _internal_sched_${flavor.replace(/\./g, "_")}` },
            { ts: 21, stage: "map", text: "Mapped user flavor → derived flavor" },
            { ts: 24, stage: "submit", text: "Submitted to Nova Scheduler" },
            { ts: 31, stage: "confirm", text: `Placement confirmed on ${hostname}` },
        ],
    };
};

export function csvFromVisibility(rows, flavor) {
    const header = ["hostname", "aggregate", "free_vcpus", "free_ram_gb", "can_place", "reasons"];
    const body = rows.map((r) => [r.hostname, r.aggregate || "", r.freeVCpus, r.freeRam, r.canPlace, (r.reasons || []).join(" | ")].join(","));
    return [`# flavor=${flavor || "default"}`, header.join(","), ...body].join("\n");
}
