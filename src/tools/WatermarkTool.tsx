import { useEffect, useState } from "react";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName } from "@/lib/format";
import { renderThumbnails, type PageThumb } from "@/lib/pdf-render";
import { FileHeader, ThumbsLoading } from "./SplitTool";

type Position =
  | "center"
  | "top-left" | "top" | "top-right"
  | "left" | "right"
  | "bottom-left" | "bottom" | "bottom-right";

type Mode = "text" | "image";

export function WatermarkTool() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("CONFIDENTIAL");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [opacity, setOpacity] = useState(35);
  const [rotation, setRotation] = useState(-30);
  const [size, setSize] = useState(72);
  const [position, setPosition] = useState<Position>("center");
  const [tile, setTile] = useState(false);
  const [color, setColor] = useState("#111827");

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setLoading(true);
    setThumbs([]);
    file
      .arrayBuffer()
      .then((buf) => renderThumbnails(buf, { maxWidth: 220 }))
      .then((t) => !cancelled && setThumbs(t))
      .catch(() => toast.error("Couldn't read that PDF."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [file]);

  const handleApply = async () => {
    if (!file) return;
    if (mode === "text" && !text.trim()) return toast.error("Enter watermark text.");
    if (mode === "image" && !imageFile) return toast.error("Choose an image first.");

    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.HelveticaBold);

      let embedded: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
      if (mode === "image" && imageFile) {
        const ibuf = await imageFile.arrayBuffer();
        const isPng = imageFile.type.includes("png") || imageFile.name.toLowerCase().endsWith(".png");
        embedded = isPng ? await doc.embedPng(ibuf) : await doc.embedJpg(ibuf);
      }

      const { r, g, b } = hexToRgb(color);
      const op = Math.max(0.02, Math.min(1, opacity / 100));

      for (const page of doc.getPages()) {
        const { width, height } = page.getSize();
        const drawAt = (x: number, y: number) => {
          if (mode === "text") {
            page.drawText(text, {
              x, y,
              size,
              font,
              color: rgb(r, g, b),
              opacity: op,
              rotate: degrees(rotation),
            });
          } else if (embedded) {
            const targetW = Math.min(width * 0.6, size * 6);
            const scale = targetW / embedded.width;
            const w = embedded.width * scale;
            const h = embedded.height * scale;
            page.drawImage(embedded, {
              x: x - w / 2,
              y: y - h / 2,
              width: w,
              height: h,
              opacity: op,
              rotate: degrees(rotation),
            });
          }
        };

        if (tile) {
          const stepX = Math.max(120, size * 4);
          const stepY = Math.max(120, size * 4);
          for (let y = stepY / 2; y < height; y += stepY) {
            for (let x = stepX / 2; x < width; x += stepX) {
              drawAt(x, y);
            }
          }
        } else {
          const [x, y] = anchor(position, width, height, size, mode === "text" ? font.widthOfTextAtSize(text, size) : size * 4);
          drawAt(x, y);
        }
      }

      const bytes = await doc.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${baseName(file.name)} (watermarked).pdf`);
      toast.success("Watermark applied");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't apply watermark.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone accept="pdf" onFiles={(f) => setFile(f[0])} title="Drop a PDF to watermark" hint="or click to browse" />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
          <div className="flex gap-2">
            <ChipBtn active={mode === "text"} onClick={() => setMode("text")}>Text</ChipBtn>
            <ChipBtn active={mode === "image"} onClick={() => setMode("image")}>Image</ChipBtn>
          </div>

          {mode === "text" ? (
            <>
              <Field label="Text">
                <input value={text} onChange={(e) => setText(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Color">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-background" />
              </Field>
            </>
          ) : (
            <Field label="Image (PNG / JPG)">
              <label className="block cursor-pointer rounded-xl border border-dashed border-border-strong px-3 py-3 text-center text-sm text-muted-foreground hover:bg-accent">
                {imageFile ? imageFile.name : "Click to choose image"}
                <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
              </label>
            </Field>
          )}

          <Slider label={`Size · ${size}pt`} min={12} max={200} value={size} onChange={setSize} />
          <Slider label={`Opacity · ${opacity}%`} min={5} max={100} value={opacity} onChange={setOpacity} />
          <Slider label={`Rotation · ${rotation}°`} min={-90} max={90} value={rotation} onChange={setRotation} />

          <Field label="Position">
            <PositionPicker value={position} onChange={setPosition} disabled={tile} />
          </Field>

          <label className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <span>Tile across page</span>
            <input type="checkbox" checked={tile} onChange={(e) => setTile(e.target.checked)} className="h-4 w-4" />
          </label>
        </div>

        <div>
          {loading ? <ThumbsLoading /> : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {thumbs.slice(0, 6).map((t) => (
                <PreviewCard
                  key={t.pageIndex}
                  thumb={t}
                  text={mode === "text" ? text : ""}
                  position={position}
                  tile={tile}
                  rotation={rotation}
                  opacity={opacity}
                  size={size}
                  color={color}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ActionBar
        status={`${thumbs.length} pages · live preview shows first 6`}
        primary={
          <button
            onClick={handleApply}
            disabled={busy || loading}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Applying…" : "Apply watermark"}
          </button>
        }
      />
    </div>
  );
}

function PreviewCard({
  thumb, text, position, tile, rotation, opacity, size, color,
}: {
  thumb: PageThumb; text: string; position: Position; tile: boolean;
  rotation: number; opacity: number; size: number; color: string;
}) {
  const previewSize = Math.max(8, Math.min(28, (size / 200) * 28));
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-2">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
        <img src={thumb.dataUrl} alt={`Page ${thumb.pageIndex + 1}`} className="h-full w-full object-contain" />
        <div className="pointer-events-none absolute inset-0">
          {tile ? (
            <div className="grid h-full w-full grid-cols-2 grid-rows-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Stamp key={i} text={text} rotation={rotation} opacity={opacity} size={previewSize} color={color} />
              ))}
            </div>
          ) : (
            <div className={`absolute ${posCls(position)}`}>
              <Stamp text={text} rotation={rotation} opacity={opacity} size={previewSize} color={color} />
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 px-1 text-[11px] text-muted-foreground">Page {thumb.pageIndex + 1}</p>
    </div>
  );
}

function Stamp({ text, rotation, opacity, size, color }: { text: string; rotation: number; opacity: number; size: number; color: string }) {
  return (
    <div
      className="grid h-full w-full place-items-center"
      style={{ transform: `rotate(${rotation}deg)`, opacity: opacity / 100 }}
    >
      <span style={{ color, fontSize: `${size}px`, fontWeight: 700, letterSpacing: 1 }} className="whitespace-nowrap font-display">
        {text || "Aa"}
      </span>
    </div>
  );
}

function PositionPicker({ value, onChange, disabled }: { value: Position; onChange: (p: Position) => void; disabled?: boolean }) {
  const cells: Position[] = ["top-left","top","top-right","left","center","right","bottom-left","bottom","bottom-right"];
  return (
    <div className={`grid grid-cols-3 gap-1 rounded-xl border border-border bg-background p-1.5 ${disabled ? "opacity-40" : ""}`}>
      {cells.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled}
          onClick={() => onChange(c)}
          className={`aspect-square rounded-md border text-[10px] transition-colors ${value === c && !disabled ? "border-foreground bg-foreground text-background" : "border-transparent text-muted-foreground hover:bg-accent"}`}
          aria-label={c}
        >
          •
        </button>
      ))}
    </div>
  );
}

function Slider({ label, value, onChange, min, max }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <Field label={label}>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-foreground" />
    </Field>
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

function ChipBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full border px-3 py-1.5 text-sm transition-colors ${active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-accent"}`}
    >
      {children}
    </button>
  );
}

