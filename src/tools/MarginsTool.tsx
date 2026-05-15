import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader } from "./SplitTool";
import { downloadBlob, baseName } from "@/lib/format";

const MM_TO_PT = 2.83465;

export function MarginsTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [top, setTop] = useState(15);
  const [right, setRight] = useState(15);
  const [bottom, setBottom] = useState(15);
  const [left, setLeft] = useState(15);
  const [linkAll, setLinkAll] = useState(true);

  const setAll = (v: number) => {
    setTop(v);
    setRight(v);
    setBottom(v);
    setLeft(v);
  };

  const handleApply = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const tPt = top * MM_TO_PT;
      const rPt = right * MM_TO_PT;
      const bPt = bottom * MM_TO_PT;
      const lPt = left * MM_TO_PT;

      const indices = src.getPageIndices();
      const embedded = await out.embedPdf(await src.save(), indices);

      embedded.forEach((emb) => {
        const w = emb.width;
        const h = emb.height;
        const newW = w + lPt + rPt;
        const newH = h + tPt + bPt;
        const page = out.addPage([newW, newH]);
        page.drawPage(emb, {
          x: lPt,
          y: bPt,
          width: w,
          height: h,
        });
      });

      const bytes = await out.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)}-margins.pdf`,
      );
      toast.success("Margins added");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't add margins");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to pad"
        hint="Add white space around each page in millimetres"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Margins (mm)
          </p>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={linkAll}
              onChange={(e) => {
                setLinkAll(e.target.checked);
                if (e.target.checked) setAll(top);
              }}
              className="h-4 w-4 accent-foreground"
            />
            Link all sides
          </label>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Mm
            label="Top"
            value={top}
            onChange={(v) => (linkAll ? setAll(v) : setTop(v))}
          />
          <Mm
            label="Right"
            value={right}
            onChange={(v) => (linkAll ? setAll(v) : setRight(v))}
          />
          <Mm
            label="Bottom"
            value={bottom}
            onChange={(v) => (linkAll ? setAll(v) : setBottom(v))}
          />
          <Mm
            label="Left"
            value={left}
            onChange={(v) => (linkAll ? setAll(v) : setLeft(v))}
          />
        </div>

        {/* Preview */}
        <div className="mt-6 grid place-items-center rounded-xl border border-border bg-background p-6">
          <div
            className="relative overflow-hidden rounded-md bg-tool-resize/10"
            style={{
              width: 200,
              height: 260,
            }}
          >
            <div
              className="absolute rounded-sm bg-foreground/85"
              style={{
                top: `${(top / 100) * 100}px`,
                right: `${(right / 100) * 100}px`,
                bottom: `${(bottom / 100) * 100}px`,
                left: `${(left / 100) * 100}px`,
              }}
            />
          </div>
        </div>
      </div>

      <ActionBar
        status={`Original page stays intact, wrapped with ${top}/${right}/${bottom}/${left} mm`}
        primary={
          <button
            onClick={handleApply}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Padding…" : "Add margins & download"}
          </button>
        }
      />
    </div>
  );
}

function Mm({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="mt-1 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={80}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-foreground"
        />
        <input
          type="number"
          min={0}
          max={200}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm tabular-nums outline-none focus:border-foreground"
        />
      </div>
    </label>
  );
}
