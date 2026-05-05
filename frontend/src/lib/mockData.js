// Real-API-shaped fixtures. Every helper returns data in the exact shape that
// http://10.232.80.241:31597 sends, so swapping mock → live works with no UI
// edits. We keep the internal HOSTS array as the source of truth and project
// it into different response shapes below.

const HYPERVISORS = ["KVM", "QEMU/KVM"];
const STATE_VALUES = [
    ["up", "enabled"], ["up", "enabled"], ["up", "enabled"], ["up", "enabled"], ["up", "enabled"], ["up", "enabled"],
    ["up", "disabled"], ["up", "disabled"], ["down", "disabled"],
];
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
    const [state, status] = STATE_VALUES[Math.floor(r() * STATE_VALUES.length)];
    const totalCpus = [48, 64, 96, 128][Math.floor(r() * 4)];
    const dedicatedCount = Math.floor(totalCpus * (0.4 + r() * 0.3));
    const sharedCount = totalCpus - dedicatedCount;
    const dedicatedCpus = buildCpuSet(dedicatedCount, 0);
    const sharedCpus = buildCpuSet(sharedCount, dedicatedCount);
    const usedShared = Math.floor(sharedCount * (0.3 + r() * 0.6));
    const usedDedicated = Math.floor(dedicatedCount * (0.4 + r() * 0.5));
    const freeVCpus = sharedCount - usedShared + (dedicatedCount - usedDedicated);
    const ramTotalMB = [256, 384, 512, 768, 1024][Math.floor(r() * 5)] * 1024;
    const ramUsedMB = Math.floor(ramTotalMB * (0.3 + r() * 0.55));
    const numaNodes = totalCpus >= 96 ? 4 : 2;
    const sockets = numaNodes;
    const cores = totalCpus / numaNodes / 2;
    const uptimeDays = Math.floor(r() * 240) + 5;
    const pocket = POCKETS[Math.floor(r() * POCKETS.length)];
    const aggregate = AGGREGATES[Math.floor(r() * AGGREGATES.length)];

    const vmCount = state === "down" ? 0 : Math.floor(r() * 14) + 2;
    const vms = Array.from({ length: vmCount }, (_, k) => {
        const flavors = ["m1.small", "m1.medium", "m1.large", "m1.xlarge", "c5.compute", "r6.memory", "g4.gpu.small"];
        const flavor = flavors[Math.floor(r() * flavors.length)];
        const states = ["ACTIVE", "ACTIVE", "ACTIVE", "PAUSED", "ERROR", "BUILDING"];
        const vmState = states[Math.floor(r() * states.length)];
        const vcpu = [2, 4, 4, 8, 8, 16][Math.floor(r() * 6)];
        const ram = vcpu * 4;
        return {
            id: `vm-${i}-${k}`,
            uuid: `${(i * 1000 + k).toString(16).padStart(8, "0")}-aaaa-bbbb-cccc-dddddddddddd`,
            name: `instance-${(i * 100 + k).toString(16).padStart(6, "0")}`,
            flavor,
            state: vmState,
            vcpus: vcpu,
            ram_mb: ram * 1024,
        };
    });

    const numa_nodes = Array.from({ length: numaNodes }, (_, n) => {
        const nodeCpus = totalCpus / numaNodes;
        const nodeFree = Math.floor(freeVCpus / numaNodes) + (n === 0 ? freeVCpus % numaNodes : 0);
        const nodeUsed = nodeCpus - nodeFree;
        const all_cpu_ids = buildCpuSet(nodeCpus, n * nodeCpus);
        return {
            node_id: n,
            total_cpus: nodeCpus,
            used_cpus: nodeUsed,
            free_cpus: nodeFree,
            total_memory_mb: ramTotalMB / numaNodes,
            free_memory_mb: (ramTotalMB - ramUsedMB) / numaNodes,
            all_cpu_ids,
            used_cpu_ids: all_cpu_ids.slice(0, nodeUsed),
            free_cpu_ids: all_cpu_ids.slice(nodeUsed),
            ht_pairs: Array.from({ length: nodeCpus / 2 }, (_, k) => [k * 2, k * 2 + 1]),
        };
    });

    const agentRoll = r();
    const agentStatus = agentRoll > 0.9 ? "unreachable" : agentRoll > 0.78 ? "degraded" : "healthy";

    return {
        // internal indexing (used by helpers, NOT shipped in API responses)
        _id: `host-${i}`,
        _hostname: `cn-${pocket.split("-")[0]}-${(i + 1).toString().padStart(3, "0")}.ani.local`,
        _state: state,
        _status: status,
        _aggregate: aggregate,
        _pocket: pocket,
        _hypervisor: HYPERVISORS[Math.floor(r() * HYPERVISORS.length)],
        _totalCpus: totalCpus,
        _dedicatedCount: dedicatedCount,
        _sharedCount: sharedCount,
        _dedicatedCpus: dedicatedCpus,
        _sharedCpus: sharedCpus,
        _usedDedicated: usedDedicated,
        _usedShared: usedShared,
        _freeVCpus: freeVCpus,
        _ramTotalMB: ramTotalMB,
        _ramUsedMB: ramUsedMB,
        _numaNodes: numaNodes,
        _numa: numa_nodes,
        _vms: vms,
        _running_vms: vmCount,
        _hostIp: `10.232.${i}.${10 + i}`,
        _uptimeDays: uptimeDays,
        _sockets: sockets,
        _cores: cores,
        _agentStatus: agentStatus,
        _cpusetDedicated: `${dedicatedCpus[0]}-${dedicatedCpus[dedicatedCpus.length - 1]}`,
        _cpusetShared: `${sharedCpus[0]}-${sharedCpus[sharedCpus.length - 1]}`,
    };
}

