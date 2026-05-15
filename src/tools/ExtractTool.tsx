import { useEffect, useMemo, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { PageGrid } from "@/components/PageGrid";
import { renderThumbnails, type PageThumb } from "@/lib/pdf-render";
import { downloadBlob, baseName } from "@/lib/format";
import { FileHeader, ModeChip, ThumbsLoading } from "./SplitTool";

type Mode = "select" | "range";

export function ExtractTool() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("select");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rangeText, setRangeText] = useState("1-3, 5");

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setLoading(true);
    setThumbs([]);
    setSelected(new Set());
    file
      .arrayBuffer()
      .then((buf) => renderThumbnails(buf, { maxWidth: 200 }))
      .then((t) => !cancelled && setThumbs(t))
      .catch(() => toast.error("Couldn't read that PDF."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [file]);

  const total = thumbs.length;

  const rangeIndices = useMemo(() => {
    if (total === 0) return [];
    const out = new Set<number>();
    for (const part of rangeText.split(",").map((s) => s.trim()).filter(Boolean)) {
      const m = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
      if (!m) continue;
      const a = Number(m[1]);
      const b = m[2] ? Number(m[2]) : a;
      const lo = Math.max(1, Math.min(a, b));
      const hi = Math.min(total, Math.max(a, b));
      for (let i = lo; i <= hi; i++) out.add(i - 1);
    }
    return Array.from(out).sort((a, b) => a - b);
  }, [rangeText, total]);

  const togglePage = (idx: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  const handleExtract = async () => {
    if (!file) return;
    const indices =
      mode === "select" ? Array.from(selected).sort((a, b) => a - b) : rangeIndices;
    if (indices.length === 0) {
      toast.error("Pick at least one page.");
      return;
    }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, indices);
      pages.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)} (extracted ${indices.length}p).pdf`
      );
      toast.success(`Extracted ${indices.length} pages`);
    } catch (err) {
      console.error(err);
      toast.error("Extract failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to extract from"
        hint="Pick the pages you want to keep"
      />
    );
  }

  const count = mode === "select" ? selected.size : rangeIndices.length;

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 flex flex-wrap gap-2">
        <ModeChip active={mode === "select"} onClick={() => setMode("select")}>Click pages</ModeChip>
        <ModeChip active={mode === "range"} onClick={() => setMode("range")}>By range</ModeChip>
      </div>

      {mode === "range" && (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Page range
          </label>
          <input
            value={rangeText}
            onChange={(e) => setRangeText(e.target.value)}
            placeholder="e.g. 1-3, 5, 8-10"
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {rangeIndices.length} unique page{rangeIndices.length === 1 ? "" : "s"} selected
          </p>
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <ThumbsLoading />
        ) : (
          <PageGrid
            thumbs={thumbs}
            selected={mode === "select" ? selected : new Set(rangeIndices)}
            onTogglePage={mode === "select" ? togglePage : undefined}
          />
        )}
      </div>

      <ActionBar
        status={`${count} of ${total} pages will be exported`}
        secondary={
          mode === "select" && selected.size > 0 ? (
            <button
              onClick={() => setSelected(new Set(thumbs.map((t) => t.pageIndex)))}
              className="rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Select all
            </button>
          ) : null
        }
        primary={
          <button
            onClick={handleExtract}
            disabled={busy || loading || count === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Extracting…" : `Extract ${count} page${count === 1 ? "" : "s"}`}
          </button>
        }
      />
    </div>
  );
}
