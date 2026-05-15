import { useState } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import { toast } from "sonner";
import { Palette, X } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(v, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function BackgroundTool() {
  const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [color, setColor] = useState("#fff7e6");
  const [opacity, setOpacity] = useState(1);
  const [mode, setMode] = useState<"color" | "image">("color");
  const [busy, setBusy] = useState(false);

  const handleApply = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await PDFDocument.load(buf);

      let imgBytes: Uint8Array | null = null;
      let isPng = false;
      if (mode === "image" && image) {
        imgBytes = new Uint8Array(await image.arrayBuffer());
        isPng = image.type.includes("png");
      }
      const embeddedImg = imgBytes
        ? isPng
          ? await pdf.embedPng(imgBytes)
          : await pdf.embedJpg(imgBytes)
        : null;

      const [r, g, b] = hexToRgb(color);
      for (const page of pdf.getPages()) {
        const w = page.getWidth();
        const h = page.getHeight();
        // Insert background BEFORE existing content by drawing to a fresh page
        // Easier: draw rectangle/image at low z by using setRotation trick — pdf-lib lacks z order,
        // so we re-stack: copy page content into an embedded page, then redraw bg + content.
        const embedded = await pdf.embedPage(page);
        // Clear page content stream by overwriting with bg + page
        page.drawRectangle({
          x: 0,
          y: 0,
          width: w,
          height: h,
          color: rgb(r, g, b),
          opacity: mode === "color" ? opacity : 1,
        });
        if (mode === "image" && embeddedImg) {
          // Cover-fit
          const iw = embeddedImg.width;
          const ih = embeddedImg.height;
          const scale = Math.max(w / iw, h / ih);
          const dw = iw * scale;
          const dh = ih * scale;
          page.drawImage(embeddedImg, {
            x: (w - dw) / 2,
            y: (h - dh) / 2,
            width: dw,
            height: dh,
            opacity,
          });
        }
        page.drawPage(embedded, { x: 0, y: 0, width: w, height: h });
      }

      const bytes = await pdf.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)}-background.pdf`
      );
      toast.success("Background applied");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't apply background");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to add a background"
        hint="Solid color or full-bleed image, every page"
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-tool-watermark/10 text-tool-watermark">
          <Palette className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
        </div>
        <button
          onClick={() => setFile(null)}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Remove"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <div className="inline-flex rounded-full border border-border bg-background p-1">
          {(
            [
              { value: "color", label: "Solid color" },
              { value: "image", label: "Image" },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              onClick={() => setMode(o.value)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                mode === o.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {mode === "color" ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Color
              </span>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-16 cursor-pointer rounded-lg border border-border bg-background"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Opacity · {Math.round(opacity * 100)}%
              </span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="mt-3 w-full"
              />
            </label>
          </div>
        ) : (
          <div className="mt-5">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Background image (JPG or PNG)
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-foreground file:px-4 file:py-2 file:text-sm file:font-medium file:text-background"
              />
            </label>
            {image && (
              <p className="mt-2 text-xs text-muted-foreground">
                {image.name} · {formatBytes(image.size)}
              </p>
            )}
            <label className="mt-4 block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Opacity · {Math.round(opacity * 100)}%
              </span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="mt-3 w-full"
              />
            </label>
          </div>
        )}
      </div>

      <ActionBar
        status="Background renders behind existing content"
        primary={
          <button
            onClick={handleApply}
            disabled={busy || (mode === "image" && !image)}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Applying…" : "Export with background"}
          </button>
        }
      />
    </div>
  );
}