const RAW = Array.from({ length: 15 }, (_, i) => makeHost(i + 1));
export const HOSTS = RAW; // backward compat for older imports

// ───────────────── real-API shape projections ─────────────────

export function shapeHostsResponse(filterAgg) {
    const arr = filterAgg ? RAW.filter((h) => h._aggregate === filterAgg) : RAW;
    return {
        total_hosts: arr.length,
        source: "nova+placement (mock)",
        environment: "ani_staging",
        hosts: arr.map((h) => ({
            id: h._id,
            hostname: h._hostname,
            state: h._state,
            status: h._status,
            host_ip: h._hostIp,
            running_vms: h._running_vms,
            aggregates: [h._aggregate],
            pcpu: {
                total: h._totalCpus,
                used: h._usedDedicated + h._usedShared,
                reserved: 0,
                allocation_ratio: 1.0,
                free: h._freeVCpus,
            },
            memory: {
                total: h._ramTotalMB,
                used: h._ramUsedMB,
                reserved: 0,
                allocation_ratio: 1.0,
                free: h._ramTotalMB - h._ramUsedMB,
            },
            cpu_dedicated_set: h._cpusetDedicated,
            cpu_shared_set: h._cpusetShared,
            numa_topology: { nodes: h._numaNodes },
        })),
    };
}

export function shapeHostsList(filterAgg) {
    const arr = filterAgg ? RAW.filter((h) => h._aggregate === filterAgg) : RAW;
    return { total_hosts: arr.length, hosts: arr.map((h) => h._hostname), source: "nova", environment: "ani_staging" };
}

export function shapeAgentStatus() {
    const hosts = {};
    RAW.forEach((h) => {
        hosts[h._hostname] = {
            status: h._agentStatus,
            last_seen: h._agentStatus === "unreachable" ? "12 min ago" : "2 sec ago",
            agent_version: "scheduler-agent/2.4.1",
        };
    });
    return {
        agent_port: 9111,
        status: "enabled",
        detail: "polling 15 nodes",
        healthy_hosts: RAW.filter((h) => h._agentStatus === "healthy").length,
        total_hosts: RAW.length,
        hosts,
    };
}

export function shapeNumaTopology(hostname) {
    const h = RAW.find((x) => x._hostname === hostname);
    if (!h) return { host: hostname, numa_nodes: [] };
    return {
        host: h._hostname,
        total_cpus: h._totalCpus,
        dedicated_set: h._cpusetDedicated,
        shared_set: h._cpusetShared,
        numa_nodes: h._numa,
        source: "nova",
        fetched_at: new Date().toISOString(),
    };
}

