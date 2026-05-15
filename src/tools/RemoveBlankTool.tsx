import { useEffect, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader, ThumbsLoading } from "./SplitTool";
import { renderThumbnails, type PageThumb } from "@/lib/pdf-render";
import { downloadBlob, baseName } from "@/lib/format";

export function RemoveBlankTool() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [threshold, setThreshold] = useState(99);
  const [blanks, setBlanks] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!file) return;
    let cancel = false;
    setLoading(true);
    setThumbs([]);
    file
      .arrayBuffer()
      .then((b) => renderThumbnails(b, { maxWidth: 200 }))
      .then((t) => !cancel && setThumbs(t))
      .catch(() => toast.error("Couldn't read that PDF."))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [file]);

  // Compute blanks whenever thumbs/threshold change
  useEffect(() => {
    if (thumbs.length === 0) {
      setBlanks(new Set());
      return;
    }
    let cancel = false;
    (async () => {
      const found = new Set<number>();
      for (const t of thumbs) {
        const img = new Image();
        img.src = t.dataUrl;
        await img.decode();
        const c = document.createElement("canvas");
        const W = 80;
        const H = Math.max(1, Math.round((img.height / img.width) * W));
        c.width = W;
        c.height = H;
        const ctx = c.getContext("2d", { alpha: false })!;
        ctx.drawImage(img, 0, 0, W, H);
        const d = ctx.getImageData(0, 0, W, H).data;
        let white = 0;
        const total = W * H;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) white++;
        }
        const pct = (white / total) * 100;
        if (pct >= threshold) found.add(t.pageIndex);
      }
      if (!cancel) setBlanks(found);
    })();
    return () => {
      cancel = true;
    };
  }, [thumbs, threshold]);

  const handleApply = async () => {
    if (!file) return;
    if (blanks.size === thumbs.length) {
      toast.error("Every page is blank — nothing to keep");
      return;
    }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const keep: number[] = [];
      for (let i = 0; i < src.getPageCount(); i++) {
        if (!blanks.has(i)) keep.push(i);
      }
      const pages = await out.copyPages(src, keep);
      pages.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)}-no-blanks.pdf`,
      );
      toast.success(`Removed ${blanks.size} blank page${blanks.size === 1 ? "" : "s"}`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't process PDF");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to clean up"
        hint="Folio scans every page and drops the blank ones"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Whiteness threshold — {threshold}%
        </label>
        <input
          type="range"
          min={90}
          max={100}
          step={0.5}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="mt-2 w-full accent-foreground"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Pages with at least this much white area are flagged as blank.
        </p>
      </div>

      <div className="mt-6">
        {loading ? (
          <ThumbsLoading />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {thumbs.map((t) => {
              const isBlank = blanks.has(t.pageIndex);
              return (
                <div
                  key={t.pageIndex}
                  className={`relative overflow-hidden rounded-2xl border bg-surface transition-all ${
                    isBlank ? "border-tool-delete opacity-50" : "border-border"
                  }`}
                >
                  <img src={t.dataUrl} alt={`Page ${t.pageIndex + 1}`} className="block w-full" />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-background/80 px-2 py-1 text-xs backdrop-blur">
                    <span>Page {t.pageIndex + 1}</span>
                    {isBlank && <span className="text-tool-delete">Blank</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ActionBar
        status={`${blanks.size} blank · ${thumbs.length - blanks.size} kept`}
        primary={
          <button
            onClick={handleApply}
            disabled={busy || loading || blanks.size === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Cleaning…" : "Remove blanks & download"}
          </button>
        }
      />
    </div>
  );
}
