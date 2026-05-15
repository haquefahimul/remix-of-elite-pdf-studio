import { useEffect, useRef, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { toast } from "sonner";
import { Type, Highlighter, Trash2 } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName } from "@/lib/format";
import { renderThumbnails, type PageThumb } from "@/lib/pdf-render";
import { FileHeader, ThumbsLoading } from "./SplitTool";

type Annotation =
  | { id: string; kind: "text"; pageIndex: number; x: number; y: number; w: number; h: number; text: string; size: number; color: string }
  | { id: string; kind: "highlight"; pageIndex: number; x: number; y: number; w: number; h: number; color: string };

type Tool = "text" | "highlight";

export function EditTool() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<Tool>("text");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [color, setColor] = useState("#111827");
  const [highlightColor, setHighlightColor] = useState("#fde68a");
  const [size, setSize] = useState(14);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setLoading(true);
    setAnnotations([]);
    setThumbs([]);
    file
      .arrayBuffer()
      .then((buf) => renderThumbnails(buf, { maxWidth: 320 }))
      .then((t) => !cancelled && setThumbs(t))
      .catch(() => toast.error("Couldn't read that PDF."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [file]);

  const addAnnotation = (pageIndex: number, x: number, y: number) => {
    const id = `${Date.now()}-${Math.random()}`;
    if (tool === "text") {
      setAnnotations((prev) => [...prev, { id, kind: "text", pageIndex, x, y, w: 0.3, h: 0.04, text: "Edit me", size, color }]);
    } else {
      setAnnotations((prev) => [...prev, { id, kind: "highlight", pageIndex, x, y, w: 0.3, h: 0.025, color: highlightColor }]);
    }
  };

  const updateAnnotation = (id: string, patch: Partial<Annotation>) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a)));
  };
  const removeAnnotation = (id: string) => setAnnotations((prev) => prev.filter((a) => a.id !== id));

  const handleSave = async () => {
    if (!file) return;
    if (annotations.length === 0) return toast.error("Add at least one annotation.");
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();

      for (const a of annotations) {
        const page = pages[a.pageIndex];
        if (!page) continue;
        const { width, height } = page.getSize();
        const px = a.x * width;
        const w = a.w * width;
        const h = a.h * height;
        const py = (1 - a.y) * height - h;

        if (a.kind === "text") {
          const c = hexToRgb(a.color);
          page.drawText(a.text, { x: px, y: py + h - a.size, size: a.size, font, color: rgb(c.r, c.g, c.b), maxWidth: w });
        } else {
          const c = hexToRgb(a.color);
          page.drawRectangle({ x: px, y: py, width: w, height: h, color: rgb(c.r, c.g, c.b), opacity: 0.5 });
        }
      }

      const bytes = await doc.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${baseName(file.name)} (edited).pdf`);
      toast.success("Edited PDF ready");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save edits.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return <Dropzone accept="pdf" onFiles={(f) => setFile(f[0])} title="Drop a PDF to edit" hint="or click to browse" />;
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => { setFile(null); setAnnotations([]); }} />

      <div className="mt-6 grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
          <div className="flex gap-2">
            <ChipBtn active={tool === "text"} onClick={() => setTool("text")}>
              <Type className="h-4 w-4" /> Text
            </ChipBtn>
            <ChipBtn active={tool === "highlight"} onClick={() => setTool("highlight")}>
              <Highlighter className="h-4 w-4" /> Highlight
            </ChipBtn>
          </div>

          {tool === "text" ? (
            <>
              <Field label="Text color">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-background" />
              </Field>
              <Field label={`Default size · ${size}pt`}>
                <input type="range" min={8} max={48} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full accent-foreground" />
              </Field>
            </>
          ) : (
            <Field label="Highlight color">
              <input type="color" value={highlightColor} onChange={(e) => setHighlightColor(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-background" />
            </Field>
          )}

          <p className="rounded-xl bg-accent px-3 py-2 text-xs text-muted-foreground">
            Click a page to place. Drag to move, edit text inline, use handle to resize. Click × to delete.
          </p>
        </div>

        <div>
          {loading ? <ThumbsLoading /> : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {thumbs.map((t) => (
                <EditPage
                  key={t.pageIndex}
                  thumb={t}
                  annotations={annotations.filter((a) => a.pageIndex === t.pageIndex)}
                  onPlace={(x, y) => addAnnotation(t.pageIndex, x, y)}
                  onUpdate={updateAnnotation}
                  onRemove={removeAnnotation}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ActionBar
        status={`${annotations.length} annotation${annotations.length === 1 ? "" : "s"}`}
        primary={
          <button
            onClick={handleSave}
            disabled={busy || annotations.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Saving…" : "Save & download"}
          </button>
        }
      />
    </div>
  );
}

function EditPage({
  thumb, annotations, onPlace, onUpdate, onRemove,
}: {
  thumb: PageThumb;
  annotations: Annotation[];
  onPlace: (x: number, y: number) => void;
  onUpdate: (id: string, patch: Partial<Annotation>) => void;
  onRemove: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offX: number; offY: number; mode: "move" | "resize" } | null>(null);

  const onMouseDown = (e: React.MouseEvent, a: Annotation, mode: "move" | "resize") => {
    e.stopPropagation();
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    dragRef.current = {
      id: a.id,
      offX: e.clientX - rect.left - a.x * rect.width,
      offY: e.clientY - rect.top - a.y * rect.height,
      mode,
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const ann = annotations.find((a) => a.id === d.id);
      if (!ann) return;
      if (d.mode === "move") {
        const x = (e.clientX - rect.left - d.offX) / rect.width;
        const y = (e.clientY - rect.top - d.offY) / rect.height;
        onUpdate(d.id, { x: clamp(x, 0, 1 - ann.w), y: clamp(y, 0, 1 - ann.h) });
      } else {
        const w = (e.clientX - rect.left) / rect.width - ann.x;
        const h = (e.clientY - rect.top) / rect.height - ann.y;
        onUpdate(d.id, { w: clamp(w, 0.05, 1 - ann.x), h: clamp(h, 0.02, 1 - ann.y) });
      }
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [annotations, onUpdate]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div
        ref={ref}
        onClick={(e) => {
          if (!ref.current) return;
          if ((e.target as HTMLElement).closest("[data-anno]")) return;
          const r = ref.current.getBoundingClientRect();
          onPlace((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
        }}
        className="relative aspect-[3/4] cursor-crosshair overflow-hidden rounded-lg bg-muted select-none"
      >
        <img src={thumb.dataUrl} alt={`Page ${thumb.pageIndex + 1}`} className="h-full w-full object-contain" draggable={false} />
        {annotations.map((a) => (
          <div
            key={a.id}
            data-anno
            className="absolute group"
            style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }}
          >
            {a.kind === "highlight" ? (
              <div onMouseDown={(e) => onMouseDown(e, a, "move")} className="h-full w-full cursor-move rounded" style={{ backgroundColor: a.color, opacity: 0.55 }} />
            ) : (
              <div className="relative h-full w-full">
                <div onMouseDown={(e) => onMouseDown(e, a, "move")} className="absolute -top-3 left-0 h-3 w-full cursor-move rounded-t bg-foreground/40" />
                <input
                  value={a.text}
                  onChange={(e) => onUpdate(a.id, { text: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="h-full w-full border border-dashed border-foreground/40 bg-background/60 px-1 outline-none"
                  style={{ color: a.color, fontSize: `${Math.max(8, a.size * 0.6)}px` }}
                />
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(a.id); }}
              className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-soft transition-opacity group-hover:opacity-100"
              aria-label="Remove"
            >
              <Trash2 className="h-3 w-3" />
            </button>
            <div
              onMouseDown={(e) => onMouseDown(e, a, "resize")}
              className="absolute -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize rounded-sm bg-foreground/70 opacity-0 transition-opacity group-hover:opacity-100"
            />
          </div>
        ))}
      </div>
      <p className="mt-2 px-1 text-xs text-muted-foreground">Page {thumb.pageIndex + 1}</p>
    </div>
  );
}

function ChipBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-accent"}`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "");
  const n = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  return {
    r: parseInt(n.slice(0, 2), 16) / 255,
    g: parseInt(n.slice(2, 4), 16) / 255,
    b: parseInt(n.slice(4, 6), 16) / 255,
  };
}
