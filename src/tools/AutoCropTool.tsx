import { useEffect, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader } from "./SplitTool";
import { pdfjsLib } from "@/lib/pdf-worker";
import { downloadBlob, baseName } from "@/lib/format";

export function AutoCropTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [padding, setPadding] = useState(8); // pt
  const [threshold, setThreshold] = useState(245); // brightness 0–255
  const [uniform, setUniform] = useState(true);

  // Reset progress on file change
  useEffect(() => {
    setProgress("");
  }, [file]);

  const handleCrop = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const renderBuf = buf.slice(0);
      const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      const doc = await pdfjsLib.getDocument({ data: renderBuf }).promise;
      const total = doc.numPages;
      const boxes: Array<{ x: number; y: number; w: number; h: number } | null> = [];

      for (let i = 1; i <= total; i++) {
        setProgress(`Analyzing page ${i} of ${total}…`);
        const page = await doc.getPage(i);
        const v1 = page.getViewport({ scale: 1 });
        // Cap render size for huge pages so we stay fast.
        const targetMax = 1100;
        const scale = Math.min(2, targetMax / Math.max(v1.width, v1.height));
        const vp = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext("2d", { alpha: false })!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({
          canvas,
          canvasContext: ctx,
          viewport: vp,
        } as Parameters<typeof page.render>[0]).promise;

        const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const W = canvas.width;
        const H = canvas.height;
        let minX = W,
          minY = H,
          maxX = -1,
          maxY = -1;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const p = (y * W + x) * 4;
            const lum = 0.299 * img[p] + 0.587 * img[p + 1] + 0.114 * img[p + 2];
            if (lum < threshold) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        page.cleanup();

        if (maxX < 0) {
          boxes.push(null);
          continue;
        }
        // Convert pixel bbox -> PDF point bbox (PDF Y is bottom-up).
        const px2pt = 1 / scale;
        const x = minX * px2pt;
        const yPdf = (H - maxY) * px2pt;
        const w = (maxX - minX) * px2pt;
        const h = (maxY - minY) * px2pt;
        boxes.push({ x, y: yPdf, w, h });
      }
      await doc.destroy();

      const pages = pdf.getPages();
      // If uniform, take min-rectangle that fits all content boxes per-page-index basis.
      // Apply per-page CropBox via setCropBox (clamped to MediaBox).
      let cropped = 0;
      pages.forEach((page, i) => {
        const box = boxes[i];
        if (!box) return;
        const media = page.getMediaBox();
        const pad = padding;
        const x = Math.max(media.x, box.x - pad);
        const y = Math.max(media.y, box.y - pad);
        const right = Math.min(media.x + media.width, box.x + box.w + pad);
        const top = Math.min(media.y + media.height, box.y + box.h + pad);
        const w = Math.max(36, right - x);
        const h = Math.max(36, top - y);
        page.setCropBox(x, y, w, h);
        cropped++;
      });

      // Optional uniform: re-apply largest crop to each page so all pages match.
      if (uniform && cropped > 0) {
        let uw = 0,
          uh = 0;
        pages.forEach((p) => {
          const c = p.getCropBox();
          if (c.width > uw) uw = c.width;
          if (c.height > uh) uh = c.height;
        });
        pages.forEach((p) => {
          const c = p.getCropBox();
          const cx = c.x + c.width / 2;
          const cy = c.y + c.height / 2;
          const m = p.getMediaBox();
          let nx = cx - uw / 2;
          let ny = cy - uh / 2;
          nx = Math.max(m.x, Math.min(m.x + m.width - uw, nx));
          ny = Math.max(m.y, Math.min(m.y + m.height - uh, ny));
          p.setCropBox(nx, ny, uw, uh);
        });
      }

      setProgress("Saving…");
      const bytes = await pdf.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)} (auto-cropped).pdf`,
      );
      toast.success(`Cropped ${cropped} of ${total} pages`);
    } catch (err) {
      console.error(err);
      toast.error("Auto crop failed.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to auto-crop"
        hint="Detects content edges and trims white margins"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2">
        <Slider
          label="Padding"
          value={padding}
          onChange={setPadding}
          min={0}
          max={48}
          suffix="pt"
        />
        <Slider
          label="White threshold"
          value={threshold}
          onChange={setThreshold}
          min={200}
          max={254}
        />
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm sm:col-span-2">
          <span className="text-foreground">Match all pages to the largest crop</span>
          <input
            type="checkbox"
            checked={uniform}
            onChange={(e) => setUniform(e.target.checked)}
            className="h-4 w-4 accent-foreground"
          />
        </label>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Folio rasterises each page in your browser to find the content bounding box, then sets a
        new CropBox — no pages are deleted.
      </p>

      <ActionBar
        status={progress || "Ready"}
        primary={
          <button
            onClick={handleCrop}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Cropping…" : "Auto crop & download"}
          </button>
        }
      />
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-foreground"
        />
        <span className="w-14 text-right text-xs tabular-nums text-foreground">
          {value}
          {suffix ?? ""}
        </span>
      </div>
    </label>
  );
}
