import { useEffect, useMemo, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { PageGrid } from "@/components/PageGrid";
import { renderThumbnails, type PageThumb } from "@/lib/pdf-render";
import { downloadBlob, formatBytes, baseName } from "@/lib/format";

type Mode = "ranges" | "select" | "every";

export function SplitTool() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("ranges");
  const [rangeText, setRangeText] = useState("1-3, 5");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setLoading(true);
    setThumbs([]);
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

  const totalPages = thumbs.length;

  const parsedRanges = useMemo(() => parseRanges(rangeText, totalPages), [rangeText, totalPages]);

  const togglePage = (idx: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  const handleSplit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const stem = baseName(file.name);

      if (mode === "ranges") {
        if (parsedRanges.length === 0) {
          toast.error("Enter at least one valid range, e.g. 1-3, 5");
          return;
        }
        // One PDF per range
        const zip = await dynamicZip();
        for (let i = 0; i < parsedRanges.length; i++) {
          const range = parsedRanges[i];
          const out = await PDFDocument.create();
          const pages = await out.copyPages(src, range);
          pages.forEach((p) => out.addPage(p));
          const bytes = await out.save();
          const label = humanRange(range);
          zip.file(`${stem} (${label}).pdf`, bytes);
        }
        const blob = await zip.generateAsync({ type: "blob" });
        downloadBlob(blob, `${stem} (split).zip`);
        toast.success(`Created ${parsedRanges.length} PDFs`);
      } else if (mode === "select") {
        if (selected.size === 0) {
          toast.error("Pick at least one page.");
          return;
        }
        const out = await PDFDocument.create();
        const indices = Array.from(selected).sort((a, b) => a - b);
        const pages = await out.copyPages(src, indices);
        pages.forEach((p) => out.addPage(p));
        const bytes = await out.save();
        downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${stem} (extracted).pdf`);
        toast.success("Extracted pages ready");
      } else {
        // every page → individual file zipped
        const zip = await dynamicZip();
        for (let i = 0; i < totalPages; i++) {
          const out = await PDFDocument.create();
          const [p] = await out.copyPages(src, [i]);
          out.addPage(p);
          const bytes = await out.save();
          zip.file(`${stem} - page ${i + 1}.pdf`, bytes);
        }
        const blob = await zip.generateAsync({ type: "blob" });
        downloadBlob(blob, `${stem} (pages).zip`);
        toast.success(`Created ${totalPages} files`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Split failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to split"
        hint="or click to browse"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => { setFile(null); setSelected(new Set()); }} />

      <div className="mt-6 flex flex-wrap gap-2">
        <ModeChip active={mode === "ranges"} onClick={() => setMode("ranges")}>By ranges</ModeChip>
        <ModeChip active={mode === "select"} onClick={() => setMode("select")}>Pick pages</ModeChip>
        <ModeChip active={mode === "every"} onClick={() => setMode("every")}>Every page</ModeChip>
      </div>

      {mode === "ranges" && (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Page ranges
          </label>
          <input
            value={rangeText}
            onChange={(e) => setRangeText(e.target.value)}
            placeholder="e.g. 1-3, 5, 8-10"
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {parsedRanges.length === 0
              ? "Enter ranges separated by commas. Each range becomes its own PDF."
              : `${parsedRanges.length} file${parsedRanges.length === 1 ? "" : "s"} will be created`}
          </p>
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <ThumbsLoading />
        ) : (
          <PageGrid
            thumbs={thumbs}
            selected={mode === "select" ? selected : undefined}
            onTogglePage={mode === "select" ? togglePage : undefined}
          />
        )}
      </div>

      <ActionBar
        status={`${totalPages} pages`}
        primary={
          <button
            onClick={handleSplit}
            disabled={busy || loading || totalPages === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Splitting…" : "Split & download"}
          </button>
        }
      />
    </div>
  );
}

export function FileHeader({ file, onReset }: { file: File; onReset: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
      </div>
      <button
        onClick={onReset}
        className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        Choose different file
      </button>
    </div>
  );
}

export function ThumbsLoading() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}

export function ModeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm transition-all ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function parseRanges(text: string, total: number): number[][] {
  if (total === 0) return [];
  const parts = text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const out: number[][] = [];
  for (const part of parts) {
    const m = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!m) continue;
    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : start;
    if (start < 1 || end < 1 || start > total || end > total || start > end) continue;
    const arr: number[] = [];
    for (let i = start; i <= end; i++) arr.push(i - 1);
    out.push(arr);
  }
  return out;
}

function humanRange(indices: number[]): string {
  if (indices.length === 1) return `page ${indices[0] + 1}`;
  return `pages ${indices[0] + 1}-${indices[indices.length - 1] + 1}`;
}

// JSZip is loaded lazily so it's not in the bundle for tools that don't need it.
async function dynamicZip() {
  const mod = await import("jszip");
  return new mod.default();
}
