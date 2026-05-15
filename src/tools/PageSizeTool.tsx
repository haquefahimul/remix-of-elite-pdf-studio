import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { X } from "lucide-react";

type SizeKey = "A4" | "Letter" | "Legal" | "A3" | "A5" | "Tabloid";
type Orient = "portrait" | "landscape";
type Fit = "fit" | "fill" | "stretch";

const SIZES: Record<SizeKey, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008],
  A3: [841.89, 1190.55],
  A5: [419.53, 595.28],
  Tabloid: [792, 1224],
};

export function PageSizeTool() {
  const [file, setFile] = useState<File | null>(null);
  const [size, setSize] = useState<SizeKey>("A4");
  const [orient, setOrient] = useState<Orient>("portrait");
  const [fit, setFit] = useState<Fit>("fit");
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf);
      const out = await PDFDocument.create();

      let [tw, th] = SIZES[size];
      if (orient === "landscape" && tw < th) [tw, th] = [th, tw];
      if (orient === "portrait" && tw > th) [tw, th] = [th, tw];

      const pageCount = src.getPageCount();
      const indices = Array.from({ length: pageCount }, (_, i) => i);
      const embedded = await out.embedPdf(src, indices);

      for (const ep of embedded) {
        const page = out.addPage([tw, th]);
        const sw = ep.width;
        const sh = ep.height;
        if (fit === "stretch") {
          page.drawPage(ep, { x: 0, y: 0, width: tw, height: th });
        } else {
          let scale: number;
          if (fit === "fit") scale = Math.min(tw / sw, th / sh);
          else scale = Math.max(tw / sw, th / sh); // fill (may overflow — clip via page bounds)
          const dw = sw * scale;
          const dh = sh * scale;
          page.drawPage(ep, {
            x: (tw - dw) / 2,
            y: (th - dh) / 2,
            width: dw,
            height: dh,
          });
        }
      }

      const bytes = await out.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)} (${size} ${orient}).pdf`,
      );
      toast.success(`Resized to ${size} ${orient}`);
    } catch (e) {
      console.error(e);
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
        title="Drop a PDF to resize pages"
        hint="Convert any document to A4, Letter, A3, Legal, A5, or Tabloid"
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <p className="text-sm">
          <span className="font-medium">{file.name}</span>{" "}
          <span className="text-muted-foreground">· {formatBytes(file.size)}</span>
        </p>
        <button
          onClick={() => setFile(null)}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Page size
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(Object.keys(SIZES) as SizeKey[]).map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  size === s
                    ? "bg-foreground text-background"
                    : "border border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Orientation
          </p>
          <div className="mt-3 inline-flex rounded-full border border-border bg-background p-1">
            {(["portrait", "landscape"] as Orient[]).map((o) => (
              <button
                key={o}
                onClick={() => setOrient(o)}
                className={`rounded-full px-3 py-1 text-sm capitalize transition-colors ${
                  orient === o
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Scaling
          </p>
          <div className="mt-3 inline-flex rounded-full border border-border bg-background p-1">
            {(["fit", "fill", "stretch"] as Fit[]).map((m) => (
              <button
                key={m}
                onClick={() => setFit(m)}
                className={`rounded-full px-3 py-1 text-sm capitalize transition-colors ${
                  fit === m
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ActionBar
        status={`${size} ${orient} · ${fit === "fit" ? "Fit (preserve content)" : fit === "fill" ? "Fill (may crop)" : "Stretch (distort)"}`}
        primary={
          <button
            onClick={apply}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Resizing…" : "Resize pages"}
          </button>
        }
      />
    </div>
  );
}
