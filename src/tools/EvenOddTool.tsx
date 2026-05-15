import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader, ModeChip } from "./SplitTool";
import { downloadBlob, baseName } from "@/lib/format";

type Mode = "even" | "odd" | "both";

export function EvenOddTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [mode, setMode] = useState<Mode>("odd");
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

  const indicesFor = (m: "even" | "odd") => {
    const arr: number[] = [];
    for (let i = 0; i < pageCount; i++) {
      const human = i + 1;
      if (m === "odd" && human % 2 === 1) arr.push(i);
      if (m === "even" && human % 2 === 0) arr.push(i);
    }
    return arr;
  };

  const buildPdf = async (src: PDFDocument, indices: number[]) => {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    return out.save();
  };

  const handleApply = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const stem = baseName(file.name);

      if (mode === "both") {
        const mod = await import("jszip");
        const zip = new mod.default();
        const odd = await buildPdf(src, indicesFor("odd"));
        const even = await buildPdf(src, indicesFor("even"));
        zip.file(`${stem} (odd).pdf`, odd);
        zip.file(`${stem} (even).pdf`, even);
        const blob = await zip.generateAsync({ type: "blob" });
        downloadBlob(blob, `${stem} (even-odd).zip`);
      } else {
        const idx = indicesFor(mode);
        if (idx.length === 0) {
          toast.error(`No ${mode} pages to extract`);
          return;
        }
        const bytes = await buildPdf(src, idx);
        downloadBlob(
          new Blob([bytes as BlobPart], { type: "application/pdf" }),
          `${stem} (${mode}).pdf`,
        );
      }
      toast.success("Done");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't extract pages");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => handleFile(f[0])}
        title="Drop a PDF to split by parity"
        hint="Pull out odd, even, or both at once"
      />
    );
  }

  const oddCount = Math.ceil(pageCount / 2);
  const evenCount = Math.floor(pageCount / 2);

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          What to extract
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ModeChip active={mode === "odd"} onClick={() => setMode("odd")}>
            Odd pages — {oddCount}
          </ModeChip>
          <ModeChip active={mode === "even"} onClick={() => setMode("even")}>
            Even pages — {evenCount}
          </ModeChip>
          <ModeChip active={mode === "both"} onClick={() => setMode("both")}>
            Both as zip
          </ModeChip>
        </div>
      </div>

      <ActionBar
        status={`${pageCount} pages total`}
        primary={
          <button
            onClick={handleApply}
            disabled={busy || pageCount === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Extracting…" : "Extract & download"}
          </button>
        }
      />
    </div>
  );
}
