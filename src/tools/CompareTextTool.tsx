import { useState } from "react";
import { toast } from "sonner";
import { FileText, X } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { pdfjsLib } from "@/lib/pdf-worker";

type DiffOp = { type: "eq" | "ins" | "del"; text: string };

async function extractLines(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    // Group by rounded Y
    const map = new Map<number, { x: number; s: string }[]>();
    for (const item of tc.items as Array<{ str: string; transform: number[] }>) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push({ x, s: item.str });
    }
    const ys = Array.from(map.keys()).sort((a, b) => b - a);
    for (const y of ys) {
      const row = map
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((r) => r.s)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (row) lines.push(row);
    }
    page.cleanup();
  }
  await pdf.destroy();
  return lines;
}

// Classic LCS-based diff
function diffLines(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "eq", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "del", text: a[i++] });
    } else {
      ops.push({ type: "ins", text: b[j++] });
    }
  }
  while (i < n) ops.push({ type: "del", text: a[i++] });
  while (j < m) ops.push({ type: "ins", text: b[j++] });
  return ops;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderHtmlReport(name1: string, name2: string, ops: DiffOp[]) {
  const rows = ops
    .map((o) => {
      if (o.type === "eq")
        return `<tr><td class="ln"></td><td class="eq">${escapeHtml(o.text)}</td></tr>`;
      if (o.type === "del")
        return `<tr><td class="ln">−</td><td class="del">${escapeHtml(o.text)}</td></tr>`;
      return `<tr><td class="ln">+</td><td class="ins">${escapeHtml(o.text)}</td></tr>`;
    })
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Diff: ${escapeHtml(name1)} vs ${escapeHtml(name2)}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;margin:32px;color:#111;background:#fafaf7}
  h1{font-size:20px;margin:0 0 16px}
  .meta{color:#666;font-size:13px;margin-bottom:24px}
  table{border-collapse:collapse;width:100%;font-family:ui-monospace,Menlo,monospace;font-size:13px;background:white;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden}
  td{padding:4px 10px;vertical-align:top;border-bottom:1px solid #f0f0f0}
  td.ln{width:24px;text-align:center;color:#999;user-select:none}
  td.eq{color:#333}
  td.del{background:#fdecea;color:#9a1f1f}
  td.ins{background:#e7f7ee;color:#0d6b2c}
</style></head><body>
<h1>Diff report</h1>
<div class="meta">A: ${escapeHtml(name1)} · B: ${escapeHtml(name2)}</div>
<table>${rows}</table>
</body></html>`;
}

export function CompareTextTool() {
  const [a, setA] = useState<File | null>(null);
  const [b, setB] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<{ added: number; removed: number; same: number } | null>(null);

  const handleCompare = async () => {
    if (!a || !b) return;
    setBusy(true);
    setStats(null);
    try {
      const [la, lb] = await Promise.all([extractLines(a), extractLines(b)]);
      const ops = diffLines(la, lb);
      const added = ops.filter((o) => o.type === "ins").length;
      const removed = ops.filter((o) => o.type === "del").length;
      const same = ops.filter((o) => o.type === "eq").length;
      setStats({ added, removed, same });
      const html = renderHtmlReport(a.name, b.name, ops);
      downloadBlob(
        new Blob([html], { type: "text/html" }),
        `${baseName(a.name)} vs ${baseName(b.name)} — diff.html`,
      );
      toast.success(`+${added} / −${removed} lines`);
    } catch (err) {
      console.error(err);
      toast.error("Compare failed. Make sure both PDFs contain selectable text.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Slot label="Original (A)" file={a} onFile={setA} onClear={() => setA(null)} />
        <Slot label="Revised (B)" file={b} onFile={setB} onClear={() => setB(null)} />
      </div>

      {stats && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Added" value={`+${stats.added}`} tone="text-success" />
          <Stat label="Removed" value={`−${stats.removed}`} tone="text-destructive" />
          <Stat label="Unchanged" value={`${stats.same}`} tone="text-muted-foreground" />
        </div>
      )}

      <ActionBar
        status={a && b ? "Generates an HTML report with line-level changes" : "Drop both PDFs to compare"}
        primary={
          <button
            onClick={handleCompare}
            disabled={busy || !a || !b}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Comparing…" : "Compare & download report"}
          </button>
        }
      />
    </div>
  );
}

function Slot({
  label,
  file,
  onFile,
  onClear,
}: {
  label: string;
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  if (!file) {
    return <Dropzone accept="pdf" onFiles={(f) => onFile(f[0])} title={label} hint="Drop a PDF" />;
  }
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-tool-compare/10 text-tool-compare">
        <FileText className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
      </div>
      <button
        onClick={onClear}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Remove"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl ${tone}`}>{value}</p>
    </div>
  );
}
