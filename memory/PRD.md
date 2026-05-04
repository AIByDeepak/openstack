# Smart Scheduler Dashboard — PRD

## Original problem statement
Production-quality OpenStack NUMA-aware VM placement dashboard ("Smart Scheduler v2.0") with 5 fully-built pages (Overview, Hosts, CPU Config, Flavor Visibility, Pockets) and 4 coming-soon pages (VM Placement, Aggregates, Migration, Settings). Strict dark theme (#0f1117 / #1e2130 / #1a1d27 / #6366f1). Mock data shaped exactly like the real API at `http://10.232.80.241:31597`.

## Architecture
- React 19 + React Router v7 + CRACO + Tailwind + shadcn/ui (no backend, no MongoDB)
- Frontend-only with hardcoded fixtures in `src/lib/mockData.js`
- Mock fetcher layer in `src/lib/api.js` with simulated 60–420ms latency
- DashboardContext provides auto-refresh tick + version + env + manual-refresh callback
- Recharts for sparklines, area charts, bar charts, pie chart
- Sonner for toasts; tooltips via Radix
- IBM Plex Sans (body) + JetBrains Mono (code/values)

## User personas
- **Cluster operator** — needs at-a-glance health, free capacity, agent status
- **Capacity planner** — needs flavor visibility, NUMA pocket breakdown
- **On-call SRE** — needs activity log, placement-check tool, drilldown into hosts

## Core (static) requirements
- Dark theme strict to spec colors
- Sidebar 240px with grouped nav (Monitoring/Scheduler/System) + COMING SOON badges
- Top bar: version badge, env badge (amber), 3 health dots (`/health` `/healthz` `/readyz`), search, auto-refresh switch (30s default ON), manual-refresh button with spin animation
- All shipped pages have loading skeletons, error retry banners, empty states, sonner toasts on refresh

## Implemented (2026-02-04)
- **Overview** — 4 KPI cards w/ sparklines + trend %, /info system info card, /metrics panel (5 counters + 2 area charts), color-coded vCPU bar chart, Quick Placement Check tool, 10-event activity log
- **Hosts** — left filters panel (status checkboxes, dedicated/free vCPU dual sliders), search, sortable columns, row checkboxes + bulk-select, agent-status dot per row, pagination (20/page), inline View/SSH/Reboot, slide-out drawer with Summary / VMs / CPU Config tabs
- **CPU Config** — per-host expandable cards with dedicated/shared progress bar, 20×20 visual CPU grid (blue dedicated / teal shared), CPU pill tags, raw cpuset strings
- **Flavor Visibility** — flavor select, summary KPIs, can/cannot filter toggle, 55/45 split with chart left and table/heatmap right (heatmap: 40×40 squares colored by can_place)
- **Pockets** — animated carousel with NUMA bar chart + category pie per slide, prev/next, dot indicators, auto-advance every 8s
- **Aggregates / VM Placement / Migration / Settings** — coming-soon pages with blurred mockup + feature list + waitlist CTA
- **API mock layer** — covers /info, /metrics, /health, /healthz, /readyz, /hosts (+ aggregate filter), /hosts/list, /hosts/agent-status, /hosts/numa-topology, /hosts/{h}/vms, /hosts/cpu-config, /hosts/cpu-pins, /hosts/cluster/flavor-visibility, /pockets, /flavors, /flavors/{f}/placement, /hosts/placement-check, /hosts/best-host, /hosts/cluster-numa-capacity-report, /instances/{u}/placement-trace
- **Health pings** randomly flip one dot amber every 7th cycle then recover, per spec

## Backlog
- **P1**: Live API proxy (FastAPI + httpx) to call `http://10.232.80.241:31597` server-side once that IP is reachable; cache layer for `/hosts/cpu-pins` and `/hosts/visibility`
- **P1**: Build out VM Placement page (drag-and-drop placement workbench + what-if simulator)
- **P2**: Build Aggregates page (member host management, metadata KV editor, flavor→aggregate mapping)
- **P2**: Build Migration page (live VM migration tracker, NUMA-aware destination selector)
- **P2**: Real Settings page (refresh interval slider, agent thresholds, theme variants, webhook notifications)
- **P2**: CSV export endpoints (`/hosts/visibility/csv`)
- **P3**: WebSocket subscription for activity log push instead of 30s poll
- **P3**: Persistent saved searches/filters per user
- **P3**: Add minHeight to ResponsiveContainer parents to silence Recharts mount warnings

## Test status
- Iteration 1: 53/58 frontend checks passed (~91%); 0 blocking issues; 2 optional LOW notes (slug-based waitlist testid; non-blocking Recharts mount warnings)
