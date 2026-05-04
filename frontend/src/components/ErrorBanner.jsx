import { AlertTriangle, RotateCw } from "lucide-react";

export default function ErrorBanner({ message = "Something went wrong", onRetry }) {
    return (
        <div data-testid="error-banner" className="flex items-center justify-between gap-3 px-4 py-3 rounded-md border border-danger/40 bg-danger/10 text-danger">
            <div className="flex items-center gap-2 text-[13px]">
                <AlertTriangle className="w-4 h-4" />
                <span>{message}</span>
            </div>
            {onRetry && (
                <button
                    onClick={onRetry}
                    data-testid="error-retry-btn"
                    className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded border border-danger/40 hover:bg-danger/20"
                >
                    <RotateCw className="w-3 h-3" /> Retry
                </button>
            )}
        </div>
    );
}
