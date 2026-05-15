import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { ModeChip } from "./SplitTool";
import { downloadBlob, formatBytes, baseName } from "@/lib/format";

type Mode = "fit" | "exact" | "percent";
type Output = "jpeg" | "png" | "webp";

export function ImageResizeTool() {
  const [items, setItems] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("fit");
  const [w, setW] = useState(1600);
  const [h, setH] = useState(1600);
  const [pct, setPct] = useState(50);
  const [output, setOutput] = useState<Output>("jpeg");
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
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      let dw = iw;
      let dh = ih;
      if (mode === "exact") {
        dw = w;
        dh = h;
      } else if (mode === "fit") {
        const s = Math.min(w / iw, h / ih, 1);
        dw = Math.max(1, Math.round(iw * s));
        dh = Math.max(1, Math.round(ih * s));
      } else {
        dw = Math.max(1, Math.round((iw * pct) / 100));
        dh = Math.max(1, Math.round((ih * pct) / 100));
      }
      const canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext("2d", { alpha: output === "png" })!;
      if (output !== "png") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, dw, dh);
      }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, dw, dh);
      const mime = output === "jpeg" ? "image/jpeg" : output === "png" ? "image/png" : "image/webp";
      return await new Promise((res, rej) =>
        canvas.toBlob(
          (b) => (b ? res(b) : rej(new Error("encode failed"))),
          mime,
          output === "png" ? undefined : quality,
        ),
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
        downloadBlob(blob, `${baseName(items[0].name)} (resized).${ext}`);
      } else {
        const mod = await import("jszip");
        const zip = new mod.default();
        for (const f of items) {
          const blob = await transform(f);
          zip.file(`${baseName(f.name)}.${ext}`, blob);
        }
        const out = await zip.generateAsync({ type: "blob" });
        downloadBlob(out, `images-resized.zip`);
      }
      toast.success("Resized");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't resize images");
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <Dropzone
        accept="image"
        onFiles={addFiles}
        title="Drop images to resize"
        hint="Bulk resize JPGs, PNGs, and WebPs to fit, exact, or percent"
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
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mode</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ModeChip active={mode === "fit"} onClick={() => setMode("fit")}>Fit within</ModeChip>
            <ModeChip active={mode === "exact"} onClick={() => setMode("exact")}>Exact size</ModeChip>
            <ModeChip active={mode === "percent"} onClick={() => setMode("percent")}>Percent</ModeChip>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {mode === "percent" ? (
              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Scale — {pct}%</span>
                <input type="range" min={5} max={200} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="accent-foreground" />
              </label>
            ) : (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Width (px)</span>
                  <input type="number" min={1} value={w} onChange={(e) => setW(Number(e.target.value))} className="rounded-lg border border-border bg-background px-3 py-1.5" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Height (px)</span>
                  <input type="number" min={1} value={h} onChange={(e) => setH(Number(e.target.value))} className="rounded-lg border border-border bg-background px-3 py-1.5" />
                </label>
              </>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Output</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ModeChip active={output === "jpeg"} onClick={() => setOutput("jpeg")}>JPG</ModeChip>
            <ModeChip active={output === "png"} onClick={() => setOutput("png")}>PNG</ModeChip>
            <ModeChip active={output === "webp"} onClick={() => setOutput("webp")}>WebP</ModeChip>
          </div>
          {output !== "png" && (
            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Quality — {Math.round(quality * 100)}%</span>
              <input type="range" min={0.3} max={1} step={0.05} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="accent-foreground" />
            </label>
          )}
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
        status={`${items.length} ready`}
        primary={
          <button
            onClick={run}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Resizing…" : "Resize & download"}
          </button>
        }
      />
    </div>
  );
}