const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "");
  const n = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  return {
    r: parseInt(n.slice(0, 2), 16) / 255,
    g: parseInt(n.slice(2, 4), 16) / 255,
    b: parseInt(n.slice(4, 6), 16) / 255,
  };
}

function posCls(p: Position): string {
  switch (p) {
    case "top-left": return "top-2 left-2 w-1/2 h-1/3";
    case "top": return "top-2 left-1/4 w-1/2 h-1/3";
    case "top-right": return "top-2 right-2 w-1/2 h-1/3";
    case "left": return "top-1/3 left-2 w-1/2 h-1/3";
    case "center": return "inset-0";
    case "right": return "top-1/3 right-2 w-1/2 h-1/3";
    case "bottom-left": return "bottom-2 left-2 w-1/2 h-1/3";
    case "bottom": return "bottom-2 left-1/4 w-1/2 h-1/3";
    case "bottom-right": return "bottom-2 right-2 w-1/2 h-1/3";
  }
}

function anchor(p: Position, w: number, h: number, size: number, textW: number): [number, number] {
  const m = 36;
  const cx = w / 2 - textW / 2;
  const cy = h / 2 - size / 2;
  switch (p) {
    case "top-left": return [m, h - m - size];
    case "top": return [cx, h - m - size];
    case "top-right": return [w - textW - m, h - m - size];
    case "left": return [m, cy];
    case "center": return [cx, cy];
    case "right": return [w - textW - m, cy];
    case "bottom-left": return [m, m];
    case "bottom": return [cx, m];
    case "bottom-right": return [w - textW - m, m];
  }
}
