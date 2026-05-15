import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { FlipHorizontal, X } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";

export function MirrorTool() {
  const [file, setFile] = useState<File | null>(null);
  const [axis, setAxis] = useState<"horizontal" | "vertical" | "both">("horizontal");
  const [busy, setBusy] = useState(false);

  const handleMirror = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf);
      const out = await PDFDocument.create();

      for (let i = 0; i < src.getPageCount(); i++) {
        const srcPage = src.getPage(i);
        const w = srcPage.getWidth();
        const h = srcPage.getHeight();
        const embedded = await out.embedPage(srcPage);
        const newPage = out.addPage([w, h]);

        const flipH = axis === "horizontal" || axis === "both";
        const flipV = axis === "vertical" || axis === "both";

        newPage.drawPage(embedded, {
          x: flipH ? w : 0,
          y: flipV ? h : 0,
          xScale: flipH ? -1 : 1,
          yScale: flipV ? -1 : 1,
        });
      }

      const bytes = await out.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)}-mirrored.pdf`
      );
      toast.success("Mirrored PDF ready");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't mirror that PDF");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to mirror"
        hint="Flip pages horizontally, vertically, or both"
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-tool-rotate/10 text-tool-rotate">
          <FlipHorizontal className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
        </div>
        <button
          onClick={() => setFile(null)}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Remove"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Flip axis
        </span>
        <div className="mt-3 inline-flex rounded-full border border-border bg-background p-1">
          {(
            [
              { value: "horizontal", label: "Horizontal" },
              { value: "vertical", label: "Vertical" },
              { value: "both", label: "Both (180°)" },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              onClick={() => setAxis(o.value)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                axis === o.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <ActionBar
        status={`Flipping ${axis}`}
        primary={
          <button
            onClick={handleMirror}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Mirroring…" : "Export mirrored PDF"}
          </button>
        }
      />
    </div>
  );
}
