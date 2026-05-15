import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader, ModeChip } from "./SplitTool";
import { downloadBlob, baseName } from "@/lib/format";

const SIZES: Record<string, [number, number] | "match"> = {
  "Match document": "match",
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008],
  A3: [841.89, 1190.55],
  A5: [419.53, 595.28],
};

type Position = "before" | "after" | "end";

function parsePages(text: string, total: number): number[] {
  const out = new Set<number>();
  for (const part of text.split(",").map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < 1 || a > total || b > total || a > b) continue;
    for (let i = a; i <= b; i++) out.add(i - 1);
  }
  return Array.from(out).sort((a, b) => a - b);
}

export function InsertBlankTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState("");
  const [position, setPosition] = useState<Position>("after");
  const [sizeKey, setSizeKey] = useState<keyof typeof SIZES>("Match document");
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

  const targets = position === "end" ? [] : parsePages(pages, pageCount);
  const insertCount = position === "end" ? 1 : targets.length;

  const handleApply = async () => {
    if (!file) return;
    if (position !== "end" && targets.length === 0) {
      toast.error("Pick at least one valid page");
      return;
    }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, src.getPageIndices());

      const sizeOf = (idx: number): [number, number] => {
        if (sizeKey === "Match document") {
          const p = src.getPage(idx);
          const s = p.getSize();
          return [s.width, s.height];
        }
        return SIZES[sizeKey] as [number, number];
      };

      if (position === "end") {
        copied.forEach((p) => out.addPage(p));
        const last = src.getPageCount() - 1;
        out.addPage(sizeOf(Math.max(0, last)));
      } else {
        const targetSet = new Set(targets);
        for (let i = 0; i < copied.length; i++) {
          if (position === "before" && targetSet.has(i)) out.addPage(sizeOf(i));
          out.addPage(copied[i]);
          if (position === "after" && targetSet.has(i)) out.addPage(sizeOf(i));
        }
      }

      const bytes = await out.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)}-with-blanks.pdf`,
      );
      toast.success(`Inserted ${insertCount} blank page${insertCount === 1 ? "" : "s"}`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't insert pages");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => handleFile(f[0])}
        title="Drop a PDF to add blank pages"
        hint="Insert blanks before, after, or at the end"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Where to insert
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ModeChip active={position === "before"} onClick={() => setPosition("before")}>Before pages</ModeChip>
          <ModeChip active={position === "after"} onClick={() => setPosition("after")}>After pages</ModeChip>
          <ModeChip active={position === "end"} onClick={() => setPosition("end")}>At end</ModeChip>
        </div>
      </div>

      <div className="mt-4 grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2">
        {position !== "end" && (
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Page numbers
            </span>
            <input
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              placeholder="e.g. 1, 3, 5-7"
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              {targets.length} page{targets.length === 1 ? "" : "s"} selected
            </span>
          </label>
        )}
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Blank size</span>
          <select
            value={sizeKey}
            onChange={(e) => setSizeKey(e.target.value as keyof typeof SIZES)}
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            {Object.keys(SIZES).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
      </div>

      <ActionBar
        status={`${pageCount} pages · ${insertCount} blank to insert`}
        primary={
          <button
            onClick={handleApply}
            disabled={busy || pageCount === 0 || (position !== "end" && targets.length === 0)}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Working…" : "Insert & download"}
          </button>
        }
      />
    </div>
  );
}
