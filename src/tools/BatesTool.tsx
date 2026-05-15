import { useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { Hash, X } from "lucide-react";

type Position =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

const POSITIONS: Position[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export function BatesTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [prefix, setPrefix] = useState("DOC-");
  const [suffix, setSuffix] = useState("");
  const [start, setStart] = useState(1);
  const [pad, setPad] = useState(6);
  const [position, setPosition] = useState<Position>("bottom-right");
  const [fontSize, setFontSize] = useState(10);

  const handleStamp = async () => {
    if (files.length === 0) return;
    setBusy(true);
    try {
      let counter = start;
      // If multiple files, merge them into one stamped PDF (typical legal flow)
      const out = await PDFDocument.create();
      const font = await out.embedFont(StandardFonts.HelveticaBold);

      for (const file of files) {
        const buf = await file.arrayBuffer();
        const src = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        for (const page of pages) {
          out.addPage(page);
          const num = String(counter).padStart(pad, "0");
          const stamp = `${prefix}${num}${suffix}`;
          const w = page.getWidth();
          const h = page.getHeight();
          const tw = font.widthOfTextAtSize(stamp, fontSize);
          const margin = 22;
          let x = margin;
          let y = margin;
          if (position.includes("right")) x = w - tw - margin;
          if (position.includes("center")) x = (w - tw) / 2;
          if (position.startsWith("top")) y = h - margin - fontSize;
          // White background pill for legibility
          const padX = 6;
          const padY = 3;
          page.drawRectangle({
            x: x - padX,
            y: y - padY,
            width: tw + padX * 2,
            height: fontSize + padY * 2,
            color: rgb(1, 1, 1),
            opacity: 0.85,
          });
          page.drawText(stamp, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(0.08, 0.08, 0.12),
          });
          counter++;
        }
      }

      const bytes = await out.save();
      const name =
        files.length === 1
          ? `${baseName(files[0].name)} (bates).pdf`
          : `bates-stamped (${files.length} files).pdf`;
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), name);
      toast.success(`Stamped ${counter - start} pages`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't stamp those PDFs.");
    } finally {
      setBusy(false);
    }
  };

  if (files.length === 0) {
    return (
      <Dropzone
        accept="pdf-multi"
        multiple
        onFiles={(f) => setFiles(f)}
        title="Drop one or more PDFs"
        hint="Stamps a continuous Bates sequence across every page"
      />
    );
  }

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <div>
      <div className="space-y-2">
        {files.map((f, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-tool-bates/10 text-tool-bates">
              <Hash className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
            </div>
            <button
              onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Remove"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2">
        <Field label="Prefix">
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="DOC-"
          />
        </Field>
        <Field label="Suffix">
          <input
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder=" (optional)"
          />
        </Field>
        <Field label="Start number">
          <input
            type="number"
            min={0}
            value={start}
            onChange={(e) => setStart(Number(e.target.value) || 0)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label={`Zero-padding (${pad} digits)`}>
          <input
            type="range"
            min={1}
            max={10}
            value={pad}
            onChange={(e) => setPad(Number(e.target.value))}
            className="w-full"
          />
        </Field>
        <Field label="Position">
          <div className="grid grid-cols-3 gap-1.5">
            {POSITIONS.map((p) => (
              <button
                key={p}
                onClick={() => setPosition(p)}
                className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                  position === p
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {p.replace("-", " ")}
              </button>
            ))}
          </div>
        </Field>
        <Field label={`Font size (${fontSize}pt)`}>
          <input
            type="range"
            min={7}
            max={18}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-full"
          />
        </Field>
      </div>

      <div className="mt-4 rounded-2xl border border-dashed border-border-strong bg-accent/40 px-4 py-3 text-sm">
        Preview ·{" "}
        <span className="font-mono text-foreground">
          {prefix}
          {String(start).padStart(pad, "0")}
          {suffix}
        </span>{" "}
        →{" "}
        <span className="font-mono text-foreground">
          {prefix}
          {String(start + 1).padStart(pad, "0")}
          {suffix}
        </span>{" "}
        …
      </div>

      <ActionBar
        status={`${files.length} file${files.length === 1 ? "" : "s"} · ${formatBytes(totalSize)}`}
        secondary={
          <button
            onClick={() => setFiles([])}
            className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        }
        primary={
          <button
            onClick={handleStamp}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Stamping…" : "Stamp & download"}
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
