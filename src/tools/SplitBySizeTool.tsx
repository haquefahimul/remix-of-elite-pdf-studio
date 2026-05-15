import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader } from "./SplitTool";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";

export function SplitBySizeTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [maxMB, setMaxMB] = useState(5);
  const [progress, setProgress] = useState<string | null>(null);

  const handleSplit = async () => {
    if (!file) return;
    const maxBytes = maxMB * 1024 * 1024;
    if (file.size <= maxBytes) {
      toast.error(`File is already under ${maxMB} MB`);
      return;
    }
    setBusy(true);
    setProgress(null);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const total = src.getPageCount();

      const mod = await import("jszip");
      const zip = new mod.default();
      const stem = baseName(file.name);

      let chunkIdx = 1;
      let cursor = 0;

      while (cursor < total) {
        // Build a chunk by adding pages until size exceeds threshold, then back off by one.
        let lo = 1;
        let hi = total - cursor;
        let bestBytes: Uint8Array | null = null;
        let bestCount = 1;

        // Quick exponential probe to find a near-fit, then a small linear back-off.
        let probe = 1;
        let lastFit: { bytes: Uint8Array; count: number } | null = null;
        while (probe <= hi) {
          setProgress(`Chunk ${chunkIdx}: testing ${probe} pages…`);
          const out = await PDFDocument.create();
          const ids = Array.from({ length: probe }, (_, i) => cursor + i);
          const pages = await out.copyPages(src, ids);
          pages.forEach((p) => out.addPage(p));
          const bytes = await out.save();
          if (bytes.byteLength <= maxBytes) {
            lastFit = { bytes, count: probe };
            if (probe === hi) break;
            probe = Math.min(probe * 2, hi);
          } else {
            hi = probe - 1;
            break;
          }
        }

        // Fine-tune between lastFit.count and hi
        if (lastFit) {
          lo = lastFit.count;
          bestBytes = lastFit.bytes;
          bestCount = lastFit.count;
        }

        while (lo < hi) {
          const mid = Math.floor((lo + hi + 1) / 2);
          setProgress(`Chunk ${chunkIdx}: tuning at ${mid} pages…`);
          const out = await PDFDocument.create();
          const ids = Array.from({ length: mid }, (_, i) => cursor + i);
          const pages = await out.copyPages(src, ids);
          pages.forEach((p) => out.addPage(p));
          const bytes = await out.save();
          if (bytes.byteLength <= maxBytes) {
            lo = mid;
            bestBytes = bytes;
            bestCount = mid;
          } else {
            hi = mid - 1;
          }
        }

        if (!bestBytes) {
          // Even one page exceeds the limit — emit it anyway to make progress.
          const out = await PDFDocument.create();
          const [p] = await out.copyPages(src, [cursor]);
          out.addPage(p);
          bestBytes = await out.save();
          bestCount = 1;
          toast.warning(`Page ${cursor + 1} exceeds ${maxMB} MB on its own; included as-is.`);
        }

        const partName = `${stem} - part ${String(chunkIdx).padStart(2, "0")} (pages ${cursor + 1}-${cursor + bestCount}).pdf`;
        zip.file(partName, bestBytes);
        cursor += bestCount;
        chunkIdx++;
      }

      setProgress("Packaging zip…");
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `${stem} (under ${maxMB}MB).zip`);
      toast.success(`Split into ${chunkIdx - 1} parts`);
    } catch (err) {
      console.error(err);
      toast.error("Split failed.");
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
        title="Drop a large PDF to chunk"
        hint="Splits into the smallest number of parts that all fit your size cap"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Maximum part size
        </p>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={50}
            value={maxMB}
            onChange={(e) => setMaxMB(Number(e.target.value))}
            className="flex-1 accent-foreground"
          />
          <input
            type="number"
            min={1}
            max={500}
            value={maxMB}
            onChange={(e) => setMaxMB(Math.max(1, Number(e.target.value) || 1))}
            className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm tabular-nums outline-none focus:border-foreground"
          />
          <span className="text-sm text-muted-foreground">MB</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Source file is {formatBytes(file.size)} — Folio runs a binary search per chunk to fit as
          many pages as possible into each part.
        </p>
      </div>

      <ActionBar
        status={progress ?? `Will produce a .zip of parts under ${maxMB} MB each`}
        primary={
          <button
            onClick={handleSplit}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Splitting…" : "Split & download zip"}
          </button>
        }
      />
    </div>
  );
}
