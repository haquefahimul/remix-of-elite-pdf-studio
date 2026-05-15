import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { ModeChip } from "./SplitTool";
import { downloadBlob, formatBytes, baseName } from "@/lib/format";

type Output = "jpeg" | "png" | "webp";

export function ImageConvertTool() {
  const [items, setItems] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [output, setOutput] = useState<Output>("webp");
  const [quality, setQuality] = useState(0.9);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p)), [previews]);

  const addFiles = (fs: File[]) => {
    setItems((prev) => [...prev, ...fs]);
    setPreviews((prev) => [...prev, ...fs.map((f) => URL.createObjectURL(f))]);
  };

  const transform = async (file: File): Promise<Blob> => {
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
      ctx.drawImage(img, 0, 0);
      const mime = output === "jpeg" ? "image/jpeg" : output === "png" ? "image/png" : "image/webp";
      return await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), mime, output === "png" ? undefined : quality),
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const run = async () => {
    if (items.length === 0) return;
    setBusy(true);
    try {
      const ext = output === "jpeg" ? "jpg" : output;
      if (items.length === 1) {
        const blob = await transform(items[0]);
        downloadBlob(blob, `${baseName(items[0].name)}.${ext}`);
      } else {
        const mod = await import("jszip");
        const zip = new mod.default();
        for (const f of items) {
          const blob = await transform(f);
          zip.file(`${baseName(f.name)}.${ext}`, blob);
        }
        const out = await zip.generateAsync({ type: "blob" });
        downloadBlob(out, `images-${ext}.zip`);
      }
      toast.success("Converted");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't convert images");
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <Dropzone
        accept="image"
        onFiles={addFiles}
        title="Drop images to convert"
        hint="Convert between JPG, PNG, and WebP — bulk, on-device"
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {items.length} image{items.length === 1 ? "" : "s"} · {formatBytes(items.reduce((a, b) => a + b.size, 0))}
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
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Target format</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ModeChip active={output === "jpeg"} onClick={() => setOutput("jpeg")}>JPG</ModeChip>
            <ModeChip active={output === "png"} onClick={() => setOutput("png")}>PNG</ModeChip>
            <ModeChip active={output === "webp"} onClick={() => setOutput("webp")}>WebP</ModeChip>
          </div>
        </div>
        {output !== "png" && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Quality — {Math.round(quality * 100)}%
            </label>
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="mt-2 w-full accent-foreground"
            />
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {previews.map((src, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface">
            <img src={src} alt="" className="block aspect-square w-full object-cover" />
          </div>
        ))}
      </div>

      <ActionBar
        status={`Targeting .${output === "jpeg" ? "jpg" : output}`}
        primary={
          <button
            onClick={run}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Converting…" : "Convert & download"}
          </button>
        }
      />
    </div>
  );
}
