import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";

type Direction = "right" | "left" | "down" | "up";

export function ContactSheetTool() {
  const [file, setFile] = useState<File | null>(null);
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(4);
  const [margin, setMargin] = useState(24);
  const [gap, setGap] = useState(12);
  const [dir, setDir] = useState<Direction>("right");
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf);
      const out = await PDFDocument.create();

      const total = src.getPageCount();
      const indices = Array.from({ length: total }, (_, i) => i);
      const embedded = await out.embedPdf(src, indices);

      // Use Letter portrait as sheet
      const sheetW = 612;
      const sheetH = 792;
      const perSheet = cols * rows;

      const cellW = (sheetW - margin * 2 - gap * (cols - 1)) / cols;
      const cellH = (sheetH - margin * 2 - gap * (rows - 1)) / rows;

      const positions: { x: number; y: number }[] = [];
      // Build slot order (origin top-left visually). pdf-lib y is bottom-origin, so row 0 is top.
      if (dir === "right") {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            positions.push({
              x: margin + c * (cellW + gap),
              y: sheetH - margin - (r + 1) * cellH - r * gap,
            });
          }
        }
      } else if (dir === "left") {
        for (let r = 0; r < rows; r++) {
          for (let c = cols - 1; c >= 0; c--) {
            positions.push({
              x: margin + c * (cellW + gap),
              y: sheetH - margin - (r + 1) * cellH - r * gap,
            });
          }
        }
      } else if (dir === "down") {
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            positions.push({
              x: margin + c * (cellW + gap),
              y: sheetH - margin - (r + 1) * cellH - r * gap,
            });
          }
        }
      } else {
        for (let c = 0; c < cols; c++) {
          for (let r = rows - 1; r >= 0; r--) {
            positions.push({
              x: margin + c * (cellW + gap),
              y: sheetH - margin - (r + 1) * cellH - r * gap,
            });
          }
        }
      }

      for (let i = 0; i < embedded.length; i += perSheet) {
        const page = out.addPage([sheetW, sheetH]);
        const slice = embedded.slice(i, i + perSheet);
        for (let s = 0; s < slice.length; s++) {
          const ep = slice[s];
          const pos = positions[s];
          const scale = Math.min(cellW / ep.width, cellH / ep.height);
          const dw = ep.width * scale;
          const dh = ep.height * scale;
          page.drawPage(ep, {
            x: pos.x + (cellW - dw) / 2,
            y: pos.y + (cellH - dh) / 2,
            width: dw,
            height: dh,
          });
        }
      }

      const bytes = await out.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)} (contact sheet ${cols}x${rows}).pdf`,
      );
      toast.success("Contact sheet built");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't build contact sheet");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF for a contact sheet"
        hint="Lay every page out in a printable grid — perfect for proofs"
      />
    );
  }

  return (
    <div>
      <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
        <span className="font-medium">{file.name}</span>{" "}
        <span className="text-muted-foreground">· {formatBytes(file.size)}</span>
        <button
          onClick={() => setFile(null)}
          className="ml-3 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Change
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Columns — {cols}
          </label>
          <input
            type="range"
            min={1}
            max={8}
            value={cols}
            onChange={(e) => setCols(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
          />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Rows — {rows}
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={rows}
            onChange={(e) => setRows(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
          />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Margin — {margin}pt
          </label>
          <input
            type="range"
            min={0}
            max={72}
            value={margin}
            onChange={(e) => setMargin(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
          />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Gap — {gap}pt
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
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Reading order
        </p>
        <div className="mt-3 inline-flex rounded-full border border-border bg-background p-1">
          {(["right", "down", "left", "up"] as Direction[]).map((d) => (
            <button
              key={d}
              onClick={() => setDir(d)}
              className={`rounded-full px-3 py-1 text-sm capitalize transition-colors ${
                dir === d
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <ActionBar
        status={`${cols}×${rows} per sheet · ${cols * rows} pages per page`}
        primary={
          <button
            onClick={apply}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Building…" : "Build contact sheet"}
          </button>
        }
      />
    </div>
  );
}
