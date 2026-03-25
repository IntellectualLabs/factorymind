import { Loader2 } from "lucide-react";

export default function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
        <p className="text-sm text-slate-400">{message}</p>
      </div>
    </div>
  );
}
