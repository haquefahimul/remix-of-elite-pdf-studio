import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { BookOpen, X } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";

/**
 * Reorder pages for booklet printing (saddle-stitch).
 * For an N-page document (padded to multiple of 4), produces sheets with:
 * front: [N, 1] | back: [2, N-1] | front: [N-2, 3] | back: [4, N-3] ...
 * Each output page is landscape with 2 source pages side by side.
 */
export function BookletTool() {
  const [file, setFile] = useState<File | null>(null);
  const [paper, setPaper] = useState<"a4" | "letter">("a4");
  const [busy, setBusy] = useState(false);

  const handleBuild = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf);
      const out = await PDFDocument.create();

      const total = src.getPageCount();
      const padded = Math.ceil(total / 4) * 4;

      // Page size of source (assume first)
      const first = src.getPage(0);
      const srcW = first.getWidth();
      const srcH = first.getHeight();

      // Output sheet is landscape (2 source pages side by side)
      const sheetW = paper === "a4" ? 841.89 : 792 * (11 / 8.5); // landscape long edge
      const sheetH = paper === "a4" ? 595.28 : 612;
      // Actually use proper landscape dims
      const W = paper === "a4" ? 841.89 : 1008; // a4: 297mm; letter: 14in long? — use 11x17 not needed; use long edge
      const H = paper === "a4" ? 595.28 : 612;
      void sheetW; void sheetH;

      // Embed all pages (including blanks for padding)
      const embedded: (Awaited<ReturnType<typeof out.embedPage>> | null)[] = [];
      for (let i = 0; i < total; i++) {
        embedded.push(await out.embedPage(src.getPage(i)));
      }
      for (let i = total; i < padded; i++) embedded.push(null);

      // Build booklet order
      const order: [number, number][] = [];
      let left = padded - 1;
      let right = 0;
      for (let s = 0; s < padded / 2; s += 2) {
        order.push([left, right]);
        order.push([right + 1, left - 1]);
        left -= 2;
        right += 2;
      }

      const halfW = W / 2;
      const slotScale = Math.min(halfW / srcW, H / srcH);
      const sw = srcW * slotScale;
      const sh = srcH * slotScale;
      const yOff = (H - sh) / 2;

      for (const [l, r] of order) {
        const page = out.addPage([W, H]);
        const lp = embedded[l];
        const rp = embedded[r];
        if (lp) page.drawPage(lp, { x: (halfW - sw) / 2, y: yOff, width: sw, height: sh });
        if (rp) page.drawPage(rp, { x: halfW + (halfW - sw) / 2, y: yOff, width: sw, height: sh });
      }

      const bytes = await out.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${baseName(file.name)}-booklet.pdf`);
      toast.success(`Booklet ready · ${order.length} sheets`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't build booklet");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to imposition"
        hint="Saddle-stitch booklet — print double-sided, fold in half"
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-tool-nup/10 text-tool-nup">
          <BookOpen className="h-4 w-4" />
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
          Paper size
        </span>
        <div className="mt-3 inline-flex rounded-full border border-border bg-background p-1">
          {(
            [
              { value: "a4", label: "A4 landscape" },
              { value: "letter", label: "Letter landscape" },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              onClick={() => setPaper(o.value)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                paper === o.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Pages auto-pad to a multiple of 4. Print double-sided (flip on long edge), fold in half,
          and you've got a booklet.
        </p>
      </div>

      <ActionBar
        status="Imposition: saddle-stitch, 2-up"
        primary={
          <button
            onClick={handleBuild}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Building…" : "Export booklet"}
          </button>
        }
      />
    </div>
  );
}
