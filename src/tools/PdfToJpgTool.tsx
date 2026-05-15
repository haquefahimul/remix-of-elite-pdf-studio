import { useState } from "react";
import { toast } from "sonner";
import JSZip from "jszip";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { renderPagesAsJpegs } from "@/lib/pdf-render";
import { downloadBlob, baseName } from "@/lib/format";
import { FileHeader, ModeChip } from "./SplitTool";

type Resolution = "standard" | "high" | "max";

const RES: Record<Resolution, { scale: number; label: string; hint: string }> = {
  standard: { scale: 1.5, label: "Standard", hint: "Web-friendly · 144 DPI equivalent" },
  high: { scale: 2.5, label: "High", hint: "Crisp on retina · 240 DPI equivalent" },
  max: { scale: 3.5, label: "Maximum", hint: "Print-quality · large files · 336 DPI equivalent" },
};

export function PdfToJpgTool() {
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<Resolution>("high");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const handleConvert = async () => {
    if (!file) return;
    setBusy(true);
    setProgress({ done: 0, total: 1 });
    try {
      const buf = await file.arrayBuffer();
      const blobs = await renderPagesAsJpegs(buf, {
        scale: RES[res].scale,
        quality: 0.92,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      const stem = baseName(file.name);
      if (blobs.length === 1) {
        downloadBlob(blobs[0], `${stem}.jpg`);
      } else {
        const zip = new JSZip();
        blobs.forEach((b, i) => {
          zip.file(`${stem} - page ${String(i + 1).padStart(3, "0")}.jpg`, b);
        });
        const out = await zip.generateAsync({ type: "blob" });
        downloadBlob(out, `${stem} (images).zip`);
      }
      toast.success(`Exported ${blobs.length} image${blobs.length === 1 ? "" : "s"}`);
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
        hint="or click to browse"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Resolution</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(RES) as Resolution[]).map((r) => (
            <ModeChip key={r} active={res === r} onClick={() => setRes(r)}>
              {RES[r].label}
            </ModeChip>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{RES[res].hint}</p>
      </div>

      <ActionBar
        status={
          progress
            ? `Rendering page ${progress.done} of ${progress.total}…`
            : "Each page becomes a JPG. Multi-page PDFs are bundled as .zip."
        }
        primary={
          <button
            onClick={handleConvert}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Converting…" : "Convert to JPG"}
          </button>
        }
      />
    </div>
  );
}
