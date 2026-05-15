import { useEffect, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { PageGrid } from "@/components/PageGrid";
import { renderThumbnails, type PageThumb } from "@/lib/pdf-render";
import { downloadBlob, baseName } from "@/lib/format";
import { FileHeader, ThumbsLoading } from "./SplitTool";

export function OrganizeTool() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setLoading(true);
    setThumbs([]);
    setOrder([]);
    file
      .arrayBuffer()
      .then((buf) => renderThumbnails(buf, { maxWidth: 220 }))
      .then((t) => {
        if (cancelled) return;
        setThumbs(t);
        setOrder(t.map((x) => x.pageIndex));
      })
      .catch(() => toast.error("Couldn't read that PDF."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [file]);

  const reorder = (from: number, to: number) => {
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleSave = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, order);
      pages.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${baseName(file.name)} (organized).pdf`);
      toast.success("Organized PDF ready");
    } catch (err) {
      console.error(err);
      toast.error("Save failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone accept="pdf" onFiles={(f) => setFile(f[0])} title="Drop a PDF to reorder" hint="or click to browse" />
    );
  }

  const changed =
    order.length === thumbs.length && order.some((idx, pos) => idx !== thumbs[pos]?.pageIndex);

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-4 rounded-2xl border border-dashed border-border-strong/50 bg-accent/30 px-4 py-3 text-sm text-muted-foreground">
        Drag any page to a new position. Drop to commit.
      </div>

      <div className="mt-6">
        {loading ? (
          <ThumbsLoading />
        ) : (
          <PageGrid thumbs={thumbs} order={order} onReorder={reorder} />
        )}
      </div>

      <ActionBar
        status={changed ? "Order changed" : "Drag to rearrange"}
        secondary={
          changed && (
            <button
              onClick={() => setOrder(thumbs.map((t) => t.pageIndex))}
              className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Reset order
            </button>
          )
        }
        primary={
          <button
            onClick={handleSave}
            disabled={busy || loading || !changed}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Saving…" : "Save & download"}
          </button>
        }
      />
    </div>
  );
}
