import { useState } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName } from "@/lib/format";
import { FileHeader } from "./SplitTool";

type N = 2 | 4 | 6 | 9;
type Orientation = "portrait" | "landscape";
type PageSize = "a4" | "letter" | "source";

const SIZES: Record<Exclude<PageSize, "source">, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

export function NupTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [n, setN] = useState<N>(4);
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [margin, setMargin] = useState(24);
  const [gap, setGap] = useState(12);
  const [border, setBorder] = useState(true);

  const layout = (n: N): [number, number] => {
    if (n === 2) return orientation === "portrait" ? [1, 2] : [2, 1];
    if (n === 4) return [2, 2];
    if (n === 6) return orientation === "portrait" ? [2, 3] : [3, 2];
    return [3, 3];
  };

  const handleApply = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const out = await PDFDocument.create();

      const sourcePages = src.getPages();
      const embedded = await out.embedPages(sourcePages);

      const [cols, rows] = layout(n);
      const totalSheets = Math.ceil(embedded.length / n);

      for (let s = 0; s < totalSheets; s++) {
        let pageW: number, pageH: number;
        if (pageSize === "source") {
          const first = sourcePages[s * n];
          [pageW, pageH] = [first.getWidth(), first.getHeight()];
          if (orientation === "landscape" && pageW < pageH) [pageW, pageH] = [pageH, pageW];
          if (orientation === "portrait" && pageW > pageH) [pageW, pageH] = [pageH, pageW];
        } else {
          [pageW, pageH] = SIZES[pageSize];
          if (orientation === "landscape") [pageW, pageH] = [pageH, pageW];
        }
        const sheet = out.addPage([pageW, pageH]);
        const cellW = (pageW - 2 * margin - (cols - 1) * gap) / cols;
        const cellH = (pageH - 2 * margin - (rows - 1) * gap) / rows;

        for (let i = 0; i < n; i++) {
          const idx = s * n + i;
          if (idx >= embedded.length) break;
          const ep = embedded[idx];
          const col = i % cols;
          const row = Math.floor(i / cols);
          const cellX = margin + col * (cellW + gap);
          // y from top: convert to PDF bottom-left
          const cellY = pageH - margin - (row + 1) * cellH - row * gap;

          // fit preserving aspect
          const scale = Math.min(cellW / ep.width, cellH / ep.height);
          const w = ep.width * scale;
          const h = ep.height * scale;
          const x = cellX + (cellW - w) / 2;
          const y = cellY + (cellH - h) / 2;

          if (border) {
            sheet.drawRectangle({
              x: cellX, y: cellY, width: cellW, height: cellH,
              borderColor: rgb(0.85, 0.85, 0.85),
              borderWidth: 0.5,
            });
          }
          sheet.drawPage(ep, { x, y, width: w, height: h });
        }
      }

      const bytes = await out.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${baseName(file.name)} (${n}-up).pdf`);
      toast.success("N-up PDF ready");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't create n-up.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return <Dropzone accept="pdf" onFiles={(f) => setFile(f[0])} title="Drop a PDF for n-up layout" hint="or click to browse" />;
  }

  const [cols, rows] = layout(n);

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="space-y-5 rounded-2xl border border-border bg-surface p-5">
          <Field label="Pages per sheet">
            <div className="grid grid-cols-4 gap-2">
              {([2, 4, 6, 9] as N[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setN(opt)}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${n === opt ? "border-foreground bg-foreground text-background" : "border-border hover:bg-accent"}`}
                >
                  {opt}-up
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Page size">
              <select value={pageSize} onChange={(e) => setPageSize(e.target.value as PageSize)} className={inputCls}>
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
                <option value="source">Match source</option>
              </select>
            </Field>
            <Field label="Orientation">
              <select value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)} className={inputCls}>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Margin · ${margin}pt`}>
              <input type="range" min={0} max={72} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="w-full accent-foreground" />
            </Field>
            <Field label={`Gap · ${gap}pt`}>
              <input type="range" min={0} max={48} value={gap} onChange={(e) => setGap(Number(e.target.value))} className="w-full accent-foreground" />
            </Field>
          </div>

          <label className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <span>Show cell borders</span>
            <input type="checkbox" checked={border} onChange={(e) => setBorder(e.target.checked)} className="h-4 w-4" />
          </label>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Preview</p>
          <div
            className={`mx-auto mt-4 grid gap-2 rounded-xl border border-border bg-background p-4 ${orientation === "portrait" ? "aspect-[1/1.414]" : "aspect-[1.414/1]"}`}
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, maxWidth: orientation === "portrait" ? 280 : 380 }}
          >
            {Array.from({ length: n }).map((_, i) => (
              <div key={i} className="rounded-md border border-border bg-muted text-center">
                <span className="block py-2 font-display text-lg text-muted-foreground">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ActionBar
        status={`${n}-up · ${cols}×${rows} grid`}
        primary={
          <button
            onClick={handleApply}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Building…" : "Create n-up PDF"}
          </button>
        }
      />
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
