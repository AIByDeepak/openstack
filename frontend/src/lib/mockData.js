// Realistic mock data for the OpenStack Smart Scheduler dashboard.
// Shapes match the real API at http://10.232.80.241:31597 — these are the
// fixtures returned when that endpoint is unreachable (which is always, in
// the preview environment).

const HYPERVISORS = ["KVM", "QEMU/KVM"];
const STATUSES = ["Active", "Active", "Active", "Active", "Active", "Active", "Degraded", "Degraded", "Down"];
const POCKETS = ["compute-pocket-a", "compute-pocket-b", "gpu-pocket-1", "edge-pocket-east", "default"];
const AGGREGATES = ["ANI-perf", "ANI-default", "ANI-gpu", "ANI-edge"];

function seedRand(seed) {
    let s = seed % 2147483647;
    return () => {
        s = (s * 16807) % 2147483647;
        return s / 2147483647;
    };
}

function buildCpuSet(count, start = 0) {
    return Array.from({ length: count }, (_, i) => start + i);
}

function makeHost(i) {
    const r = seedRand(i * 9301 + 49297);
    const status = STATUSES[Math.floor(r() * STATUSES.length)];
    const totalCpus = [48, 64, 96, 128][Math.floor(r() * 4)];
    const dedicatedCount = Math.floor(totalCpus * (0.4 + r() * 0.3));
    const sharedCount = totalCpus - dedicatedCount;
    const dedicatedCpus = buildCpuSet(dedicatedCount, 0);
    const sharedCpus = buildCpuSet(sharedCount, dedicatedCount);
    const usedShared = Math.floor(sharedCount * (0.3 + r() * 0.6));
    const usedDedicated = Math.floor(dedicatedCount * (0.4 + r() * 0.5));
    const freeVCpus = sharedCount - usedShared + (dedicatedCount - usedDedicated);
    const ramTotal = [256, 384, 512, 768, 1024][Math.floor(r() * 5)];
    const ramUsed = Math.floor(ramTotal * (0.3 + r() * 0.55));
    const numaNodes = totalCpus >= 96 ? 4 : 2;
    const sockets = numaNodes;
    const cores = totalCpus / numaNodes / 2;
    const uptimeDays = Math.floor(r() * 240) + 5;
    const pocket = POCKETS[Math.floor(r() * POCKETS.length)];
    const aggregate = AGGREGATES[Math.floor(r() * AGGREGATES.length)];

    const vmCount = status === "Down" ? 0 : Math.floor(r() * 14) + 2;
    const vms = Array.from({ length: vmCount }, (_, k) => {
        const flavors = ["m1.small", "m1.medium", "m1.large", "m1.xlarge", "c5.compute", "r6.memory", "g4.gpu.small"];
        const flavor = flavors[Math.floor(r() * flavors.length)];
        const states = ["ACTIVE", "ACTIVE", "ACTIVE", "PAUSED", "ERROR", "BUILDING"];
        const state = states[Math.floor(r() * states.length)];
        const vcpu = [2, 4, 4, 8, 8, 16][Math.floor(r() * 6)];
        const ram = vcpu * 4;
        return {
            id: `vm-${i}-${k}`,
            uuid: `${(i * 1000 + k).toString(16).padStart(8, "0")}-aaaa-bbbb-cccc-dddddddddddd`,
            name: `instance-${(i * 100 + k).toString(16).padStart(6, "0")}`,
            flavor,
            state,
            vcpus: vcpu,
            ram,
            owner: ["devops", "platform", "ml-team", "qa", "billing"][Math.floor(r() * 5)],
        };
    });

    const numa = Array.from({ length: numaNodes }, (_, n) => ({
        id: n,
        cpus: totalCpus / numaNodes,
        ram: ramTotal / numaNodes,
        freeVCpus: Math.floor(freeVCpus / numaNodes) + (n === 0 ? freeVCpus % numaNodes : 0),
        freeRam: Math.floor((ramTotal - ramUsed) / numaNodes),
    }));

    // Agent status: most healthy, some degraded, a few unreachable
    const agentRoll = r();
    const agentStatus = agentRoll > 0.9 ? "unreachable" : agentRoll > 0.78 ? "degraded" : "healthy";
    const agentLastSeen = agentStatus === "unreachable" ? "12 min ago" : agentStatus === "degraded" ? "47 sec ago" : "2 sec ago";

    return {
        id: `host-${i}`,
        hostname: `cn-${pocket.split("-")[0]}-${(i + 1).toString().padStart(3, "0")}.ani.local`,
        status,
        pocket,
        aggregate,
        hypervisor: HYPERVISORS[Math.floor(r() * HYPERVISORS.length)],
        dedicatedCpuCount: dedicatedCount,
        sharedCpuCount: sharedCount,
        totalCpus,
        freeVCpus,
        usedDedicated,
        usedShared,
        dedicatedCpus,
        sharedCpus,
        ramTotalGb: ramTotal,
        ramUsedGb: ramUsed,
        numaNodes,
        sockets,
        coresPerSocket: cores,
        uptimeDays,
        vms,
        numa,
        cpusetDedicated: `${dedicatedCpus[0]}-${dedicatedCpus[dedicatedCpus.length - 1]}`,
        cpusetShared: `${sharedCpus[0]}-${sharedCpus[sharedCpus.length - 1]}`,
        agentStatus,
        agentLastSeen,
        agentVersion: "scheduler-agent/2.4.1",
    };
}