export function shapeHostVms(hostname) {
    const h = RAW.find((x) => x._hostname === hostname);
    if (!h) return { total_vms: 0, vms: {} };
    const vms = {};
    h._vms.forEach((v) => { vms[v.uuid] = v.name; });
    return { total_vms: h._vms.length, vms };
}

export function shapeVmCapacity(hostname, vcpu, ram_gb) {
    const h = RAW.find((x) => x._hostname === hostname);
    if (!h) return { hostname, can_place: false };
    const fits = h._freeVCpus >= vcpu && (h._ramTotalMB - h._ramUsedMB) / 1024 >= ram_gb;
    return {
        hostname,
        requested: { vcpus: +vcpu, ram_mb: +ram_gb * 1024 },
        can_place: fits,
        eligible_numa_nodes: fits ? [0] : [],
        best_numa_node: fits ? 0 : null,
        free_cpus_after: h._freeVCpus - vcpu,
        free_memory_mb_after: h._ramTotalMB - h._ramUsedMB - ram_gb * 1024,
        reason: fits ? "OK" : `needs ${vcpu} vCPU / ${ram_gb}G — only ${h._freeVCpus} / ${(h._ramTotalMB - h._ramUsedMB) / 1024}G free`,
    };
}

export function shapeCpuConfig() {
    const hosts = RAW.map((h) => ({
        host: h._hostname,
        cpu_dedicated_set: h._cpusetDedicated,
        cpu_shared_set: h._cpusetShared,
        dedicated_cpu_ids: h._dedicatedCpus,
        shared_cpu_ids: h._sharedCpus,
        used_dedicated_cpu_ids: h._dedicatedCpus.slice(0, h._usedDedicated),
        free_dedicated_cpu_ids: h._dedicatedCpus.slice(h._usedDedicated),
        dedicated_count: h._dedicatedCount,
        shared_count: h._sharedCount,
        total_count: h._totalCpus,
        numa_cells: h._numa.map((n) => ({ id: n.node_id, cpus: n.all_cpu_ids })),
    }));
    return { hosts, total_hosts: hosts.length, cached: false, cache_age_seconds: 0, degraded: false };
}

export function shapeCpuConfigHost(hostname) {
    return shapeCpuConfig().hosts.find((h) => h.host === hostname) || {};
}

export function shapeCpuPins(hostFilter) {
    const out = {};
    RAW.forEach((h) => {
        if (hostFilter && h._hostname !== hostFilter) return;
        out[h._hostname] = {
            cores: h._totalCpus,
            pins: h._dedicatedCpus.slice(0, h._usedDedicated),
            ram_total_mb: h._ramTotalMB,
            ram_used_mb: h._ramUsedMB,
            data_quality: "ok",
            cpu_config: { dedicated: h._cpusetDedicated, shared: h._cpusetShared },
        };
    });
    return out;
}

export const FLAVORS_LIST = [
    { id: "f-1", name: "m1.small", vcpus: 2, ram: 4096, disk: 20, extra_specs: {} },
    { id: "f-2", name: "m1.medium", vcpus: 4, ram: 8192, disk: 40, extra_specs: {} },
    { id: "f-3", name: "m1.large", vcpus: 8, ram: 16384, disk: 80, extra_specs: {} },
    { id: "f-4", name: "m1.xlarge", vcpus: 16, ram: 32768, disk: 160, extra_specs: {} },
    { id: "f-5", name: "c5.compute", vcpus: 8, ram: 16384, disk: 100, extra_specs: { "hw:cpu_policy": "dedicated" } },
    { id: "f-6", name: "r6.memory", vcpus: 4, ram: 65536, disk: 100, extra_specs: {} },
    { id: "f-7", name: "g4.gpu.small", vcpus: 8, ram: 32768, disk: 200, extra_specs: { "hw:cpu_policy": "dedicated", "pci_passthrough:alias": "gpu:1" } },
    { id: "f-8", name: "g4.gpu.large", vcpus: 32, ram: 131072, disk: 500, extra_specs: { "hw:cpu_policy": "dedicated", "pci_passthrough:alias": "gpu:4" } },
];

