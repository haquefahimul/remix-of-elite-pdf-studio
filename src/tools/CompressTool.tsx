import { useEffect, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { renderPagesAsJpegs } from "@/lib/pdf-render";
import { downloadBlob, formatBytes, baseName } from "@/lib/format";
import { FileHeader, ModeChip } from "./SplitTool";

type Quality = "extreme" | "recommended" | "less";

const QUALITY_PRESETS: Record<Quality, { scale: number; jpegQuality: number; label: string; hint: string }> = {
  extreme: { scale: 1.1, jpegQuality: 0.55, label: "Extreme", hint: "Smallest file, lowest visual quality" },
  recommended: { scale: 1.5, jpegQuality: 0.78, label: "Recommended", hint: "Great balance — best for most" },
  less: { scale: 2, jpegQuality: 0.92, label: "Less", hint: "Larger file, near-original quality" },
};

export function CompressTool() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<Quality>("recommended");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string; saved: number } | null>(null);

  useEffect(() => setResult(null), [file, quality]);

  const handleCompress = async () => {
    if (!file) return;
    setBusy(true);
    setProgress({ done: 0, total: 1 });
    try {
      const preset = QUALITY_PRESETS[quality];
      const buf = await file.arrayBuffer();
      // Re-render every page as JPEG, then assemble a fresh PDF — the most
      // reliable client-side compression strategy.
      const jpegs = await renderPagesAsJpegs(buf, {
        scale: preset.scale,
        quality: preset.jpegQuality,
        onProgress: (done, total) => setProgress({ done, total }),
      });

      const out = await PDFDocument.create();
      for (const blob of jpegs) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const img = await out.embedJpg(bytes);
        const page = out.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      const outBytes = await out.save();
      const blob = new Blob([outBytes as BlobPart], { type: "application/pdf" });
      const saved = Math.max(0, file.size - blob.size);
      setResult({ blob, name: `${baseName(file.name)} (compressed).pdf`, saved });
      toast.success(`Saved ${formatBytes(saved)} (${Math.round((saved / file.size) * 100)}%)`);
    } catch (err) {
      console.error(err);
      toast.error("Compression failed.");
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
        title="Drop a PDF to compress"
        hint="or click to browse"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Compression level
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(QUALITY_PRESETS) as Quality[]).map((q) => (
            <ModeChip key={q} active={quality === q} onClick={() => setQuality(q)}>
              {QUALITY_PRESETS[q].label}
            </ModeChip>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{QUALITY_PRESETS[quality].hint}</p>
      </div>

      {result && (
        <div className="mt-6 rounded-2xl border border-success/30 bg-success/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-2xl tracking-tight text-foreground">
                {formatBytes(result.blob.size)}
              </p>
              <p className="text-sm text-muted-foreground">
                Down from {formatBytes(file.size)} · saved {formatBytes(result.saved)} (
                {Math.round((result.saved / file.size) * 100)}%)
              </p>
            </div>
            <button
              onClick={() => downloadBlob(result.blob, result.name)}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
            >
              Download
            </button>
          </div>
        </div>
      )}

      <ActionBar
        status={
          progress
            ? `Compressing page ${progress.done} of ${progress.total}…`
            : "Ready when you are"
        }
        primary={
          <button
            onClick={handleCompress}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Compressing…" : "Compress now"}
          </button>
        }
      />
    </div>
  );
}
