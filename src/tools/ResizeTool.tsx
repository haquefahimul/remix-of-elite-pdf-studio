import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { FileText, X } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";

const PRESETS: Record<string, { w: number; h: number; label: string }> = {
  a4: { w: 595.28, h: 841.89, label: "A4 (210 × 297 mm)" },
  letter: { w: 612, h: 792, label: "US Letter (8.5 × 11 in)" },
  legal: { w: 612, h: 1008, label: "US Legal (8.5 × 14 in)" },
  a3: { w: 841.89, h: 1190.55, label: "A3 (297 × 420 mm)" },
  a5: { w: 419.53, h: 595.28, label: "A5 (148 × 210 mm)" },
  tabloid: { w: 792, h: 1224, label: "Tabloid (11 × 17 in)" },
};

export function ResizeTool() {
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<keyof typeof PRESETS>("a4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape" | "auto">("auto");
  const [mode, setMode] = useState<"fit" | "stretch">("fit");
  const [busy, setBusy] = useState(false);

  const handleResize = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf);
      const out = await PDFDocument.create();
      const target = PRESETS[preset];

      for (let i = 0; i < src.getPageCount(); i++) {
        const srcPage = src.getPage(i);
        const sw = srcPage.getWidth();
        const sh = srcPage.getHeight();
        let tw = target.w;
        let th = target.h;
        if (orientation === "landscape" || (orientation === "auto" && sw > sh)) {
          tw = target.h;
          th = target.w;
        }
        const embedded = await out.embedPage(srcPage);
        const newPage = out.addPage([tw, th]);
        if (mode === "stretch") {
          newPage.drawPage(embedded, { x: 0, y: 0, width: tw, height: th });
        } else {
          const scale = Math.min(tw / sw, th / sh);
          const w = sw * scale;
          const h = sh * scale;
          newPage.drawPage(embedded, {
            x: (tw - w) / 2,
            y: (th - h) / 2,
            width: w,
            height: h,
          });
        }
      }

      const bytes = await out.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${baseName(file.name)}-resized.pdf`);
      toast.success("Resized PDF ready");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't resize that PDF");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to resize"
        hint="Switch to A4, Letter, Legal, A3, A5, or Tabloid"
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-tool-crop/10 text-tool-crop">
          <FileText className="h-4 w-4" />
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

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Page size
          </span>
          <div className="mt-3 grid gap-1.5">
            {Object.entries(PRESETS).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setPreset(key as keyof typeof PRESETS)}
                className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  preset === key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {val.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Orientation
          </span>
          <div className="mt-3 grid gap-1.5">
            {(
              [
                { value: "auto", label: "Auto (match source)" },
                { value: "portrait", label: "Portrait" },
                { value: "landscape", label: "Landscape" },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                onClick={() => setOrientation(o.value)}
                className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  orientation === o.value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Scale mode
          </span>
          <div className="mt-3 grid gap-1.5">
            {(
              [
                { value: "fit", label: "Fit (preserve ratio)" },
                { value: "stretch", label: "Stretch to fill" },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                onClick={() => setMode(o.value)}
                className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  mode === o.value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ActionBar
        status={`${PRESETS[preset].label} · ${orientation} · ${mode}`}
        primary={
          <button
            onClick={handleResize}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Resizing…" : "Export resized PDF"}
          </button>
        }
      />
    </div>
  );
}
