import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { pdfjsLib } from "@/lib/pdf-worker";
import { FileSpreadsheet, X } from "lucide-react";

type TextItem = { str: string; x: number; y: number; w: number; h: number };

/**
 * Group text items on a PDF page into rows + columns using clustering on the
 * Y axis (rows) and X axis (columns). Heuristic but works for most table-like PDFs.
 */
function pageToRows(items: TextItem[]): string[][] {
  if (items.length === 0) return [];
  // Round Y to cluster lines
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lineTol = Math.max(2, sorted[0].h * 0.6);

  const lines: TextItem[][] = [];
  let current: TextItem[] = [];
  let currentY = sorted[0].y;
  for (const it of sorted) {
    if (Math.abs(it.y - currentY) <= lineTol) {
      current.push(it);
    } else {
      lines.push(current);
      current = [it];
      currentY = it.y;
    }
  }
  if (current.length) lines.push(current);

  // Detect column boundaries from x-coordinates across all lines
  const xs = items.map((i) => i.x).sort((a, b) => a - b);
  const colSeeds: number[] = [];
  const colTol = 6;
  for (const x of xs) {
    if (!colSeeds.some((c) => Math.abs(c - x) < colTol)) colSeeds.push(x);
  }
  colSeeds.sort((a, b) => a - b);

  return lines.map((line) => {
    const sortedLine = [...line].sort((a, b) => a.x - b.x);
    const row: string[] = new Array(colSeeds.length).fill("");
    for (const it of sortedLine) {
      // Find the closest column seed at or before it.x
      let idx = 0;
      for (let k = 0; k < colSeeds.length; k++) {
        if (colSeeds[k] <= it.x + colTol) idx = k;
      }
      row[idx] = row[idx] ? `${row[idx]} ${it.str}`.trim() : it.str;
    }
    // Trim trailing empty cells
    while (row.length && row[row.length - 1] === "") row.pop();
    return row;
  });
}

export function PdfToExcelTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"sheet-per-page" | "single-sheet">("sheet-per-page");

  const handleConvert = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const wb = XLSX.utils.book_new();
      const allRows: string[][] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        const items: TextItem[] = tc.items
          .map((it) => {
            const item = it as {
              str: string;
              transform: number[];
              width: number;
              height: number;
            };
            return {
              str: item.str,
              x: item.transform[4],
              y: item.transform[5],
              w: item.width,
              h: item.height || 10,
            };
          })
          .filter((i) => i.str.trim().length > 0);
        const rows = pageToRows(items);
        if (mode === "sheet-per-page") {
          const ws = XLSX.utils.aoa_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, `Page ${i}`.slice(0, 31));
        } else {
          if (i > 1) allRows.push([]);
          allRows.push([`-- Page ${i} --`]);
          for (const r of rows) allRows.push(r);
        }
        page.cleanup();
      }
      await pdf.destroy();

      if (mode === "single-sheet") {
        const ws = XLSX.utils.aoa_to_sheet(allRows);
        XLSX.utils.book_append_sheet(wb, ws, "All pages");
      }

      const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      downloadBlob(
        new Blob([out as BlobPart], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `${baseName(file.name)}.xlsx`
      );
      toast.success("Spreadsheet ready");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't read text from that PDF — it may be a scan. Try OCR first.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to convert"
        hint="Text-based PDFs work best — scans should be OCR'd first"
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-tool-pdf-excel/10 text-tool-pdf-excel">
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

      <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Output layout
        </span>
        <div className="mt-3 inline-flex rounded-full border border-border bg-background p-1">
          {(
            [
              { value: "sheet-per-page", label: "Sheet per page" },
              { value: "single-sheet", label: "Single sheet" },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              onClick={() => setMode(o.value)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                mode === o.value
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
        status="Columns inferred from text positions"
        primary={
          <button
            onClick={handleConvert}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Extracting…" : "Export .xlsx"}
          </button>
        }
      />
    </div>
  );
}
