import { Inbox } from "lucide-react";

export default function EmptyState({ title = "No data", description = "There is nothing to display here yet.", icon: Icon = Inbox, action }) {
    return (
        <div data-testid="empty-state" className="flex flex-col items-center justify-center py-16 px-6 text-center border border-dashed border-border rounded-lg bg-card/40">
            <div className="w-12 h-12 rounded-full grid place-items-center bg-card-elev border border-border mb-4">
                <Icon className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium">{title}</h3>
            <p className="text-[12px] text-muted-foreground mt-1 max-w-sm">{description}</p>
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