export function shapeFlavors() {
    return { total_flavors: FLAVORS_LIST.length, source: "nova", flavors: FLAVORS_LIST };
}

function evaluatePerHost(flavor, aggregateFilter) {
    return RAW
        .filter((h) => !aggregateFilter || h._aggregate === aggregateFilter)
        .map((h) => {
            const reasons = [];
            const ramFreeMb = h._ramTotalMB - h._ramUsedMB;
            const flavorVcpus = flavor.vcpus;
            const flavorRamMb = flavor.ram;
            const dedicated = flavor.extra_specs?.["hw:cpu_policy"] === "dedicated";
            if (h._state !== "up") reasons.push("host is down");
            if (h._status !== "enabled") reasons.push("host is degraded");
            if (flavorVcpus > h._freeVCpus) reasons.push(`needs ${flavorVcpus} vCPUs, only ${h._freeVCpus} free`);
            if (flavorRamMb > ramFreeMb) reasons.push(`needs ${flavorRamMb / 1024}GB RAM, only ${Math.round(ramFreeMb / 1024)}GB free`);
            if (dedicated && h._dedicatedCount - h._usedDedicated < flavorVcpus) reasons.push("insufficient dedicated CPUs");
            if (flavor.extra_specs?.["pci_passthrough:alias"] && !h._pocket.startsWith("gpu")) reasons.push("no GPU available");

            const can_place = reasons.length === 0;
            return {
                host: h._hostname,
                aggregate: h._aggregate,
                can_place,
                free_vcpus: h._freeVCpus,
                free_ram_mb: ramFreeMb,
                dedicated_cpu_count: h._dedicatedCount,
                used_vcpus: h._usedDedicated + h._usedShared,
                total_vcpus: h._totalCpus,
                used_ram_mb: h._ramUsedMB,
                total_ram_mb: h._ramTotalMB,
                reason: can_place ? "OK" : reasons[0],
                eligible_numa_nodes: can_place ? [0] : [],
                best_numa_node: can_place ? 0 : null,
                fit_reason: can_place ? "fits NUMA-0" : reasons[0],
            };
        });
}

export function shapeFlavorVisibility(flavorName, aggregateFilter, filtered = false) {
    const f = FLAVORS_LIST.find((x) => x.name === flavorName) || FLAVORS_LIST[2];
    let hosts = evaluatePerHost(f, aggregateFilter);
    if (filtered) hosts = hosts.filter((h) => h.can_place);
    const placeable = hosts.filter((h) => h.can_place).length;
    return {
        flavor: f.name,
        vcpus: f.vcpus,
        ram_mb: f.ram,
        numa_nodes: 1,
        cpu_policy: f.extra_specs?.["hw:cpu_policy"] || "shared",
        hosts,
        placeable_host_count: placeable,
        total_host_count: hosts.length,
        cached: false,
        filtered,
    };
}

export function shapeVisibility() {
    const f = FLAVORS_LIST[2]; // default m1.large
    const hosts = evaluatePerHost(f).map((row) => ({
        hostname: row.host,
        aggregate: row.aggregate,
        numa_nodes: 2,
        total_pcpus: row.total_vcpus,
        free_pcpus: row.free_vcpus,
        total_memory_mb: row.total_ram_mb,
        free_memory_mb: row.free_ram_mb,
        status: row.can_place ? "active" : "degraded",
        pockets: [],
    }));
    return {
        queried_at: new Date().toISOString(),
        environment: "ani_staging",
        total_hosts: hosts.length,
        cpu_configs: {},
        hosts,
    };
}

export function shapeVisibilityHost(hostname, flavorName) {
    const f = FLAVORS_LIST.find((x) => x.name === flavorName) || FLAVORS_LIST[2];
    const all = evaluatePerHost(f);
    const found = all.find((r) => r.host === hostname);
    return found
        ? { host: { hostname, ...found }, cpu_config: shapeCpuConfigHost(hostname), fit: { can_place: found.can_place, reason: found.reason } }
        : { host: { hostname }, fit: { can_place: false } };
}

