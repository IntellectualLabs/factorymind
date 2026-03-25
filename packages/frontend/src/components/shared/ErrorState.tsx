import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  message = "Something went wrong. Please try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-slate-400">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-200 bg-slate-800 border border-factory-border rounded-lg hover:border-slate-500 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
