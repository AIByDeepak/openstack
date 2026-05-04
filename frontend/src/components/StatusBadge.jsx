const MAP = {
    Active: { color: "text-success", dot: "bg-success", border: "border-success/30", bg: "bg-success/10" },
    Degraded: { color: "text-warning", dot: "bg-warning", border: "border-warning/30", bg: "bg-warning/10" },
    Down: { color: "text-danger", dot: "bg-danger", border: "border-danger/30", bg: "bg-danger/10" },
    ACTIVE: { color: "text-success", dot: "bg-success", border: "border-success/30", bg: "bg-success/10" },
    PAUSED: { color: "text-warning", dot: "bg-warning", border: "border-warning/30", bg: "bg-warning/10" },
    ERROR: { color: "text-danger", dot: "bg-danger", border: "border-danger/30", bg: "bg-danger/10" },
    BUILDING: { color: "text-info", dot: "bg-info", border: "border-info/30", bg: "bg-info/10" },
};

export default function StatusBadge({ status, className = "" }) {
    const s = MAP[status] || MAP.Active;
    return (
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded border ${s.color} ${s.border} ${s.bg} ${className}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === "Active" || status === "ACTIVE" ? "live-dot" : ""}`} />
            {status}
        </span>
    );
}