export const HOSTS = Array.from({ length: 15 }, (_, i) => makeHost(i + 1));

export const FLAVORS = [
    { name: "m1.small", vcpus: 2, ram: 4, disk: 20, dedicated: false },
    { name: "m1.medium", vcpus: 4, ram: 8, disk: 40, dedicated: false },
    { name: "m1.large", vcpus: 8, ram: 16, disk: 80, dedicated: false },
    { name: "m1.xlarge", vcpus: 16, ram: 32, disk: 160, dedicated: false },
    { name: "c5.compute", vcpus: 8, ram: 16, disk: 100, dedicated: true },
    { name: "r6.memory", vcpus: 4, ram: 64, disk: 100, dedicated: false },
    { name: "g4.gpu.small", vcpus: 8, ram: 32, disk: 200, dedicated: true, gpu: 1 },
    { name: "g4.gpu.large", vcpus: 32, ram: 128, disk: 500, dedicated: true, gpu: 4 },
];

export function evaluateFlavor(flavor) {
    return HOSTS.map((h) => {
        const reasons = [];
        if (h.status === "Down") reasons.push("host is down");
        if (h.status === "Degraded") reasons.push("host is degraded");
        if (flavor.vcpus > h.freeVCpus) reasons.push(`needs ${flavor.vcpus} vCPUs, only ${h.freeVCpus} free`);
        if (flavor.ram > h.ramTotalGb - h.ramUsedGb) reasons.push(`needs ${flavor.ram}GB RAM, only ${h.ramTotalGb - h.ramUsedGb}GB free`);
        if (flavor.dedicated && h.dedicatedCpuCount - h.usedDedicated < flavor.vcpus) reasons.push("insufficient dedicated CPUs");
        if (flavor.gpu && !h.pocket.startsWith("gpu")) reasons.push("no GPU available on this host");
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

export const POCKETS_DATA = POCKETS.map((p, idx) => {
    const hostsInPocket = HOSTS.filter((h) => h.pocket === p);
    const totalFree = hostsInPocket.reduce((a, h) => a + h.freeVCpus, 0);
    const totalRam = hostsInPocket.reduce((a, h) => a + (h.ramTotalGb - h.ramUsedGb), 0);
    const numaBreakdown = [
        { node: "NUMA-0", free: Math.floor(totalFree * 0.55), ram: Math.floor(totalRam * 0.5) },
        { node: "NUMA-1", free: Math.floor(totalFree * 0.45), ram: Math.floor(totalRam * 0.5) },
    ];
    return {
        id: `pocket-${idx}`,
        name: p,
        hosts: hostsInPocket.length,
        totalCpus: hostsInPocket.reduce((a, h) => a + h.totalCpus, 0),
        freeVCpus: totalFree,
        freeRamGb: totalRam,
        utilization: hostsInPocket.length
            ? Math.round((1 - totalFree / hostsInPocket.reduce((a, h) => a + h.totalCpus, 0)) * 100)
            : 0,
        numa: numaBreakdown,
        category: [
            { name: "Compute", value: Math.floor(totalFree * 0.5) },
            { name: "Memory", value: Math.floor(totalFree * 0.3) },
            { name: "GPU", value: Math.floor(totalFree * 0.2) },
        ],
    };
}).filter((p) => p.hosts > 0);

export const ACTIVITY_LOG = [
    { id: 1, time: "2 min ago", type: "placement", status: "success", text: "Placed instance-0a3f on cn-compute-007 (m1.large)" },
    { id: 2, time: "5 min ago", type: "placement", status: "success", text: "Placed instance-0a3e on cn-compute-002 (m1.medium)" },
    { id: 3, time: "9 min ago", type: "check", status: "warning", text: "Flavor g4.gpu.large: 1/15 hosts can place" },
    { id: 4, time: "14 min ago", type: "migration", status: "success", text: "Migrated instance-09cc to cn-edge-003" },
    { id: 5, time: "21 min ago", type: "placement", status: "error", text: "Placement failed: r6.memory — insufficient RAM on all hosts" },
    { id: 6, time: "28 min ago", type: "host", status: "warning", text: "cn-compute-009 entered Degraded state" },
    { id: 7, time: "37 min ago", type: "check", status: "success", text: "Flavor m1.medium: 13/15 hosts can place" },
    { id: 8, time: "44 min ago", type: "placement", status: "success", text: "Placed instance-09be on cn-gpu-001 (g4.gpu.small)" },
    { id: 9, time: "52 min ago", type: "migration", status: "success", text: "Live-migrated instance-09a2 to cn-compute-004" },
    { id: 10, time: "1 hr ago", type: "host", status: "error", text: "cn-edge-002 marked Down — heartbeat lost" },
];

export function clusterStats() {
    const total = HOSTS.length;
    const active = HOSTS.filter((h) => h.status === "Active").length;
    const degraded = HOSTS.filter((h) => h.status === "Degraded").length;
    const down = HOSTS.filter((h) => h.status === "Down").length;
    const hostsFree = HOSTS.filter((h) => h.freeVCpus > 0 && h.status === "Active").length;
    const totalCpus = HOSTS.reduce((a, h) => a + h.totalCpus, 0);
    const usedCpus = HOSTS.reduce((a, h) => a + h.usedDedicated + h.usedShared, 0);
    return { total, active, degraded, down, hostsFree, totalCpus, usedCpus, pockets: POCKETS_DATA.length };
}

export function sparkline(seed, base = 50, variance = 20) {
    const r = seedRand(seed);
    return Array.from({ length: 14 }, (_, i) => ({ x: i, y: Math.max(0, Math.round(base + (r() - 0.5) * variance)) }));
}

// /info — system info card
export const SYSTEM_INFO = {
    name: "Smart Scheduler",
    version: "v0.2.1",
    build: "2026.02.04-r1",
    git_sha: "8a3f9c2",
    region: "eu-west-1",
    environment: "ani_staging",
    api_base: "http://10.232.80.241:31597",
    started_at: "2026-02-03T18:42:11Z",
    uptime_seconds: 86_412,
    schedulers: 3,
    policy: "numa-aware-spread",
};

// /metrics — metrics panel time series
export function metricsSeries() {
    return {
        placements_per_min: Array.from({ length: 24 }, (_, i) => {
            const r = seedRand(i + 99);
            return { t: `${i.toString().padStart(2, "0")}:00`, v: Math.round(40 + r() * 80) };
        }),
        avg_decision_ms: Array.from({ length: 24 }, (_, i) => {
            const r = seedRand(i + 12);
            return { t: `${i.toString().padStart(2, "0")}:00`, v: Math.round(8 + r() * 22) };
        }),
        counters: {
            placements_total: 18_429,
            placements_failed: 312,
            migrations_total: 2_104,
            cache_hits: 92_481,
            cache_miss_rate: 4.7,
        },
    };
}

// /hosts/cluster-numa-capacity-report
export function clusterNumaCapacityReport() {
    return HOSTS.map((h) => ({
        hostname: h.hostname,
        numa: h.numa,
        free_total: h.freeVCpus,
        free_ram_gb: h.ramTotalGb - h.ramUsedGb,
    }));
}
