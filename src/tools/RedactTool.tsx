import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Eraser, MousePointerClick, Trash2 } from "lucide-react";
import { PDFDocument, rgb } from "pdf-lib";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { renderThumbnails, type PageThumb } from "@/lib/pdf-render";
import { downloadBlob, baseName } from "@/lib/format";
import { FileHeader } from "./SplitTool";

type Box = {
  id: string;
  page: number; // 0-based
  // normalized coordinates 0..1 of the page
  x: number;
  y: number;
  w: number;
  h: number;
};

export function RedactTool() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [boxes, setBoxes] = useState<Box[]>([]);

  useEffect(() => {
    if (!file) return;
    let cancel = false;
    setLoading(true);
    setBoxes([]);
    file
      .arrayBuffer()
      .then((buf) => renderThumbnails(buf, { maxWidth: 720, quality: 0.85 }))
      .then((t) => !cancel && setThumbs(t))
      .catch(() => toast.error("Couldn't read that PDF."))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [file]);

  const apply = async () => {
    if (!file || boxes.length === 0) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      for (const b of boxes) {
        const page = doc.getPages()[b.page];
        if (!page) continue;
        const { width, height } = page.getSize();
        // Normalized box uses top-left origin (UI). PDF uses bottom-left.
        const x = b.x * width;
        const yTop = b.y * height;
        const w = b.w * width;
        const h = b.h * height;
        const y = height - yTop - h;
        page.drawRectangle({
          x,
          y,
          width: w,
          height: h,
          color: rgb(0, 0, 0),
          borderWidth: 0,
          opacity: 1,
        });
      }
      // Strip metadata for safety
      doc.setTitle("");
      doc.setSubject("");
      doc.setKeywords([]);
      doc.setAuthor("");
      doc.setProducer("Folio");
      doc.setCreator("Folio");
      const bytes = await doc.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)} (redacted).pdf`
      );
      toast.success("Redacted PDF ready");
    } catch (err) {
      console.error(err);
      toast.error("Redaction failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to redact"
        hint="Click and drag to draw black-out rectangles on any page"
      />
    );
  }

  const totalBoxes = boxes.length;

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-tool-redact/10">
          <Eraser className="h-5 w-5 text-tool-redact" />
        </div>
        <div className="flex-1 min-w-[10rem]">
          <p className="font-display text-lg tracking-tight">
            {totalBoxes} redaction{totalBoxes === 1 ? "" : "s"} drawn
          </p>
          <p className="text-xs text-muted-foreground">
            Drag on a page to add a rectangle · click a rectangle to remove it
          </p>
        </div>
        <button
          onClick={() => setBoxes([])}
          disabled={!totalBoxes}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:border-border-strong disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear all
        </button>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Rendering pages…</p>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {thumbs.map((t) => (
            <RedactPage
              key={t.pageIndex}
              thumb={t}
              boxes={boxes.filter((b) => b.page === t.pageIndex)}
              onAdd={(b) => setBoxes((s) => [...s, b])}
              onRemove={(id) => setBoxes((s) => s.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}

      <ActionBar
        status={
          totalBoxes
            ? "Black rectangles are flattened into the page — text under them is removed."
            : "Draw at least one rectangle to enable export"
        }
        primary={
          <button
            onClick={apply}
            disabled={busy || totalBoxes === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Applying…" : "Apply & download"}
          </button>
        }
      />
    </div>
  );
}

function RedactPage({
  thumb,
  boxes,
  onAdd,
  onRemove,
}: {
  thumb: PageThumb;
  boxes: Box[];
  onAdd: (b: Box) => void;
  onRemove: (id: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<null | { x: number; y: number; w: number; h: number }>(
    null
  );
  const start = useRef<{ x: number; y: number } | null>(null);

  const toLocal = (e: React.PointerEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  };

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Page {thumb.pageIndex + 1}
      </p>
      <div
        ref={wrapRef}
        className="relative overflow-hidden rounded-xl border border-border bg-background select-none"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          const p = toLocal(e);
          start.current = p;
          setDrawing({ x: p.x, y: p.y, w: 0, h: 0 });
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const p = toLocal(e);
          const x = Math.min(start.current.x, p.x);
          const y = Math.min(start.current.y, p.y);
          const w = Math.abs(p.x - start.current.x);
          const h = Math.abs(p.y - start.current.y);
          setDrawing({ x, y, w, h });
        }}
        onPointerUp={() => {
          if (drawing && drawing.w > 0.005 && drawing.h > 0.005) {
            onAdd({
              id: `${thumb.pageIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              page: thumb.pageIndex,
              ...drawing,
            });
          }
          start.current = null;
          setDrawing(null);
        }}
      >
        <img src={thumb.dataUrl} alt="" className="block w-full" draggable={false} />
        {boxes.map((b) => (
          <button
            key={b.id}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(b.id);
            }}
            title="Click to remove"
            className="absolute bg-black/95 ring-2 ring-black/20 hover:ring-destructive"
            style={{
              left: `${b.x * 100}%`,
              top: `${b.y * 100}%`,
              width: `${b.w * 100}%`,
              height: `${b.h * 100}%`,
            }}
          />
        ))}
        {drawing ? (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-foreground bg-foreground/30"
            style={{
              left: `${drawing.x * 100}%`,
              top: `${drawing.y * 100}%`,
              width: `${drawing.w * 100}%`,
              height: `${drawing.h * 100}%`,
            }}
          />
        ) : null}
        {boxes.length === 0 && !drawing ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/40 to-transparent p-2 text-[10px] text-white">
            <MousePointerClick className="h-3 w-3" /> Drag to redact
          </div>
        ) : null}
      </div>
    </div>
  );
}
