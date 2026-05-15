import { useState } from "react";
import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";
import { toast } from "sonner";
import { FileSpreadsheet, X } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";

type Orient = "portrait" | "landscape";

export function ExcelToPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [orientation, setOrientation] = useState<Orient>("landscape");
  const [fontSize, setFontSize] = useState(9);
  const [includeGrid, setIncludeGrid] = useState(true);
  const [sheetMode, setSheetMode] = useState<"all" | "first">("all");

  const onPick = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    const okExt = /\.(xlsx|xls|csv|ods)$/i.test(f.name);
    if (!okExt) {
      toast.error("Please choose an Excel (.xlsx / .xls), CSV, or ODS file.");
      return;
    }
    setFile(f);
  };

  const handleConvert = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const out = await PDFDocument.create();
      const font = await out.embedFont(StandardFonts.Helvetica);
      const fontBold = await out.embedFont(StandardFonts.HelveticaBold);

      const sheets = sheetMode === "all" ? wb.SheetNames : [wb.SheetNames[0]];
      if (sheets.length === 0) throw new Error("No sheets");

      for (const name of sheets) {
        const ws = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
          header: 1,
          blankrows: false,
          defval: "",
        });
        if (rows.length === 0) continue;
        const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);

        // Compute column widths from content (capped)
        const charW = fontSize * 0.55;
        const widths: number[] = [];
        for (let c = 0; c < cols; c++) {
          let max = 6;
          for (const r of rows) {
            const v = r[c] == null ? "" : String(r[c]);
            max = Math.max(max, Math.min(40, v.length));
          }
          widths.push(max * charW + 8);
        }
        const tableW = widths.reduce((a, b) => a + b, 0);

        const [pw, ph] =
          orientation === "landscape" ? [PageSizes.A4[1], PageSizes.A4[0]] : PageSizes.A4;
        const margin = 28;
        const usable = pw - margin * 2;
        // Scale columns down if too wide
        const scale = tableW > usable ? usable / tableW : 1;
        const scaledW = widths.map((w) => w * scale);
        const rowH = fontSize * 1.6;

        let page = out.addPage([pw, ph]);
        page.drawText(name, {
          x: margin,
          y: ph - margin + 4,
          size: 10,
          font: fontBold,
          color: rgb(0.4, 0.4, 0.45),
        });
        let y = ph - margin - rowH;

        const drawRow = (row: unknown[], isHeader: boolean) => {
          if (y < margin + rowH) {
            page = out.addPage([pw, ph]);
            page.drawText(`${name} (cont.)`, {
              x: margin,
              y: ph - margin + 4,
              size: 9,
              font: fontBold,
              color: rgb(0.4, 0.4, 0.45),
            });
            y = ph - margin - rowH;
          }
          let x = margin;
          if (isHeader) {
            page.drawRectangle({
              x: margin,
              y: y - 2,
              width: scaledW.reduce((a, b) => a + b, 0),
              height: rowH,
              color: rgb(0.95, 0.95, 0.97),
            });
          }
          for (let c = 0; c < cols; c++) {
            const w = scaledW[c];
            if (includeGrid) {
              page.drawRectangle({
                x,
                y: y - 2,
                width: w,
                height: rowH,
                borderColor: rgb(0.85, 0.85, 0.88),
                borderWidth: 0.5,
              });
            }
            const raw = row[c] == null ? "" : String(row[c]);
            // Truncate to fit
            const maxChars = Math.max(1, Math.floor((w - 6) / (fontSize * 0.55)));
            const txt = raw.length > maxChars ? raw.slice(0, Math.max(1, maxChars - 1)) + "…" : raw;
            const safe = txt.replace(/[\r\n\t]/g, " ");
            try {
              page.drawText(safe, {
                x: x + 3,
                y: y + 3,
                size: fontSize,
                font: isHeader ? fontBold : font,
                color: rgb(0.12, 0.12, 0.16),
              });
            } catch {
              // skip glyphs not supported by Helvetica
            }
            x += w;
          }
          y -= rowH;
        };

        for (let i = 0; i < rows.length; i++) {
          drawRow(rows[i] as unknown[], i === 0);
        }
      }

      const bytes = await out.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)}.pdf`
      );
      toast.success("PDF ready");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't convert that spreadsheet.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <div>
        <Dropzone
          accept="pdf"
          onFiles={onPick}
          title="Drop a spreadsheet"
          hint=".xlsx, .xls, .csv, .ods — converted in your browser"
        />
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Drag any spreadsheet — every sheet becomes pages of a single PDF.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-tool-excel-pdf/10 text-tool-excel-pdf">
          <FileSpreadsheet className="h-4 w-4" />
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

      <div className="mt-4 grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2">
        <Field label="Orientation">
          <Segmented
            value={orientation}
            onChange={(v) => setOrientation(v as Orient)}
            options={[
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
          />
        </Field>
        <Field label="Sheets">
          <Segmented
            value={sheetMode}
            onChange={(v) => setSheetMode(v as "all" | "first")}
            options={[
              { value: "all", label: "All" },
              { value: "first", label: "First only" },
            ]}
          />
        </Field>
        <Field label={`Font size (${fontSize}pt)`}>
          <input
            type="range"
            min={7}
            max={14}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-full"
          />
        </Field>
        <Field label="Style">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeGrid}
              onChange={(e) => setIncludeGrid(e.target.checked)}
            />
            Show cell borders
          </label>
        </Field>
      </div>

      <ActionBar
        status="Layouts auto-fit each sheet to the page"
        primary={
          <button
            onClick={handleConvert}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Converting…" : "Convert to PDF"}
          </button>
        }
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-background p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1 text-sm transition-colors ${
            value === o.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