export function shapePockets(hostFilter) {
    const all = [];
    RAW.forEach((h) => {
        if (hostFilter && h._hostname !== hostFilter) return;
        h._numa.forEach((n) => {
            if (n.free_cpu_ids.length === 0) return;
            all.push({
                id: `${h._hostname}/numa-${n.node_id}`,
                host: h._hostname,
                numa_node: n.node_id,
                free_cpus: n.free_cpus,
                free_cpu_ids: n.free_cpu_ids.slice(0, 12),
                free_memory_mb: n.free_memory_mb,
                total_cpus: n.total_cpus,
                total_memory_mb: n.total_memory_mb,
                status: h._state === "up" && h._status === "enabled" ? "active" : h._state === "down" ? "invalidated" : "consumed",
                created_at: "2026-02-04T10:00:00Z",
            });
        });
    });
    return { total: all.length, pockets: all };
}

export function shapePocketHost(hostname) {
    return { host: hostname, pockets: shapePockets(hostname).pockets };
}

export function shapeClusterReport() {
    const aggSet = [...new Set(RAW.map((h) => h._aggregate))];
    return {
        environment: "ani_staging",
        aggregates: aggSet.map((a) => {
            const hosts = RAW.filter((h) => h._aggregate === a);
            return {
                aggregate: a,
                host_count: hosts.length,
                hosts: hosts.map((h) => h._hostname),
                total_free_cpus: hosts.reduce((s, h) => s + h._freeVCpus, 0),
                total_free_memory_mb: hosts.reduce((s, h) => s + (h._ramTotalMB - h._ramUsedMB), 0),
            };
        }),
        total_hosts: RAW.length,
        fetched_at: new Date().toISOString(),
    };
}

export function shapePlacementCheck(flavorName) {
    const f = FLAVORS_LIST.find((x) => x.name === flavorName) || FLAVORS_LIST[2];
    const hosts = evaluatePerHost(f);
    const placeable = hosts.filter((h) => h.can_place);
    const best = placeable.sort((a, b) => b.free_vcpus - a.free_vcpus)[0];
    return {
        flavor: f.name,
        vcpus: f.vcpus,
        ram_mb: f.ram,
        total_host_count: hosts.length,
        placeable_host_count: placeable.length,
        best_host: best?.host ?? null,
        best_host_free_vcpus: best?.free_vcpus ?? 0,
        best_host_free_ram_mb: best?.free_ram_mb ?? 0,
        placeable: placeable.length > 0,
    };
}

export function shapeBestHost(flavorName, aggregate) {
    const f = FLAVORS_LIST.find((x) => x.name === flavorName);
    if (!f) return { found: false, reason: "unknown_flavor", message: `Unknown flavor "${flavorName}"` };
    const ranked = evaluatePerHost(f, aggregate).filter((r) => r.can_place).sort((a, b) => b.free_vcpus - a.free_vcpus);
    const best = ranked[0];
    if (!best) return { found: false, reason: "no_eligible_host", message: "No host can place this flavor", vcpus_requested: f.vcpus, ram_mb_requested: f.ram };
    const winningHost = RAW.find((h) => h._hostname === best.host);
    return {
        found: true,
        host: best.host,
        numa_node: 0,
        pocket_id: `${best.host}/numa-0`,
        derived_flavor_id: `df-${f.name.replace(/\./g, "-")}`,
        derived_flavor_name: `_internal_sched_${f.name.replace(/\./g, "_")}_p0`,
        score: 0.34,
        cpu_waste_ratio: 0.18,
        mem_waste_ratio: 0.5,
        decided_at: new Date().toISOString(),
        cpu_set: winningHost ? winningHost._dedicatedCpus.slice(winningHost._usedDedicated, winningHost._usedDedicated + f.vcpus) : [],
        eligible_numa_nodes: [0],
        flavor: f,
    };
}

export function shapeInstances(hostFilter) {
    const out = {};
    RAW.forEach((h) => {
        if (hostFilter && h._hostname !== hostFilter) return;
        const instances = {};
        h._vms.forEach((v) => {
            instances[v.uuid] = {
                uuid: v.uuid,
                name: v.name,
                state: v.state,
                vcpus: v.vcpus,
                ram_mb: v.ram_mb,
                flavor: v.flavor,
                host: h._hostname,
            };
        });
        out[h._hostname] = {
            cpu_stats: {
                cores: h._totalCpus,
                pins: h._dedicatedCpus.slice(0, h._usedDedicated),
                ram_total_mb: h._ramTotalMB,
                ram_used_mb: h._ramUsedMB,
            },
            instances,
        };
    });
    return out;
}

