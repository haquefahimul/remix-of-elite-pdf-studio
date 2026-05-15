import type { PageThumb } from "@/lib/pdf-render";

type Mode = "select" | "rotate" | "delete" | "view";

type PageGridProps = {
  thumbs: PageThumb[];
  /** Per-page rotation (deg) keyed by pageIndex */
  rotations?: Record<number, number>;
  /** Selected page indexes */
  selected?: Set<number>;
  /** Pages marked deleted */
  deleted?: Set<number>;
  onTogglePage?: (pageIndex: number) => void;
  /** Order of pageIndexes to render (for organize) */
  order?: number[];
  /** Drag-reorder callbacks */
  onReorder?: (from: number, to: number) => void;
  mode?: Mode;
};

export function PageGrid({
  thumbs,
  rotations = {},
  selected,
  deleted,
  onTogglePage,
  order,
  onReorder,
  mode = "view",
}: PageGridProps) {
  const list = order ?? thumbs.map((t) => t.pageIndex);
  const byIndex = new Map(thumbs.map((t) => [t.pageIndex, t]));

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {list.map((pageIndex, position) => {
        const t = byIndex.get(pageIndex);
        if (!t) return null;
        const rot = rotations[pageIndex] ?? 0;
        const isSelected = selected?.has(pageIndex);
        const isDeleted = deleted?.has(pageIndex);
        const isDeleteMode = mode === "delete";

        return (
          <button
            key={pageIndex}
            type="button"
            draggable={!!onReorder}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", String(position));
            }}
            onDragOver={(e) => {
              if (onReorder) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData("text/plain"));
              if (!Number.isNaN(from) && from !== position) onReorder?.(from, position);
            }}
            onClick={() => onTogglePage?.(pageIndex)}
            className={`group relative flex flex-col gap-2 rounded-2xl border bg-surface p-3 text-left transition-all ${
              isDeleted
                ? "border-destructive/40 opacity-50"
                : isSelected
                  ? "border-foreground shadow-elevated"
                  : "border-border hover:border-border-strong hover:shadow-soft"
            } ${onReorder ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
              <img
                src={t.dataUrl}
                alt={`Page ${pageIndex + 1}`}
                className="h-full w-full object-contain transition-transform"
                style={{ transform: `rotate(${rot}deg)` }}
                draggable={false}
              />
              {isDeleteMode && isSelected && (
                <div className="absolute inset-0 grid place-items-center bg-destructive/15 backdrop-blur-[1px]">
                  <span className="rounded-full bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground">
                    Will be removed
                  </span>
                </div>
              )}
              {isSelected && !isDeleteMode && (
                <div className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                  ✓
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Page {pageIndex + 1}</span>
              {rot !== 0 && <span>{rot}°</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
