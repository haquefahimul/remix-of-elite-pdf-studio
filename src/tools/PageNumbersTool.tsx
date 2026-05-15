import { useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName } from "@/lib/format";
import { FileHeader } from "./SplitTool";

type Position = "top-left" | "top" | "top-right" | "bottom-left" | "bottom" | "bottom-right";
type Format = "n" | "n-of-total" | "page-n" | "page-n-of-total";

export function PageNumbersTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [position, setPosition] = useState<Position>("bottom");
  const [format, setFormat] = useState<Format>("page-n-of-total");
  const [start, setStart] = useState(1);
  const [size, setSize] = useState(11);
  const [rangeText, setRangeText] = useState("");
  const [color, setColor] = useState("#111827");

  const handleApply = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const total = doc.getPageCount();
      const range = parseRange(rangeText, total);
      const { r, g, b } = hexToRgb(color);

      doc.getPages().forEach((page, i) => {
        if (range && !range.has(i)) return;
        const num = start + (range ? Array.from(range).sort((a, b) => a - b).indexOf(i) : i);
        const label = formatLabel(format, num, range ? range.size : total);
        const { width, height } = page.getSize();
        const tw = font.widthOfTextAtSize(label, size);
        const [x, y] = anchor(position, width, height, size, tw);
        page.drawText(label, { x, y, size, font, color: rgb(r, g, b) });
      });

      const bytes = await doc.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${baseName(file.name)} (numbered).pdf`);
      toast.success("Page numbers added");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't add page numbers.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return <Dropzone accept="pdf" onFiles={(f) => setFile(f[0])} title="Drop a PDF to number" hint="or click to browse" />;
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <Field label="Format">
            <select value={format} onChange={(e) => setFormat(e.target.value as Format)} className={inputCls}>
              <option value="n">1, 2, 3…</option>
              <option value="n-of-total">1 of 10</option>
              <option value="page-n">Page 1</option>
              <option value="page-n-of-total">Page 1 of 10</option>
            </select>
          </Field>

          <Field label="Position">
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-background p-1.5">
              {(["top-left","top","top-right","bottom-left","bottom","bottom-right"] as Position[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPosition(p)}
                  className={`rounded-md px-2 py-2 text-xs transition-colors ${position === p ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent"}`}
                >
                  {p.replace("-", " ")}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start at">
              <input type="number" min={1} value={start} onChange={(e) => setStart(Math.max(1, Number(e.target.value)))} className={inputCls} />
            </Field>
            <Field label={`Size · ${size}pt`}>
              <input type="range" min={8} max={36} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full accent-foreground" />
            </Field>
          </div>

          <Field label="Pages (blank = all)">
            <input value={rangeText} onChange={(e) => setRangeText(e.target.value)} placeholder="e.g. 2-10, 12" className={inputCls} />
          </Field>

          <Field label="Color">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-background" />
          </Field>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Preview</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-background">
                <div className={`absolute ${previewPosCls(position)} text-foreground/70`} style={{ fontSize: `${size + 2}px`, color }}>
                  {formatLabel(format, start + i, 10)}
                </div>
                <div className="absolute inset-x-6 top-6 space-y-2">
                  <div className="h-2 w-3/4 rounded bg-muted" />
                  <div className="h-2 w-1/2 rounded bg-muted" />
                  <div className="h-2 w-2/3 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ActionBar
        primary={
          <button
            onClick={handleApply}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Numbering…" : "Add page numbers"}
          </button>
        }
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground";

function formatLabel(f: Format, n: number, total: number): string {
  switch (f) {
    case "n": return `${n}`;
    case "n-of-total": return `${n} of ${total}`;
    case "page-n": return `Page ${n}`;
    case "page-n-of-total": return `Page ${n} of ${total}`;
  }
}

function anchor(p: Position, w: number, h: number, size: number, tw: number): [number, number] {
  const m = 28;
  switch (p) {
    case "top-left": return [m, h - m - size];
    case "top": return [w / 2 - tw / 2, h - m - size];
    case "top-right": return [w - m - tw, h - m - size];
    case "bottom-left": return [m, m];
    case "bottom": return [w / 2 - tw / 2, m];
    case "bottom-right": return [w - m - tw, m];
  }
}

function previewPosCls(p: Position): string {
  switch (p) {
    case "top-left": return "top-3 left-3";
    case "top": return "top-3 left-1/2 -translate-x-1/2";
    case "top-right": return "top-3 right-3";
    case "bottom-left": return "bottom-3 left-3";
    case "bottom": return "bottom-3 left-1/2 -translate-x-1/2";
    case "bottom-right": return "bottom-3 right-3";
  }
}

function parseRange(text: string, total: number): Set<number> | null {
  const t = text.trim();
  if (!t) return null;
  const set = new Set<number>();
  for (const part of t.split(",").map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = a; i <= b; i++) if (i >= 1 && i <= total) set.add(i - 1);
  }
  return set.size > 0 ? set : null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "");
  const n = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  return {
    r: parseInt(n.slice(0, 2), 16) / 255,
    g: parseInt(n.slice(2, 4), 16) / 255,
    b: parseInt(n.slice(4, 6), 16) / 255,
  };
}
