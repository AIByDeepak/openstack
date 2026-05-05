import { Sparkles, ArrowRight } from "lucide-react";

const META = {
    aggregates: {
        title: "Aggregates",
        description: "Group hosts by capability, locality, or hardware tier. Roll up free capacity and place workloads with surgical precision.",
        features: ["Tag-based aggregate authoring", "Capability-aware routing rules", "Per-aggregate utilisation timeline", "Cross-region aggregate sync"],
    },
    "vm-placement": {
        title: "VM Placement",
        description: "Drag-and-drop placement workbench with NUMA-aware previews and what-if simulations.",
        features: ["What-if simulator", "Anti-affinity & spread rules", "GPU topology preview", "Bulk placement queue"],
    },
    migration: {
        title: "Live Migration",
        description: "Plan and execute live migrations with zero-downtime traffic draining and post-migration validation.",
        features: ["Drift-aware host scoring", "Cutover scheduling", "Rollback timeline", "Bandwidth budget enforcement"],
    },
    settings: {
        title: "Settings",
        description: "Tune the scheduler to your environment — refresh cadence, agent thresholds, retention windows, and theme.",
        features: ["Auto-refresh interval (5-300s)", "Agent unreachable threshold", "Activity log retention", "Notification webhooks"],
    },
    "not-found": {
        title: "Page not found",
        description: "The route you requested isn't available. It may have moved or never existed.",
        features: ["Use the sidebar to jump to an active page", "Migration & Masakari is intentionally not included — Masakari is not exposed by the backend"],
    },
};

export default function ComingSoon({ slug }) {
    const m = META[slug] || { title: "Coming Soon", description: "This module is under construction.", features: [] };

    return (
        <div className="animate-fade-up">
            <div className="relative rounded-lg border border-border bg-card overflow-hidden">
                <div className="absolute inset-0 grid-pattern opacity-30 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/60 to-card pointer-events-none" />
                <div className="relative grid lg:grid-cols-2 gap-8 p-8 lg:p-12">
                    <div>
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] px-2 py-1 rounded bg-accent-soft text-accent border border-accent/30">
                            <Sparkles className="w-3 h-3" /> Coming soon
                        </span>
                        <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight mt-4">{m.title}</h1>
                        <p className="text-[14px] text-muted-foreground mt-3 max-w-md leading-relaxed">{m.description}</p>

                        <ul className="mt-6 space-y-2.5">
                            {m.features.map((f) => (
                                <li key={f} className="flex items-center gap-2 text-[13px] font-mono text-muted-foreground">
                                    <ArrowRight className="w-3 h-3 text-accent" /> {f}
                                </li>
                            ))}
                        </ul>

                        <button className="mt-8 inline-flex items-center gap-2 px-4 h-10 rounded-md bg-accent text-white text-[13px] font-medium hover:bg-accent/90" data-testid={`waitlist-${slug}`}>
                            Notify me when this ships <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="relative">
                        <div className="rounded-md border border-border bg-card-elev/50 p-4 backdrop-blur-sm relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-tr from-accent/5 via-transparent to-teal/5 pointer-events-none" />
                            <div className="space-y-3 blur-[1.5px]">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 rounded border border-border bg-card">
                                        <div className="w-6 h-6 rounded-sm bg-accent/30" />
                                        <div className="flex-1">
                                            <div className="h-2 bg-card-elev rounded w-3/4" />
                                            <div className="h-1.5 bg-card-elev rounded mt-2 w-1/2 opacity-60" />
                                        </div>
                                        <div className="w-12 h-4 bg-card-elev rounded" />
                                    </div>
                                ))}
                            </div>
                            <div className="absolute inset-0 grid place-items-center">
                                <span className="text-[11px] font-mono uppercase tracking-[0.2em] px-3 py-1.5 rounded bg-bg/80 border border-border backdrop-blur">
                                    preview locked
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
