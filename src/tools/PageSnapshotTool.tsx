import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { ModeChip } from "./SplitTool";
import { downloadBlob, formatBytes, baseName } from "@/lib/format";
import { renderThumbnails, type PageThumb } from "@/lib/pdf-render";
import { pdfjsLib } from "@/lib/pdf-worker";

type Format = "png" | "jpeg" | "webp";

export function PageSnapshotTool() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageIdx, setPageIdx] = useState(0);
  const [scale, setScale] = useState(2);
  const [format, setFormat] = useState<Format>("png");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) return;
    let cancel = false;
    setLoading(true);
    file
      .arrayBuffer()
      .then((b) => renderThumbnails(b, { maxWidth: 180 }))
      .then((t) => !cancel && (setThumbs(t), setPageIdx(0)))
      .catch(() => toast.error("Couldn't read that PDF"))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [file]);

  const snap = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
      const page = await pdf.getPage(pageIdx + 1);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d", { alpha: format === "png" })!;
      if (format !== "png") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      await page.render({
        canvas,
        canvasContext: ctx,
        viewport,
      } as Parameters<typeof page.render>[0]).promise;
      const mime = format === "png" ? "image/png" : format === "jpeg" ? "image/jpeg" : "image/webp";
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), mime, 0.92),
      );
      const ext = format === "jpeg" ? "jpg" : format;
      downloadBlob(blob, `${baseName(file.name)} - page ${pageIdx + 1}.${ext}`);
      page.cleanup();
      await pdf.destroy();
      toast.success("Saved");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't render that page");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(fs) => setFile(fs[0])}
        title="Drop a PDF to snapshot one page"
        hint="Pick a page, choose format & resolution, download as image"
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <p className="text-sm">
          <span className="font-medium">{file.name}</span>{" "}
          <span className="text-muted-foreground">· {formatBytes(file.size)}</span>
        </p>
        <button
          onClick={() => {
            setFile(null);
            setThumbs([]);
          }}
          className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Change
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Format</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ModeChip active={format === "png"} onClick={() => setFormat("png")}>PNG</ModeChip>
            <ModeChip active={format === "jpeg"} onClick={() => setFormat("jpeg")}>JPG</ModeChip>
            <ModeChip active={format === "webp"} onClick={() => setFormat("webp")}>WebP</ModeChip>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Resolution — {scale.toFixed(1)}× ({Math.round(scale * 72)} DPI)
          </label>
          <input
            type="range"
            min={1}
            max={4}
            step={0.5}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
          />
        </div>
      </div>

      {loading ? (
        <div className="mt-6 grid place-items-center rounded-2xl border border-border bg-surface py-16">
          <Spinner className="h-5 w-5" />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7">
          {thumbs.map((t) => (
            <button
              key={t.pageIndex}
              onClick={() => setPageIdx(t.pageIndex)}
              className={`overflow-hidden rounded-xl border transition-all ${
                pageIdx === t.pageIndex
                  ? "border-foreground ring-2 ring-foreground"
                  : "border-border hover:border-border-strong"
              }`}
            >
              <img src={t.dataUrl} alt={`Page ${t.pageIndex + 1}`} className="block w-full" />
              <p className="bg-surface py-1 text-center text-xs text-muted-foreground">
                {t.pageIndex + 1}
              </p>
            </button>
          ))}
        </div>
      )}

      <ActionBar
        status={`Page ${pageIdx + 1} of ${thumbs.length || "?"}`}
        primary={
          <button
            onClick={snap}
            disabled={busy || thumbs.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Rendering…" : "Save snapshot"}
          </button>
        }
      />
    </div>
  );
}
