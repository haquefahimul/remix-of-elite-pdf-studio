import { useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Eraser, Check } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName } from "@/lib/format";
import { renderThumbnails, type PageThumb } from "@/lib/pdf-render";
import { FileHeader, ThumbsLoading } from "./SplitTool";

type Placement = {
  pageIndex: number;
  /** 0–1 normalized to page width/height (top-left origin) */
  x: number;
  y: number;
  scale: number;
};

export function SignTool() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [scale, setScale] = useState(0.25);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setLoading(true);
    setThumbs([]);
    setPlacements([]);
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

  const handlePlace = (pageIndex: number, x: number, y: number) => {
    if (!signature) return toast.error("Draw a signature first.");
    setPlacements((prev) => [...prev, { pageIndex, x, y, scale }]);
  };

  const handleRemove = (idx: number) => setPlacements((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!file) return;
    if (!signature || placements.length === 0) return toast.error("Draw a signature and place it on at least one page.");

    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const pngBytes = dataUrlToUint8(signature);
      const png = await doc.embedPng(pngBytes);
      const pages = doc.getPages();

      for (const pl of placements) {
        const page = pages[pl.pageIndex];
        if (!page) continue;
        const { width, height } = page.getSize();
        const w = width * pl.scale;
        const h = (png.height / png.width) * w;
        // x,y in normalized coords with top-left origin → convert to pdf bottom-left
        const px = pl.x * width - w / 2;
        const py = (1 - pl.y) * height - h / 2;
        page.drawImage(png, { x: px, y: py, width: w, height: h });
      }

      const bytes = await doc.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${baseName(file.name)} (signed).pdf`);
      toast.success("Signed PDF ready");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't sign that PDF.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return <Dropzone accept="pdf" onFiles={(f) => setFile(f[0])} title="Drop a PDF to sign" hint="or click to browse" />;
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => { setFile(null); setSignature(null); setPlacements([]); }} />

      <div className="mt-6 grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Your signature</p>
            <SignaturePad value={signature} onChange={setSignature} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Size · {Math.round(scale * 100)}% page width</p>
            <input type="range" min={10} max={60} value={scale * 100} onChange={(e) => setScale(Number(e.target.value) / 100)} className="w-full accent-foreground" />
          </div>
          <p className="rounded-xl bg-accent px-3 py-2 text-xs text-muted-foreground">
            {signature ? "Click anywhere on a page to place the signature." : "Draw your signature, then click pages to place."}
          </p>
          {placements.length > 0 && (
            <button onClick={() => setPlacements([])} className="w-full rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
              Clear {placements.length} placement{placements.length === 1 ? "" : "s"}
            </button>
          )}
        </div>

        <div>
          {loading ? <ThumbsLoading /> : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {thumbs.map((t) => (
                <PageDropTarget
                  key={t.pageIndex}
                  thumb={t}
                  signature={signature}
                  scale={scale}
                  placements={placements.filter((p) => p.pageIndex === t.pageIndex)}
                  onPlace={(x, y) => handlePlace(t.pageIndex, x, y)}
                  onRemove={(localIdx) => {
                    const all = placements;
                    let count = -1;
                    const globalIdx = all.findIndex((p) => p.pageIndex === t.pageIndex && ++count === localIdx);
                    if (globalIdx >= 0) handleRemove(globalIdx);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ActionBar
        status={`${placements.length} placement${placements.length === 1 ? "" : "s"}`}
        primary={
          <button
            onClick={handleSave}
            disabled={busy || !signature || placements.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Signing…" : "Sign & download"}
          </button>
        }
      />
    </div>
  );
}

function PageDropTarget({
  thumb, signature, scale, placements, onPlace, onRemove,
}: {
  thumb: PageThumb; signature: string | null; scale: number;
  placements: Placement[]; onPlace: (x: number, y: number) => void;
  onRemove: (localIdx: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div
        ref={ref}
        onClick={(e) => {
          if (!ref.current || !signature) return;
          const rect = ref.current.getBoundingClientRect();
          onPlace((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
        }}
        className={`relative aspect-[3/4] overflow-hidden rounded-lg bg-muted ${signature ? "cursor-crosshair" : ""}`}
      >
        <img src={thumb.dataUrl} alt={`Page ${thumb.pageIndex + 1}`} className="h-full w-full object-contain" draggable={false} />
        {placements.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(i); }}
            className="absolute group"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: "translate(-50%, -50%)", width: `${p.scale * 100}%` }}
            aria-label="Remove placement"
          >
            {signature && <img src={signature} alt="" className="w-full opacity-90" draggable={false} />}
            <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-destructive text-[8px] text-destructive-foreground opacity-0 group-hover:opacity-100">×</span>
          </button>
        ))}
      </div>
      <p className="mt-2 px-1 text-xs text-muted-foreground">Page {thumb.pageIndex + 1}</p>
    </div>
  );
}

function SignaturePad({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b1220";
    ctx.lineWidth = 2.4;
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    last.current = pos(e);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    dirty.current = true;
  };
  const end = () => {
    drawing.current = false;
    last.current = null;
    if (dirty.current) onChange(canvasRef.current!.toDataURL("image/png"));
  };

  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
    onChange(null);
  };

  return (
    <div>
      <div className="relative rounded-xl border border-dashed border-border-strong bg-background">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="block h-32 w-full touch-none rounded-xl"
          style={{ touchAction: "none" }}
        />
        {!value && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center font-display text-xl text-muted-foreground/60">
            Sign here
          </p>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <button onClick={clear} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-muted-foreground hover:text-foreground">
          <Eraser className="h-3.5 w-3.5" /> Clear
        </button>
        {value && <span className="inline-flex items-center gap-1 text-success"><Check className="h-3.5 w-3.5" /> Saved</span>}
      </div>
    </div>
  );
}

function dataUrlToUint8(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
