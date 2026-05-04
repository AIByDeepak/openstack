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
} from "./mockData";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// All functions simulate calls against http://10.232.80.241:31597 and fall
// back to in-memory fixtures (which is the only mode in preview).

export async function getHosts(aggregate) {
    await delay(220);
    return aggregate ? HOSTS.filter((h) => h.aggregate === aggregate) : HOSTS;
}

export async function getHostsList() {
    await delay(120);
    return HOSTS.map((h) => ({ hostname: h.hostname, aggregate: h.aggregate, status: h.status }));
}

export async function getAgentStatus() {
    await delay(140);
    return HOSTS.map((h) => ({
        hostname: h.hostname,
        agent_status: h.agentStatus,
        last_seen: h.agentLastSeen,
        agent_version: h.agentVersion,
    }));
}

export async function getNumaTopology(hostname) {
    await delay(160);
    const h = HOSTS.find((x) => x.hostname === hostname);
    if (!h) throw new Error("host not found");
    return { hostname: h.hostname, numa_nodes: h.numa, sockets: h.sockets, cores_per_socket: h.coresPerSocket };
}

export async function getHostVms(hostname) {
    await delay(160);
    const h = HOSTS.find((x) => x.hostname === hostname);
    return h?.vms ?? [];
}

export async function getPockets() {
    await delay(180);
    return POCKETS_DATA;
}

export async function getCpuConfig() {
    await delay(200);
    return HOSTS.map((h) => ({
        id: h.id,
        hostname: h.hostname,
        status: h.status,
        dedicatedCpus: h.dedicatedCpus,
        sharedCpus: h.sharedCpus,
        usedDedicated: h.usedDedicated,
        usedShared: h.usedShared,
        cpusetDedicated: h.cpusetDedicated,
        cpusetShared: h.cpusetShared,
    }));
}

export async function getCpuPins() {
    await delay(180);
    return HOSTS.map((h) => ({
        hostname: h.hostname,
        pinned: h.dedicatedCpus.slice(0, h.usedDedicated),
        unpinned: h.sharedCpus,
    }));
}

export async function getFlavors() {
    await delay(120);
    return FLAVORS;
}

export async function getFlavorVisibility(flavorName, aggregate) {
    await delay(260);
    const flavor = FLAVORS.find((f) => f.name === flavorName) || FLAVORS[0];
    let results = evaluateFlavor(flavor);
    if (aggregate) results = results.filter((r) => r.aggregate === aggregate);
    return { flavor, results };
}

export async function getOverview() {
    await delay(200);
    return { stats: clusterStats(), activity: ACTIVITY_LOG };
}

export async function quickPlacementCheck(flavorName) {
    await delay(420);
    const flavor = FLAVORS.find((f) => f.name === flavorName);
    if (!flavor) throw new Error(`Unknown flavor "${flavorName}"`);
    return { flavor, results: evaluateFlavor(flavor) };
}

export async function getInfo() {
    await delay(80);
    return SYSTEM_INFO;
}

export async function getMetrics() {
    await delay(180);
    return metricsSeries();
}

export async function getClusterNumaCapacityReport() {
    await delay(160);
    return clusterNumaCapacityReport();
}

// Health endpoints — randomised so dots can flip amber occasionally
let _healthTick = 0;
function pickHealth() {
    _healthTick++;
    // Roughly 1 in 7 cycles flips one endpoint amber for one cycle.
    const flip = _healthTick % 7 === 0 ? Math.floor(Math.random() * 3) : -1;
    return [0, 1, 2].map((i) => (i === flip ? "degraded" : "ok"));
}

export async function getHealth() {
    await delay(60);
    const [a] = pickHealth();
    return { status: a, checks: { db: "ok", cache: "ok", queue: a } };
}
export async function getHealthz() {
    await delay(60);
    return { status: pickHealth()[1] };
}
export async function getReadyz() {
    await delay(60);
    return { status: pickHealth()[2] };
}

export async function getBestHost(flavor, aggregate) {
    await delay(220);
    const f = FLAVORS.find((x) => x.name === flavor) || FLAVORS[0];
    const ranked = evaluateFlavor(f)
        .filter((r) => r.canPlace)
        .filter((r) => !aggregate || r.aggregate === aggregate)
        .sort((a, b) => b.freeVCpus - a.freeVCpus);
    return ranked[0] || null;
}

export async function getFlavorPlacement(flavor) {
    await delay(220);
    return quickPlacementCheck(flavor);
}

export async function getPlacementTrace(vmUuid) {
    await delay(280);
    return {
        vm_uuid: vmUuid,
        decision_ms: 12,
        steps: [
            { stage: "filter:status", in: 15, out: 13 },
            { stage: "filter:capacity", in: 13, out: 9 },
            { stage: "filter:numa", in: 9, out: 6 },
            { stage: "weigh:spread", in: 6, out: 6 },
            { stage: "select", in: 6, out: 1 },
        ],
        chosen: HOSTS[0].hostname,
    };
}
