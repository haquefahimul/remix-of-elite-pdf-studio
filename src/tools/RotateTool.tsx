import { useEffect, useState } from "react";
import { PDFDocument, degrees } from "pdf-lib";
import { toast } from "sonner";
import { RotateCw, RotateCcw } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { PageGrid } from "@/components/PageGrid";
import { renderThumbnails, type PageThumb } from "@/lib/pdf-render";
import { downloadBlob, baseName } from "@/lib/format";
import { FileHeader, ThumbsLoading } from "./SplitTool";

export function RotateTool() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setLoading(true);
    setThumbs([]);
    setRotations({});
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

  const togglePage = (idx: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  const rotateSelected = (delta: 90 | -90) => {
    const targets = selected.size > 0 ? Array.from(selected) : thumbs.map((t) => t.pageIndex);
    setRotations((prev) => {
      const next = { ...prev };
      for (const i of targets) {
        next[i] = (((next[i] ?? 0) + delta) % 360 + 360) % 360;
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      doc.getPages().forEach((p, i) => {
        const extra = rotations[i] ?? 0;
        if (extra === 0) return;
        const current = p.getRotation().angle;
        p.setRotation(degrees((current + extra) % 360));
      });
      const bytes = await doc.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${baseName(file.name)} (rotated).pdf`);
      toast.success("Rotated PDF ready");
    } catch (err) {
      console.error(err);
      toast.error("Save failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone accept="pdf" onFiles={(f) => setFile(f[0])} title="Drop a PDF to rotate" hint="or click to browse" />
    );
  }

  const hasChanges = Object.values(rotations).some((r) => r !== 0);
  const targetCount = selected.size > 0 ? selected.size : thumbs.length;

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
        <span className="px-1 text-sm text-muted-foreground">
          {selected.size > 0 ? `${selected.size} selected` : "Apply to all pages"}
        </span>
        <button
          onClick={() => rotateSelected(-90)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
        >
          <RotateCcw className="h-4 w-4" /> Left {targetCount > 0 ? `(${targetCount})` : ""}
        </button>
        <button
          onClick={() => rotateSelected(90)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
        >
          <RotateCw className="h-4 w-4" /> Right {targetCount > 0 ? `(${targetCount})` : ""}
        </button>
        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear selection
          </button>
        )}
      </div>

      <div className="mt-6">
        {loading ? (
          <ThumbsLoading />
        ) : (
          <PageGrid thumbs={thumbs} rotations={rotations} selected={selected} onTogglePage={togglePage} />
        )}
      </div>

      <ActionBar
        status={hasChanges ? "Unsaved rotations" : "Click pages to select, then rotate"}
        secondary={
          hasChanges && (
            <button
              onClick={() => setRotations({})}
              className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Reset rotations
            </button>
          )
        }
        primary={
          <button
            onClick={handleSave}
            disabled={busy || loading || !hasChanges}
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
