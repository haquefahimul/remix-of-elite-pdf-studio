import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader } from "./SplitTool";
import { downloadBlob, baseName } from "@/lib/format";

export function SplitByPagesTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [chunkSize, setChunkSize] = useState(10);
  const [busy, setBusy] = useState(false);

  const handleFile = async (f: File) => {
    setFile(f);
    try {
      const pdf = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
      setPageCount(pdf.getPageCount());
    } catch {
      setPageCount(0);
    }
  };

  const expectedFiles = Math.max(1, Math.ceil(pageCount / Math.max(1, chunkSize)));

  const handleApply = async () => {
    if (!file || chunkSize < 1) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const stem = baseName(file.name);
      const mod = await import("jszip");
      const zip = new mod.default();

      let part = 1;
      for (let start = 0; start < pageCount; start += chunkSize) {
        const end = Math.min(start + chunkSize, pageCount);
        const indices = Array.from({ length: end - start }, (_, i) => start + i);
        const out = await PDFDocument.create();
        const pages = await out.copyPages(src, indices);
        pages.forEach((p) => out.addPage(p));
        const bytes = await out.save();
        const label = `${start + 1}-${end}`;
        zip.file(`${stem} part ${String(part).padStart(2, "0")} (${label}).pdf`, bytes);
        part++;
      }
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `${stem} (chunks of ${chunkSize}).zip`);
      toast.success(`Created ${part - 1} files`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't split PDF");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => handleFile(f[0])}
        title="Drop a PDF to chunk"
        hint="Split into equal-sized parts of N pages each"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Pages per file
        </label>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={Math.max(1, pageCount)}
            value={chunkSize}
            onChange={(e) => setChunkSize(Number(e.target.value))}
            className="flex-1 accent-foreground"
          />
          <input
            type="number"
            min={1}
            value={chunkSize}
            onChange={(e) => setChunkSize(Math.max(1, Number(e.target.value) || 1))}
            className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm tabular-nums"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {pageCount} pages → {expectedFiles} file{expectedFiles === 1 ? "" : "s"}
        </p>
      </div>

      <ActionBar
        status={`${pageCount} pages · ${expectedFiles} parts`}
        primary={
          <button
            onClick={handleApply}
            disabled={busy || pageCount === 0}
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
