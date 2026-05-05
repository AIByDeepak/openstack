# Smart Scheduler v2.0 Dashboard — PRD

## Original problem statement
Production-quality OpenStack NUMA-aware VM placement dashboard ("Smart Scheduler v2.0"). Live-first wiring to `http://10.232.80.241:31597` with mock fallback (mixed-content blocked from the preview environment, so MOCK DATA badge is visible). React + JSX (no TS), strict dark theme (#0f1117 / #1e2130 / #1a1d27 / #6366f1).

## Architecture
- React 19 + React Router v7 + Tailwind + shadcn/ui
- Zustand UI store for `isMockMode` + endpoint error tracking
- `@tanstack/react-virtual` for 1000+ row tables (Visibility, Instances)
- `useAutoFetch` hook (default 600 s, 60 s health, 15 s metrics)
- All fetchers wrapped: `apiFetch(path, mockFn) → { data, isMock }`
- `SKIP_LIVE` short-circuit when site is HTTPS but API_BASE is HTTP

## Sidebar nav (3 groups)
- **Monitoring** — Overview, Hosts, CPU Config, Pockets, Instances
- **Scheduler** — Flavor Visibility, Host Aggregator, VM Placement
- **System** — Metrics, Settings (Coming Soon)

(Migration & Masakari intentionally removed — not in the backend per the API map.)

## Implemented (2026-02-04 → 2026-02-05)
- TopBar with `/info`-driven version + env badge, `kcs_connected` green dot, **MOCK DATA** badge, 3 health dots polling every 60 s, auto-refresh switch (10 min), manual refresh with spin, 'Updated X ago' stale label (amber after 10 min)
- **Overview** — 4 KPI cards w/ sparklines, /info system info card, /metrics scheduler counters + 2 area charts, color-coded vCPU horizontal bar chart, Quick Placement Check tool, 10-event activity log
- **Hosts** — left filters (status / dedicated / free vCPU sliders), search, sortable cols, agent dot, pagination, slide-out drawer with **4 tabs (Summary / VMs / CPU Config / Capacity)** — Capacity tab calls `/hosts/vm-capacity/{h}` and shows `can_place` + eligible NUMA + free-after counts
- **CPU Config** — per-host expandable cards, dedicated/shared bar, 20×20 visual CPU grid, CPU pills, raw cpuset strings, copy buttons
- **Pockets** — animated carousel with NUMA bar chart + category pie, prev/next, dot indicators, auto-advance every 8 s
- **Instances** — virtualised table (100+ rows), search debounced, row click opens drawer with `/instances/{uuid}/placement-trace` timeline, copy UUID
- **Flavor Visibility** — flavor + aggregate selects, search, CSV export, Table / Heatmap / Chart toggle, virtualised table, responsive heatmap with S/M/L size toggle, side panel
- **Host Aggregator** — split panel: aggregate cards left, detail right with hosts table (top-5 starred), multi-flavor comparison (up to 4), Detail/Matrix view toggle (matrix = flavors × aggregates with color-coded cells)
- **VM Placement** — 3-step wizard: Step 1 best-host finder with score/derived flavor/alternatives → Step 2 NUMA pin preview + 5 constraint checks → Step 3 success card with placement trace timeline; recent placements table at bottom
- **Metrics** — 6 KPI cards parsed from raw Prometheus text, area + line charts, raw text panel with copy
- **Settings / 404** — Coming-soon pages with blurred mockup
- **API mock layer** — every endpoint from the API map (30+ routes) shaped exactly like the real responses (e.g. `pcpu.{free,used,total}`, `numa_nodes[].{node_id,free_cpu_ids,...}`, `placeable_host_count`)

## Test status
- Iteration 1: 53/58 (~91 %) on initial dashboard
- Iteration 2: 14/14 (100 %) on full v2.x build with Capacity tab + sidebar regroup + Masakari removal

## Backlog (P1+)
- **P1**: When `10.232.80.241:31597` is reachable from the host, the live data switches automatically — no code change. SKIP_LIVE only triggers in the HTTPS-preview env.
- **P1**: Build out a real Settings page (refresh-interval slider, agent thresholds, webhook notifications)
- **P2**: WebSocket subscription for activity log instead of 30 s poll
- **P2**: Saved searches / per-user filters
- **P3**: Silence Recharts width/height mount warnings via explicit minWidth on ResponsiveContainer parents
- **P3**: Tie manual-refresh spinner to actual refetch completion instead of fixed 700 ms
