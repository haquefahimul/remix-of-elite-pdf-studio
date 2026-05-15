import { useMemo, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader, ModeChip } from "./SplitTool";
import { downloadBlob, baseName } from "@/lib/format";

type Mode = "interleave" | "block";

function parseRanges(text: string, total: number): number[] {
  if (!text.trim()) return Array.from({ length: total }, (_, i) => i);
  const parts = text.split(",").map((s) => s.trim()).filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    const m = p.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < 1 || a > total || b > total || a > b) continue;
    for (let i = a; i <= b; i++) out.push(i - 1);
  }
  return out;
}

export function RepeatTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(2);
  const [pageCount, setPageCount] = useState(0);
  const [rangeText, setRangeText] = useState("");
  const [mode, setMode] = useState<Mode>("block");

  const handleFile = async (f: File) => {
    setFile(f);
    try {
      const buf = await f.arrayBuffer();
      const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      setPageCount(pdf.getPageCount());
    } catch {
      setPageCount(0);
    }
  };

  const sourceIndices = useMemo(() => parseRanges(rangeText, pageCount), [rangeText, pageCount]);
  const finalCount = sourceIndices.length * count;

  const handleApply = async () => {
    if (!file) return;
    if (sourceIndices.length === 0) {
      toast.error("No valid pages selected");
      return;
    }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const out = await PDFDocument.create();

      let plan: number[];
      if (mode === "block") {
        // 1,2,3 → 1,2,3,1,2,3
        plan = [];
        for (let r = 0; r < count; r++) plan.push(...sourceIndices);
      } else {
        // 1,2,3 → 1,1,2,2,3,3
        plan = [];
        for (const idx of sourceIndices) for (let r = 0; r < count; r++) plan.push(idx);
      }

      const pages = await out.copyPages(src, plan);
      pages.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)}-x${count}.pdf`,
      );
      toast.success(`Created ${plan.length}-page PDF`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't repeat pages");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => handleFile(f[0])}
        title="Drop a PDF to duplicate"
        hint="Repeat the whole file or just a range, N times"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => { setFile(null); setPageCount(0); }} />

      <div className="mt-6 grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Pages to repeat
          </span>
          <input
            value={rangeText}
            onChange={(e) => setRangeText(e.target.value)}
            placeholder={`All pages (1-${pageCount})`}
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            e.g. 1-3, 5 — leave blank for all
          </span>
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Number of copies
          </span>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={2}
              max={50}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="flex-1 accent-foreground"
            />
            <input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm tabular-nums outline-none focus:border-foreground"
            />
          </div>
        </label>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Repeat order
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ModeChip active={mode === "block"} onClick={() => setMode("block")}>
            Block — 1,2,3,1,2,3
          </ModeChip>
          <ModeChip active={mode === "interleave"} onClick={() => setMode("interleave")}>
            Interleave — 1,1,2,2,3,3
          </ModeChip>
        </div>
      </div>

      <ActionBar
        status={`${sourceIndices.length} page${sourceIndices.length === 1 ? "" : "s"} × ${count} = ${finalCount}-page PDF`}
        primary={
          <button
            onClick={handleApply}
            disabled={busy || finalCount === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Building…" : "Repeat & download"}
          </button>
        }
      />
    </div>
  );
}
