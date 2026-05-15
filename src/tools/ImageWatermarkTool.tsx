import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { ModeChip } from "./SplitTool";
import { Input } from "@/components/ui/input";
import { downloadBlob, formatBytes, baseName } from "@/lib/format";

type Position = "tl" | "tr" | "bl" | "br" | "center" | "tile";
type Output = "jpeg" | "png" | "webp";

export function ImageWatermarkTool() {
  const [items, setItems] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [text, setText] = useState("© Folio");
  const [opacity, setOpacity] = useState(50);
  const [scale, setScale] = useState(6); // % of image width per char unit
  const [position, setPosition] = useState<Position>("br");
  const [output, setOutput] = useState<Output>("jpeg");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (fs: File[]) => {
    setItems((p) => [...p, ...fs]);
    setPreviews((p) => [...p, ...fs.map((f) => URL.createObjectURL(f))]);
  };

  const stamp = async (file: File): Promise<Blob> => {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { alpha: output === "png" })!;
      if (output !== "png") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);

      const fontPx = Math.max(14, Math.round((w * scale) / 100));
      ctx.font = `600 ${fontPx}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = `rgba(255,255,255,${opacity / 100})`;
      ctx.strokeStyle = `rgba(0,0,0,${(opacity / 100) * 0.6})`;
      ctx.lineWidth = Math.max(1, fontPx / 18);
      ctx.textBaseline = "alphabetic";

      const pad = Math.round(fontPx * 0.6);
      const tw = ctx.measureText(text).width;

      const draw = (x: number, y: number) => {
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
      };

      if (position === "tile") {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(-Math.PI / 6);
        const stepX = tw + fontPx * 4;
        const stepY = fontPx * 4;
        const span = Math.max(w, h) * 1.5;
        for (let y = -span; y < span; y += stepY) {
          for (let x = -span; x < span; x += stepX) {
            draw(x, y);
          }
        }
        ctx.restore();
      } else {
        let x = pad;
        let y = fontPx + pad;
        if (position === "tr") x = w - tw - pad;
        if (position === "bl") y = h - pad;
        if (position === "br") {
          x = w - tw - pad;
          y = h - pad;
        }
        if (position === "center") {
          x = (w - tw) / 2;
          y = (h + fontPx) / 2;
        }
        draw(x, y);
      }

      const mime = output === "jpeg" ? "image/jpeg" : output === "png" ? "image/png" : "image/webp";
      return await new Promise((res, rej) =>
        canvas.toBlob(
          (b) => (b ? res(b) : rej(new Error("encode failed"))),
          mime,
          output === "png" ? undefined : 0.92,
        ),
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const run = async () => {
    if (items.length === 0 || !text.trim()) return;
    setBusy(true);
    try {
      const ext = output === "jpeg" ? "jpg" : output;
      if (items.length === 1) {
        const blob = await stamp(items[0]);
        downloadBlob(blob, `${baseName(items[0].name)} (watermarked).${ext}`);
      } else {
        const mod = await import("jszip");
        const zip = new mod.default();
        for (const f of items) {
          const blob = await stamp(f);
          zip.file(`${baseName(f.name)}.${ext}`, blob);
        }
        const out = await zip.generateAsync({ type: "blob" });
        downloadBlob(out, `images-watermarked.zip`);
      }
      toast.success("Watermarked");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't watermark images");
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <Dropzone
        accept="image"
        onFiles={addFiles}
        title="Drop JPGs, PNGs, or WebPs"
        hint="Stamp every image with custom text — perfect for proofs and previews"
      />
    );
  }

  const totalIn = items.reduce((a, b) => a + b.size, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {items.length} image{items.length === 1 ? "" : "s"} · {formatBytes(totalIn)}
        </p>
        <button
          onClick={() => {
            previews.forEach((p) => URL.revokeObjectURL(p));
            setItems([]);
            setPreviews([]);
          }}
          className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Clear
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Watermark text
          </label>
          <Input value={text} onChange={(e) => setText(e.target.value)} className="mt-2 h-10" />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Position</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ModeChip active={position === "tl"} onClick={() => setPosition("tl")}>Top-left</ModeChip>
            <ModeChip active={position === "tr"} onClick={() => setPosition("tr")}>Top-right</ModeChip>
            <ModeChip active={position === "center"} onClick={() => setPosition("center")}>Center</ModeChip>
            <ModeChip active={position === "bl"} onClick={() => setPosition("bl")}>Bottom-left</ModeChip>
            <ModeChip active={position === "br"} onClick={() => setPosition("br")}>Bottom-right</ModeChip>
            <ModeChip active={position === "tile"} onClick={() => setPosition("tile")}>Tile</ModeChip>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Opacity — {opacity}%
          </label>
          <input
            type="range"
            min={10}
            max={100}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
          />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Size — {scale}% of width
          </label>
          <input
            type="range"
            min={2}
            max={20}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
          />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 sm:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Output</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ModeChip active={output === "jpeg"} onClick={() => setOutput("jpeg")}>JPG</ModeChip>
            <ModeChip active={output === "png"} onClick={() => setOutput("png")}>PNG</ModeChip>
            <ModeChip active={output === "webp"} onClick={() => setOutput("webp")}>WebP</ModeChip>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {previews.map((src, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface">
            <img src={src} alt="" className="block aspect-square w-full object-cover" />
          </div>
        ))}
      </div>

      <ActionBar
        status={`${formatBytes(totalIn)} ready`}
        primary={
          <button
            onClick={run}
            disabled={busy || !text.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Stamping…" : "Stamp & download"}
          </button>
        }
      />
    </div>
  );
}