export function shapePlacementTrace(uuid) {
    let found = null, host = null;
    RAW.some((h) => {
        const v = h._vms.find((x) => x.uuid === uuid);
        if (v) { found = v; host = h; return true; }
        return false;
    });
    if (!found) return { vm_uuid: uuid, server: null, topology: null, placement: { error: "not found" } };
    return {
        vm_uuid: uuid,
        server: { id: uuid, name: found.name, status: found.state, host: host._hostname, hypervisor_hostname: host._hostname, flavor_id: found.flavor },
        topology: {
            numa_nodes: host._numa.map((n) => ({ id: n.node_id, cpus: n.all_cpu_ids })),
            pinned_cpus: host._dedicatedCpus.slice(0, found.vcpus),
        },
        placement: {
            allocations: { [host._hostname]: { resources: { VCPU: found.vcpus, MEMORY_MB: found.ram_mb } } },
            resource_providers: [{ uuid: host._id, name: host._hostname }],
        },
    };
}

export function shapeInfo() {
    return {
        service: "Smart Scheduler",
        version: "v0.2.1",
        environment: "ani_staging",
        endpoints: ["/info", "/health", "/healthz", "/readyz", "/hosts", "/flavors", "/instances", "/pockets", "/metrics"],
        kcs_connected: true,
        build: "2026.02.04-r1",
        git_sha: "8a3f9c2",
        region: "eu-west-1",
        uptime_seconds: 86_412,
        schedulers: 3,
        policy: "numa-aware-spread",
    };
}

export function shapeHealth() {
    return {
        status: "ok",
        version: "v0.2.1",
        environment: "ani_staging",
        checks: { nova_api: "ok", placement_api: "ok", nova_cpu_config: "ok", pockets: "ok", derived_flavors: "ok" },
    };
}

export function shapePrometheus() {
    return `# HELP scheduler_placements_total Total placement decisions
# TYPE scheduler_placements_total counter
scheduler_placements_total 18429
# HELP scheduler_placements_failed Total failed placements
# TYPE scheduler_placements_failed counter
scheduler_placements_failed 312
# HELP scheduler_decision_ms Average placement decision time in ms
# TYPE scheduler_decision_ms gauge
scheduler_decision_ms 14.3
# HELP scheduler_cache_hit_total Cache hits
# TYPE scheduler_cache_hit_total counter
scheduler_cache_hit_total 92481
# HELP scheduler_cache_miss_rate Cache miss percentage
# TYPE scheduler_cache_miss_rate gauge
scheduler_cache_miss_rate 4.7
# HELP scheduler_active_hosts Hosts currently active
# TYPE scheduler_active_hosts gauge
scheduler_active_hosts 9
# HELP scheduler_degraded_hosts Hosts in degraded state
# TYPE scheduler_degraded_hosts gauge
scheduler_degraded_hosts 5
# HELP scheduler_total_vcpus Cluster total vCPUs
# TYPE scheduler_total_vcpus gauge
scheduler_total_vcpus 1536
# HELP scheduler_free_vcpus Free vCPUs across the cluster
# TYPE scheduler_free_vcpus gauge
scheduler_free_vcpus 449
# HELP scheduler_migrations_total Live migrations executed
# TYPE scheduler_migrations_total counter
scheduler_migrations_total 2104
# HELP http_request_duration_ms HTTP request duration
# TYPE http_request_duration_ms histogram
http_request_duration_ms_count{path="/hosts"} 14238
http_request_duration_ms_sum{path="/hosts"} 482910
http_request_duration_ms_count{path="/flavors"} 8421
http_request_duration_ms_sum{path="/flavors"} 192034
`;
}

// activity log retained for Overview
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

export function sparkline(seed, base = 50, variance = 20) {
    const r = seedRand(seed);
    return Array.from({ length: 14 }, (_, i) => ({ x: i, y: Math.max(0, Math.round(base + (r() - 0.5) * variance)) }));
}
