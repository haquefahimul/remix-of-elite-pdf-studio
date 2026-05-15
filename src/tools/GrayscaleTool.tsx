import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { renderPagesAsImages } from "@/lib/pdf-render";
import { Contrast, X } from "lucide-react";

export function GrayscaleTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [scale, setScale] = useState(2);
  const [quality, setQuality] = useState(0.85);

  const handleConvert = async () => {
    if (!file) return;
    setBusy(true);
    setProgress({ done: 0, total: 0 });
    try {
      const buf = await file.arrayBuffer();
      const blobs = await renderPagesAsImages(buf, {
        scale,
        quality,
        format: "image/jpeg",
        grayscale: true,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      const out = await PDFDocument.create();
      for (const b of blobs) {
        const bytes = await b.arrayBuffer();
        const img = await out.embedJpg(bytes);
        const page = out.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      const pdfBytes = await out.save();
      downloadBlob(
        new Blob([pdfBytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)} (grayscale).pdf`
      );
      toast.success("Grayscale PDF ready");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't process that PDF.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to grayscale"
        hint="Saves ink and unifies look — works on any PDF"
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-tool-grayscale/10 text-tool-grayscale">
          <Contrast className="h-4 w-4" />
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

      <div className="mt-4 grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2">
        <Field label={`Resolution (${Math.round(scale * 72)} dpi)`}>
          <input
            type="range"
            min={1}
            max={3}
            step={0.5}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-full"
          />
        </Field>
        <Field label={`JPEG quality (${Math.round(quality * 100)}%)`}>
          <input
            type="range"
            min={0.5}
            max={1}
            step={0.05}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="w-full"
          />
        </Field>
      </div>

      <ActionBar
        status={
          busy && progress.total > 0
            ? `Page ${progress.done} of ${progress.total}`
            : "Pages render to grayscale and rebuild as a fresh PDF"
        }
        primary={
          <button
            onClick={handleConvert}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Converting…" : "Convert & download"}
          </button>
        }
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
