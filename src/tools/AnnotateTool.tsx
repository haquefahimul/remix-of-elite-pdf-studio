import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader, ModeChip, ThumbsLoading } from "./SplitTool";
import { renderThumbnails, type PageThumb } from "@/lib/pdf-render";
import { downloadBlob, baseName } from "@/lib/format";
import { Trash2 } from "lucide-react";

type Tool = "highlight" | "note";
type Annot = {
  id: string;
  page: number;
  // Normalized 0..1 (relative to page thumbnail).
  x: number;
  y: number;
  w: number;
  h: number;
  tool: Tool;
  color: string; // tailwind class hint
  rgb: [number, number, number];
  note?: string;
};

const HIGHLIGHTS: Array<{ name: string; rgb: [number, number, number] }> = [
  { name: "Yellow", rgb: [1, 0.93, 0.32] },
  { name: "Pink", rgb: [1, 0.55, 0.78] },
  { name: "Green", rgb: [0.55, 0.96, 0.6] },
  { name: "Blue", rgb: [0.6, 0.83, 1] },
];

export function AnnotateTool() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<Tool>("highlight");
  const [colorIdx, setColorIdx] = useState(0);
  const [annots, setAnnots] = useState<Annot[]>([]);
  const [editingNote, setEditingNote] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setLoading(true);
    setThumbs([]);
    setAnnots([]);
    file
      .arrayBuffer()
      .then((b) => renderThumbnails(b, { maxWidth: 360 }))
      .then((t) => !cancelled && setThumbs(t))
      .catch(() => toast.error("Couldn't read that PDF."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [file]);

  const removeAnnot = (id: string) =>
    setAnnots((prev) => prev.filter((a) => a.id !== id));

  const handleSave = async () => {
    if (!file) return;
    if (annots.length === 0) {
      toast.error("Add at least one highlight or note.");
      return;
    }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const pages = pdf.getPages();

      annots.forEach((a) => {
        const page = pages[a.page];
        if (!page) return;
        const { width, height } = page.getSize();
        const x = a.x * width;
        const w = a.w * width;
        // Normalized origin is top-left; PDF origin bottom-left.
        const y = height - (a.y + a.h) * height;
        const h = a.h * height;
        const [r, g, b] = a.rgb;

        if (a.tool === "highlight") {
          page.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            color: rgb(r, g, b),
            opacity: 0.38,
          });
        } else {
          // Note: small badge + text below, all baked in.
          const padX = 8;
          const padY = 6;
          const titleSize = 9;
          const bodySize = 9;
          const noteText = a.note ?? "";
          const wrapped = wrap(noteText, font, bodySize, w - padX * 2);
          const lineH = bodySize * 1.25;
          const totalH = titleSize + 4 + wrapped.length * lineH + padY * 2 + 4;
          // Background card (top-aligned to box top)
          page.drawRectangle({
            x,
            y: y + h - totalH,
            width: w,
            height: totalH,
            color: rgb(1, 0.97, 0.78),
            opacity: 0.95,
            borderColor: rgb(0.85, 0.65, 0.1),
            borderWidth: 0.6,
            borderOpacity: 0.7,
          });
          page.drawText("Note", {
            x: x + padX,
            y: y + h - padY - titleSize,
            size: titleSize,
            font: fontBold,
            color: rgb(0.45, 0.3, 0.05),
          });
          wrapped.forEach((line, idx) => {
            page.drawText(line, {
              x: x + padX,
              y: y + h - padY - titleSize - 4 - lineH * (idx + 1) + (lineH - bodySize) / 2,
              size: bodySize,
              font,
              color: rgb(0.2, 0.15, 0.05),
            });
          });
        }
      });

      const bytes = await pdf.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)} (annotated).pdf`,
      );
      toast.success("Annotations baked in");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save annotations.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to annotate"
        hint="Drag highlight rectangles or sticky notes on any page"
      />
    );
  }

  const colorRgb = HIGHLIGHTS[colorIdx].rgb;

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <ModeChip active={tool === "highlight"} onClick={() => setTool("highlight")}>
          Highlight
        </ModeChip>
        <ModeChip active={tool === "note"} onClick={() => setTool("note")}>
          Sticky note
        </ModeChip>
        <span className="ml-2 mr-1 text-xs text-muted-foreground">Color</span>
        {HIGHLIGHTS.map((h, i) => (
          <button
            key={h.name}
            onClick={() => setColorIdx(i)}
            aria-label={h.name}
            className={`h-7 w-7 rounded-full border-2 transition-transform ${
              colorIdx === i ? "border-foreground scale-110" : "border-border"
            }`}
            style={{
              background: `rgb(${h.rgb[0] * 255}, ${h.rgb[1] * 255}, ${h.rgb[2] * 255})`,
            }}
          />
        ))}
        {annots.length > 0 && (
          <button
            onClick={() => setAnnots([])}
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" /> Clear all
          </button>
        )}
      </div>

      <div className="mt-6">
        {loading ? (
          <ThumbsLoading />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {thumbs.map((t) => (
              <PageCanvas
                key={t.pageIndex}
                thumb={t}
                tool={tool}
                colorRgb={colorRgb}
                annots={annots.filter((a) => a.page === t.pageIndex)}
                onAdd={(a) => setAnnots((prev) => [...prev, a])}
                onRemove={removeAnnot}
                editingNote={editingNote}
                setEditingNote={setEditingNote}
                onUpdateNote={(id, text) =>
                  setAnnots((prev) =>
                    prev.map((a) => (a.id === id ? { ...a, note: text } : a)),
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      <ActionBar
        status={`${annots.length} annotation${annots.length === 1 ? "" : "s"}`}
        primary={
          <button
            onClick={handleSave}
            disabled={busy || annots.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Saving…" : "Save & download"}
          </button>
        }
      />
    </div>
  );
}

function PageCanvas({
  thumb,
  tool,
  colorRgb,
  annots,
  onAdd,
  onRemove,
  editingNote,
  setEditingNote,
  onUpdateNote,
}: {
  thumb: PageThumb;
  tool: Tool;
  colorRgb: [number, number, number];
  annots: Annot[];
  onAdd: (a: Annot) => void;
  onRemove: (id: string) => void;
  editingNote: string | null;
  setEditingNote: (id: string | null) => void;
  onUpdateNote: (id: string, text: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const norm = (e: { clientX: number; clientY: number }) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).dataset.role === "annot") return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const { x, y } = norm(e);
    startRef.current = { x, y };
    setDraft({ x, y, w: 0, h: 0 });
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    const { x, y } = norm(e);
    const sx = Math.min(startRef.current.x, x);
    const sy = Math.min(startRef.current.y, y);
    const ex = Math.max(startRef.current.x, x);
    const ey = Math.max(startRef.current.y, y);
    setDraft({ x: sx, y: sy, w: ex - sx, h: ey - sy });
  };
  const onPointerUp = () => {
    if (draft && draft.w > 0.005 && draft.h > 0.005) {
      const id = `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const minH = tool === "note" ? 0.06 : draft.h;
      onAdd({
        id,
        page: thumb.pageIndex,
        x: draft.x,
        y: draft.y,
        w: draft.w,
        h: Math.max(minH, draft.h),
        tool,
        color: tool === "note" ? "amber" : "yellow",
        rgb: tool === "note" ? [1, 0.93, 0.32] : colorRgb,
        note: tool === "note" ? "" : undefined,
      });
      if (tool === "note") setEditingNote(id);
    }
    setDraft(null);
    startRef.current = null;
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
      <div className="border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
        Page {thumb.pageIndex + 1}
      </div>
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative cursor-crosshair select-none touch-none"
        style={{ aspectRatio: `${thumb.width} / ${thumb.height}` }}
      >
        <img
          src={thumb.dataUrl}
          alt={`Page ${thumb.pageIndex + 1}`}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        {annots.map((a) => (
          <div
            key={a.id}
            data-role="annot"
            className="group absolute"
            style={{
              left: `${a.x * 100}%`,
              top: `${a.y * 100}%`,
              width: `${a.w * 100}%`,
              height: `${a.h * 100}%`,
            }}
          >
            <div
              className="absolute inset-0 rounded-[2px]"
              style={{
                background:
                  a.tool === "highlight"
                    ? `rgba(${a.rgb[0] * 255}, ${a.rgb[1] * 255}, ${a.rgb[2] * 255}, 0.45)`
                    : "rgba(255, 247, 199, 0.95)",
                outline: a.tool === "note" ? "1px solid rgba(180, 140, 20, 0.6)" : undefined,
              }}
            />
            {a.tool === "note" && (
              <div className="absolute inset-0 overflow-hidden p-1.5 text-[10px] leading-tight text-amber-900">
                {editingNote === a.id ? (
                  <textarea
                    autoFocus
                    value={a.note ?? ""}
                    onChange={(e) => onUpdateNote(a.id, e.target.value)}
                    onBlur={() => setEditingNote(null)}
                    className="h-full w-full resize-none border-0 bg-transparent text-[10px] outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingNote(a.id)}
                    className="h-full w-full text-left"
                  >
                    {a.note?.trim() || <span className="text-amber-900/60">Click to edit…</span>}
                  </button>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(a.id);
              }}
              className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-foreground text-background opacity-0 shadow-soft transition-opacity group-hover:opacity-100"
              aria-label="Remove"
            >
              ×
            </button>
          </div>
        ))}
        {draft && (draft.w > 0 || draft.h > 0) && (
          <div
            className="absolute border-2 border-dashed border-foreground/70"
            style={{
              left: `${draft.x * 100}%`,
              top: `${draft.y * 100}%`,
              width: `${draft.w * 100}%`,
              height: `${draft.h * 100}%`,
              background:
                tool === "highlight"
                  ? `rgba(${colorRgb[0] * 255}, ${colorRgb[1] * 255}, ${colorRgb[2] * 255}, 0.35)`
                  : "rgba(255, 247, 199, 0.7)",
            }}
          />
        )}
      </div>
    </div>
  );
}

function wrap(
  text: string,
  font: { widthOfTextAtSize: (s: string, sz: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  if (!text) return [""];
  const lines: string[] = [];
  for (const para of text.split(/\n/)) {
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    if (lines.length > 12) break;
  }
  return lines.slice(0, 12);
}
