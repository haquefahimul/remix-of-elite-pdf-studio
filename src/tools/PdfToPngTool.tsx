import { useState } from "react";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { renderPagesAsImages } from "@/lib/pdf-render";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { FileHeader, ModeChip } from "./SplitTool";

export function PdfToPngTool() {
  const [file, setFile] = useState<File | null>(null);
  const [scale, setScale] = useState(2);
  const [grayscale, setGrayscale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const handleConvert = async () => {
    if (!file) return;
    setBusy(true);
    setProgress(null);
    try {
      const buf = await file.arrayBuffer();
      const blobs = await renderPagesAsImages(buf, {
        scale,
        format: "image/png",
        grayscale,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      const stem = baseName(file.name);
      if (blobs.length === 1) {
        downloadBlob(blobs[0], `${stem}.png`);
      } else {
        const mod = await import("jszip");
        const zip = new mod.default();
        blobs.forEach((b, i) => zip.file(`${stem} - page ${String(i + 1).padStart(3, "0")}.png`, b));
        const out = await zip.generateAsync({ type: "blob" });
        downloadBlob(out, `${stem} (PNG).zip`);
      }
      toast.success(`Exported ${blobs.length} PNG${blobs.length === 1 ? "" : "s"}`);
    } catch (err) {
      console.error(err);
      toast.error("Conversion failed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to convert"
        hint="Every page becomes a high-resolution PNG"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Resolution
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[1, 1.5, 2, 3, 4].map((s) => (
              <ModeChip key={s} active={scale === s} onClick={() => setScale(s)}>
                {s === 1 ? "Screen" : s === 4 ? "Ultra" : `${s}×`}
              </ModeChip>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Higher resolution = sharper images and bigger files. 2× is great for most prints.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Color
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ModeChip active={!grayscale} onClick={() => setGrayscale(false)}>
              Full color
            </ModeChip>
            <ModeChip active={grayscale} onClick={() => setGrayscale(true)}>
              Grayscale
            </ModeChip>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Grayscale runs an in-browser luminance filter on every page after rendering.
          </p>
        </div>
      </div>

      <ActionBar
        status={
          progress
            ? `Rendering page ${progress.done} of ${progress.total}…`
            : `Source ${formatBytes(file.size)}`
        }
        primary={
          <button
            onClick={handleConvert}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Rendering…" : "Convert & download"}
          </button>
        }
      />
    </div>
  );
}
