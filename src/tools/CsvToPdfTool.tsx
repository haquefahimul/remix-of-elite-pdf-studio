import { useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { X } from "lucide-react";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") {
        row.push(cur);
        cur = "";
      } else if (c === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else if (c === "\r") {
        // skip
      } else {
        cur += c;
      }
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.length));
}

type Orient = "portrait" | "landscape";

export function CsvToPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [orient, setOrient] = useState<Orient>("landscape");
  const [hasHeader, setHasHeader] = useState(true);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) {
        toast.error("No rows detected");
        setBusy(false);
        return;
      }
      const cols = Math.max(...rows.map((r) => r.length));
      // Pad
      const grid = rows.map((r) => {
        const c = [...r];
        while (c.length < cols) c.push("");
        return c;
      });

      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

      const pageW = orient === "landscape" ? 842 : 595;
      const pageH = orient === "landscape" ? 595 : 842;
      const margin = 36;
      const usableW = pageW - margin * 2;
      const fontSize = Math.max(6.5, Math.min(10, usableW / (cols * 8)));
      const colW = usableW / cols;
      const rowH = fontSize + 6;
      const rowsPerPage = Math.floor((pageH - margin * 2 - rowH) / rowH);

      let page = pdf.addPage([pageW, pageH]);
      let y = pageH - margin;
      let onPage = 0;

      const drawHeader = () => {
        page.drawRectangle({
          x: margin,
          y: y - rowH,
          width: usableW,
          height: rowH,
          color: rgb(0.93, 0.93, 0.95),
        });
        if (hasHeader) {
          for (let c = 0; c < cols; c++) {
            const txt = (grid[0][c] ?? "").slice(0, Math.max(1, Math.floor(colW / fontSize) * 2));
            page.drawText(txt, {
              x: margin + c * colW + 4,
              y: y - rowH + 5,
              size: fontSize,
              font: bold,
              color: rgb(0.1, 0.1, 0.12),
            });
          }
        }
        y -= rowH;
        onPage++;
      };

      drawHeader();

      const start = hasHeader ? 1 : 0;
      for (let i = start; i < grid.length; i++) {
        if (onPage >= rowsPerPage) {
          page = pdf.addPage([pageW, pageH]);
          y = pageH - margin;
          onPage = 0;
          drawHeader();
        }
        // zebra
        if ((i - start) % 2 === 1) {
          page.drawRectangle({
            x: margin,
            y: y - rowH,
            width: usableW,
            height: rowH,
            color: rgb(0.97, 0.97, 0.98),
          });
        }
        for (let c = 0; c < cols; c++) {
          const max = Math.max(1, Math.floor(colW / (fontSize * 0.5)) - 1);
          const raw = grid[i][c] ?? "";
          const txt = raw.length > max ? raw.slice(0, max - 1) + "…" : raw;
          page.drawText(txt, {
            x: margin + c * colW + 4,
            y: y - rowH + 5,
            size: fontSize,
            font,
            color: rgb(0.15, 0.15, 0.18),
          });
        }
        // grid lines
        page.drawLine({
          start: { x: margin, y: y - rowH },
          end: { x: margin + usableW, y: y - rowH },
          color: rgb(0.85, 0.85, 0.88),
          thickness: 0.5,
        });
        y -= rowH;
        onPage++;
      }

      const bytes = await pdf.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)}.pdf`,
      );
      toast.success("CSV converted to PDF");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't convert that CSV");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="image"
        onFiles={(f) => {
          const csv = f.find((x) => /\.csv$/i.test(x.name) || x.type === "text/csv");
          if (csv) setFile(csv);
          else toast.error("Drop a .csv file");
        }}
        title="Drop a CSV to convert"
        hint="Renders a clean, paginated table PDF — header row optional"
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

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
            First row
          </p>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasHeader}
              onChange={(e) => setHasHeader(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            Treat first row as header
          </label>
        </div>
      </div>

      <ActionBar
        status="Auto-paginated, zebra striping, bold header"
        primary={
          <button
            onClick={apply}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Building…" : "Export PDF"}
          </button>
        }
      />
    </div>
  );
}
