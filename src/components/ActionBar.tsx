import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function ActionBar({
  primary,
  secondary,
  status,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  status?: string;
}) {
  return (
    <div className="sticky bottom-4 z-30 mt-8 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface/90 px-4 py-3 shadow-elevated backdrop-blur-xl">
      <div className="text-sm text-muted-foreground">{status}</div>
      <div className="flex items-center gap-2">
        {secondary}
        {primary}
      </div>
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}
