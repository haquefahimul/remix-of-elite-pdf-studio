import { useState } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(v, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function BordersTool() {
  const [file, setFile] = useState<File | null>(null);
  const [color, setColor] = useState("#1f2937");
  const [thickness, setThickness] = useState(2);
  const [inset, setInset] = useState(12);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await PDFDocument.load(buf);
      const [r, g, b] = hexToRgb(color);
      for (const page of pdf.getPages()) {
        const w = page.getWidth();
        const h = page.getHeight();
        const t = thickness;
        const off = inset + t / 2;
        page.drawRectangle({
          x: off,
          y: off,
          width: Math.max(1, w - off * 2),
          height: Math.max(1, h - off * 2),
          borderColor: rgb(r, g, b),
          borderWidth: t,
        });
      }
      const bytes = await pdf.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)} (bordered).pdf`,
      );
      toast.success("Borders added");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't add borders");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(fs) => setFile(fs[0])}
        title="Drop a PDF to add page borders"
        hint="Pick color, thickness, and inset — applied to every page"
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <p className="text-sm">
          <span className="font-medium">{file.name}</span>{" "}
          <span className="text-muted-foreground">· {formatBytes(file.size)}</span>
        </p>
        <button
          onClick={() => setFile(null)}
          className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Change
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Color</p>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-background"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Thickness — {thickness} pt
          </label>
          <input
            type="range"
            min={0.5}
            max={20}
            step={0.5}
            value={thickness}
            onChange={(e) => setThickness(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
          />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Inset — {inset} pt
          </label>
          <input
            type="range"
            min={0}
            max={72}
            step={1}
            value={inset}
            onChange={(e) => setInset(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
          />
        </div>
      </div>

      <div className="mt-6 grid place-items-center rounded-2xl border border-border bg-accent/40 p-8">
        <div
          className="relative aspect-[3/4] w-48 rounded-md bg-surface shadow-soft"
          style={{
            boxShadow: "0 1px 2px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.06)",
          }}
        >
          <div
            className="absolute"
            style={{
              top: `${inset / 2}%`,
              left: `${inset / 2}%`,
              right: `${inset / 2}%`,
              bottom: `${inset / 2}%`,
              border: `${Math.max(1, thickness)}px solid ${color}`,
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      <ActionBar
        status="Border drawn on every page"
        primary={
          <button
            onClick={apply}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Working…" : "Add borders"}
          </button>
        }
      />
    </div>
  );
}
