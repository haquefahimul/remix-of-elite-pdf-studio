import { useEffect, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { PageGrid } from "@/components/PageGrid";
import { renderThumbnails, type PageThumb } from "@/lib/pdf-render";
import { downloadBlob, baseName } from "@/lib/format";
import { FileHeader, ThumbsLoading } from "./SplitTool";

export function DeletePagesTool() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [marked, setMarked] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setLoading(true);
    setThumbs([]);
    setMarked(new Set());
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

  const toggle = (idx: number) =>
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  const handleSave = async () => {
    if (!file) return;
    if (marked.size === 0) {
      toast.error("Pick at least one page to delete.");
      return;
    }
    if (marked.size === thumbs.length) {
      toast.error("Can't delete every page.");
      return;
    }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const keep = thumbs.map((t) => t.pageIndex).filter((i) => !marked.has(i));
      const pages = await out.copyPages(src, keep);
      pages.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${baseName(file.name)} (trimmed).pdf`);
      toast.success(`Removed ${marked.size} page${marked.size === 1 ? "" : "s"}`);
    } catch (err) {
      console.error(err);
      toast.error("Save failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to trim"
        hint="or click to browse"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-4 rounded-2xl border border-dashed border-border-strong/50 bg-accent/30 px-4 py-3 text-sm text-muted-foreground">
        Click any page to mark it for removal. Click again to keep it.
      </div>

      <div className="mt-6">
        {loading ? (
          <ThumbsLoading />
        ) : (
          <PageGrid
            thumbs={thumbs}
            selected={marked}
            onTogglePage={toggle}
            mode="delete"
          />
        )}
      </div>

      <ActionBar
        status={
          marked.size > 0
            ? `${marked.size} of ${thumbs.length} pages will be removed`
            : `${thumbs.length} pages — none marked yet`
        }
        secondary={
          marked.size > 0 && (
            <button
              onClick={() => setMarked(new Set())}
              className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )
        }
        primary={
          <button
            onClick={handleSave}
            disabled={busy || loading || marked.size === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Saving…" : "Apply & download"}
          </button>
        }
      />
    </div>
  );
}
