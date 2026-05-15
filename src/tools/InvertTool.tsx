import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Moon, X } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { pdfjsLib } from "@/lib/pdf-worker";

export function InvertTool() {
  const [file, setFile] = useState<File | null>(null);
  const [dpi, setDpi] = useState(150);
  const [quality, setQuality] = useState(0.9);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleInvert = async () => {
    if (!file) return;
    setBusy(true);
    setProgress(0);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const out = await PDFDocument.create();
      const scale = dpi / 72;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d", { alpha: false })!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({
          canvas,
          canvasContext: ctx,
          viewport,
        } as Parameters<typeof page.render>[0]).promise;

        // Invert RGB
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = img.data;
        for (let p = 0; p < d.length; p += 4) {
          d[p] = 255 - d[p];
          d[p + 1] = 255 - d[p + 1];
          d[p + 2] = 255 - d[p + 2];
        }
        ctx.putImageData(img, 0, 0);

        const blob: Blob = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b!), "image/jpeg", quality)
        );
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const jpg = await out.embedJpg(bytes);
        const pageOut = out.addPage([viewport.width / scale, viewport.height / scale]);
        pageOut.drawImage(jpg, {
          x: 0,
          y: 0,
          width: viewport.width / scale,
          height: viewport.height / scale,
        });
        page.cleanup();
        setProgress(Math.round((i / pdf.numPages) * 100));
      }
      await pdf.destroy();

      const bytes = await out.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)}-inverted.pdf`
      );
      toast.success("Inverted PDF ready");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't invert that PDF");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to invert"
        hint="Black backgrounds, white text — easy on the eyes"
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-tool-redact/10 text-tool-redact">
          <Moon className="h-4 w-4" />
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

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="rounded-2xl border border-border bg-surface p-5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Resolution · {dpi} DPI
          </span>
          <input
            type="range"
            min={96}
            max={300}
            step={6}
            value={dpi}
            onChange={(e) => setDpi(Number(e.target.value))}
            className="mt-3 w-full"
          />
          <p className="mt-2 text-xs text-muted-foreground">Higher DPI = sharper but larger file.</p>
        </label>
        <label className="rounded-2xl border border-border bg-surface p-5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            JPEG quality · {Math.round(quality * 100)}%
          </span>
          <input
            type="range"
            min={0.5}
            max={1}
            step={0.05}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="mt-3 w-full"
          />
          <p className="mt-2 text-xs text-muted-foreground">Affects file size and visual fidelity.</p>
        </label>
      </div>

      <ActionBar
        status={busy ? `Rasterising… ${progress}%` : "Pages get rasterised then color-inverted"}
        primary={
          <button
            onClick={handleInvert}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Inverting…" : "Export inverted PDF"}
          </button>
        }
      />
    </div>
  );
}
