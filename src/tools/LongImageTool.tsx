import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader, ModeChip } from "./SplitTool";
import { pdfjsLib } from "@/lib/pdf-worker";
import { downloadBlob, baseName } from "@/lib/format";

type Format = "png" | "jpeg";

export function LongImageTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [gap, setGap] = useState(8);
  const [format, setFormat] = useState<Format>("png");
  const [quality, setQuality] = useState(92);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (!file) return;
    let cancel = false;
    (async () => {
      try {
        const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        if (!cancel) setPageCount(doc.numPages);
        await doc.destroy();
      } catch {
        if (!cancel) toast.error("Couldn't read that PDF");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [file]);

  const handleApply = async () => {
    if (!file) return;
    setBusy(true);
    setProgress({ done: 0, total: pageCount });
    try {
      const buf = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buf }).promise;

      // First pass: collect viewports
      const pages = [];
      let maxW = 0;
      let totalH = 0;
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale });
        const w = Math.ceil(vp.width);
        const h = Math.ceil(vp.height);
        maxW = Math.max(maxW, w);
        totalH += h;
        pages.push({ page, vp, w, h });
      }
      totalH += gap * Math.max(0, pages.length - 1);

      // Cap canvas size to avoid browser limits (~32k px per side)
      const MAX = 32000;
      if (totalH > MAX || maxW > MAX) {
        toast.error("Output too large — try a smaller scale");
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = maxW;
      canvas.height = totalH;
      const isPng = format === "png";
      const ctx = canvas.getContext("2d", { alpha: isPng })!;
      ctx.fillStyle = isPng ? "rgba(0,0,0,0)" : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let y = 0;
      for (let i = 0; i < pages.length; i++) {
        const { page, vp, w, h } = pages[i];
        const sub = document.createElement("canvas");
        sub.width = w;
        sub.height = h;
        const sctx = sub.getContext("2d", { alpha: isPng })!;
        if (!isPng) {
          sctx.fillStyle = "#ffffff";
          sctx.fillRect(0, 0, w, h);
        }
        await page.render({
          canvas: sub,
          canvasContext: sctx,
          viewport: vp,
        } as Parameters<typeof page.render>[0]).promise;
        const x = Math.floor((maxW - w) / 2);
        ctx.drawImage(sub, x, y);
        y += h + gap;
        page.cleanup();
        setProgress({ done: i + 1, total: pages.length });
      }
      await doc.destroy();

      const mime = isPng ? "image/png" : "image/jpeg";
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob(
          (b) => (b ? res(b) : rej(new Error("encode failed"))),
          mime,
          isPng ? undefined : quality / 100,
        ),
      );
      const ext = isPng ? "png" : "jpg";
      downloadBlob(blob, `${baseName(file.name)}-long.${ext}`);
      toast.success("Long image ready");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't render long image");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to render as one tall image"
        hint="Great for scrolling previews and chat-friendly thumbnails"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Format</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ModeChip active={format === "png"} onClick={() => setFormat("png")}>PNG</ModeChip>
            <ModeChip active={format === "jpeg"} onClick={() => setFormat("jpeg")}>JPG</ModeChip>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Render scale — {scale.toFixed(2)}×
          </label>
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.1}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
          />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Gap between pages — {gap}px
          </label>
          <input
            type="range"
            min={0}
            max={48}
            value={gap}
            onChange={(e) => setGap(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
          />
        </div>
        {format === "jpeg" && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              JPG quality — {quality}
            </label>
            <input
              type="range"
              min={40}
              max={100}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="mt-2 w-full accent-foreground"
            />
          </div>
        )}
      </div>

      <ActionBar
        status={
          progress
            ? `Rendering page ${progress.done}/${progress.total}…`
            : `${pageCount} page${pageCount === 1 ? "" : "s"} ready`
        }
        primary={
          <button
            onClick={handleApply}
            disabled={busy || pageCount === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Rendering…" : "Render & download"}
          </button>
        }
      />
    </div>
  );
}
