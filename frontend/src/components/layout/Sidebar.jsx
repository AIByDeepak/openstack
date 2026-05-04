import { NavLink } from "react-router-dom";
import {
    LayoutDashboard,
    Server,
    Cpu,
    Eye,
    Boxes,
    Layers3,
    Rocket,
    ArrowRightLeft,
    Settings,
    CircleDot,
    Activity,
    Gauge,
    Container,
} from "lucide-react";

const GROUPS = [
    {
        label: "Monitoring",
        items: [
            { to: "/", label: "Overview", icon: LayoutDashboard },
            { to: "/hosts", label: "Hosts", icon: Server },
            { to: "/cpu-config", label: "CPU Config", icon: Cpu },
            { to: "/pockets", label: "Pockets", icon: Boxes },
            { to: "/instances", label: "Instances", icon: Container },
        ],
    },
    {
        label: "v2.1",
        items: [{ to: "/visibility", label: "Flavor Visibility", icon: Eye, live: "indigo" }],
    },
    {
        label: "v2.2",
        items: [{ to: "/aggregator", label: "Host Aggregator", icon: Layers3, live: "teal" }],
    },
    {
        label: "v2.3",
        items: [
            { to: "/placement", label: "VM Placement", icon: Rocket, live: "coral" },
            { to: "/migration", label: "Migration & Masakari", icon: ArrowRightLeft, live: "coral" },
        ],
    },
    {
        label: "System",
        items: [
            { to: "/metrics", label: "Metrics", icon: Gauge },
            { to: "/settings", label: "Settings", icon: Settings, soon: true },
        ],
    },
];

const LIVE_COLOR = {
    indigo: "bg-accent/20 text-accent border-accent/30",
    teal: "bg-teal/20 text-teal border-teal/30",
    coral: "bg-danger/20 text-danger border-danger/30",
};

export default function Sidebar() {
    return (
        <aside
            data-testid="app-sidebar"
            className="hidden md:flex flex-col w-[240px] shrink-0 border-r border-border bg-sidebar h-screen sticky top-0"
        >
            <div className="px-5 py-5 flex items-center gap-2.5 border-b border-border">
                <div className="w-8 h-8 rounded-md bg-accent grid place-items-center shadow-[0_0_0_1px_hsl(var(--accent)/0.4),0_8px_24px_-4px_hsl(var(--accent)/0.6)]">
                    <CircleDot className="w-4 h-4 text-white" />
                </div>
                <div>
                    <div className="text-[13px] font-semibold tracking-tight leading-none">SS v2.0</div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1">smart scheduler</div>
                </div>
            </div>

            <nav className="flex-1 py-3 px-2 overflow-y-auto">
                {GROUPS.map((group) => (
                    <div key={group.label} className="mt-3 first:mt-1">
                        <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/70 flex items-center gap-2">
                            {group.label}
                            {group.label.startsWith("v2") && (
                                <span className="w-1 h-1 rounded-full bg-accent live-dot" />
                            )}
                        </div>
                        {group.items.map(({ to, label, icon: Icon, soon, live }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={to === "/"}
                                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "and")}`}
                                className={({ isActive }) =>
                                    [
                                        "group flex items-center gap-3 px-3 py-2 mx-1 my-0.5 rounded-md text-[13px] transition-colors",
                                        "hover:bg-card-elev hover:text-foreground",
                                        isActive
                                            ? "bg-accent-soft text-foreground border-l-2 border-accent pl-[10px]"
                                            : "text-muted-foreground",
                                    ].join(" ")
                                }
                            >
                                <Icon className="w-4 h-4" />
                                <span className="flex-1">{label}</span>
                                {live && (
                                    <span className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-mono ${LIVE_COLOR[live]}`}>
                                        live
                                    </span>
                                )}
                                {soon && (
                                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-card-elev text-muted-foreground border border-border">
                                        Soon
                                    </span>
                                )}
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            <div className="px-4 py-4 border-t border-border text-[11px] text-muted-foreground font-mono">
                <div className="flex items-center gap-2">
                    <Activity className="w-3 h-3 text-success" />
                    <span>scheduler online</span>
                </div>
                <div className="mt-1 opacity-70">build 2026.02 · region eu-west-1</div>
            </div>
        </aside>
    );
}
