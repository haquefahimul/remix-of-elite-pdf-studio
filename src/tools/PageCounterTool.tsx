import { useEffect, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { ModeChip } from "./SplitTool";
import { downloadBlob, formatBytes } from "@/lib/format";

type Row = { name: string; size: number; pages: number | null; error?: string };
type Output = "csv" | "json" | "txt";

export function PageCounterTool() {
  const [items, setItems] = useState<File[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [output, setOutput] = useState<Output>("csv");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (items.length === 0) {
      setRows([]);
      return;
    }
    let cancel = false;
    setBusy(true);
    (async () => {
      const out: Row[] = [];
      for (const f of items) {
        try {
          const buf = await f.arrayBuffer();
          const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
          out.push({ name: f.name, size: f.size, pages: pdf.getPageCount() });
        } catch {
          out.push({ name: f.name, size: f.size, pages: null, error: "Unreadable" });
        }
        if (cancel) return;
      }
      if (!cancel) setRows(out);
    })()
      .catch(() => toast.error("Couldn't analyze PDFs"))
      .finally(() => !cancel && setBusy(false));
    return () => {
      cancel = true;
    };
  }, [items]);

  const total = rows.reduce((a, r) => a + (r.pages ?? 0), 0);

  const exportReport = () => {
    let body = "";
    let mime = "text/plain";
    let ext = "txt";
    if (output === "csv") {
      body = "filename,size_bytes,pages\n" + rows.map((r) => `"${r.name.replace(/"/g, '""')}",${r.size},${r.pages ?? ""}`).join("\n");
      mime = "text/csv";
      ext = "csv";
    } else if (output === "json") {
      body = JSON.stringify({ total_pages: total, files: rows }, null, 2);
      mime = "application/json";
      ext = "json";
    } else {
      const w = Math.max(8, ...rows.map((r) => r.name.length));
      body =
        rows.map((r) => `${r.name.padEnd(w)}  ${String(r.pages ?? "—").padStart(6)} pages`).join("\n") +
        `\n\nTotal: ${total} pages across ${rows.length} files`;
    }
    downloadBlob(new Blob([body], { type: mime }), `page-counts.${ext}`);
    toast.success("Report saved");
  };

  if (items.length === 0) {
    return (
      <Dropzone
        accept="pdf-multi"
        multiple
        onFiles={(fs) => setItems(fs)}
        title="Drop PDFs to count pages"
        hint="Get a CSV, JSON, or TXT report — all on-device"
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {items.length} file{items.length === 1 ? "" : "s"} · {formatBytes(items.reduce((a, b) => a + b.size, 0))}
        </p>
        <div className="flex gap-2">
          <label className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            Add more
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="sr-only"
              onChange={(e) => {
                const f = Array.from(e.target.files ?? []);
                if (f.length) setItems((prev) => [...prev, ...f]);
              }}
            />
          </label>
          <button
            onClick={() => setItems([])}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Report format</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ModeChip active={output === "csv"} onClick={() => setOutput("csv")}>CSV</ModeChip>
          <ModeChip active={output === "json"} onClick={() => setOutput("json")}>JSON</ModeChip>
          <ModeChip active={output === "txt"} onClick={() => setOutput("txt")}>Text</ModeChip>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-accent/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">File</th>
              <th className="px-4 py-2 text-right font-medium">Size</th>
              <th className="px-4 py-2 text-right font-medium">Pages</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <td className="truncate px-4 py-2">{r.name}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">{formatBytes(r.size)}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {r.pages ?? <span className="text-destructive">{r.error}</span>}
                </td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="border-t border-border bg-accent/30 font-medium">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right text-muted-foreground">
                  {formatBytes(items.reduce((a, b) => a + b.size, 0))}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{total}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ActionBar
        status={busy ? "Counting…" : `${total} pages across ${rows.length} files`}
        primary={
          <button
            onClick={exportReport}
            disabled={busy || rows.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Working…" : "Download report"}
          </button>
        }
      />
    </div>
  );
}
