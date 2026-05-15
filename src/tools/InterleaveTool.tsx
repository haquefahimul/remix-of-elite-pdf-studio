import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { ModeChip } from "./SplitTool";
import { downloadBlob, formatBytes } from "@/lib/format";

type Order = "alternate" | "alternate-reverse";

export function InterleaveTool() {
  const [a, setA] = useState<File | null>(null);
  const [b, setB] = useState<File | null>(null);
  const [order, setOrder] = useState<Order>("alternate");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!a || !b) return;
    setBusy(true);
    try {
      const [ab, bb] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
      const docA = await PDFDocument.load(ab);
      const docB = await PDFDocument.load(bb);
      const out = await PDFDocument.create();
      const aPages = await out.copyPages(docA, docA.getPageIndices());
      const bPagesRaw = await out.copyPages(docB, docB.getPageIndices());
      const bPages = order === "alternate-reverse" ? [...bPagesRaw].reverse() : bPagesRaw;
      const max = Math.max(aPages.length, bPages.length);
      for (let i = 0; i < max; i++) {
        if (aPages[i]) out.addPage(aPages[i]);
        if (bPages[i]) out.addPage(bPages[i]);
      }
      const bytes = await out.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), "interleaved.pdf");
      toast.success("Interleaved");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't interleave PDFs");
    } finally {
      setBusy(false);
    }
  };

  if (!a || !b) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Slot label="Front sides (or odd pages)" file={a} onFile={setA} />
        <Slot label="Back sides (or even pages)" file={b} onFile={setB} />
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FilePill label="A" file={a} onClear={() => setA(null)} />
        <FilePill label="B" file={b} onClear={() => setB(null)} />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Order</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ModeChip active={order === "alternate"} onClick={() => setOrder("alternate")}>
            A1, B1, A2, B2…
          </ModeChip>
          <ModeChip active={order === "alternate-reverse"} onClick={() => setOrder("alternate-reverse")}>
            A1, Blast, A2, Blast-1…
          </ModeChip>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Reverse mode is perfect when the back-side scan came out flipped (e.g. a page-feed scanner).
        </p>
      </div>

      <ActionBar
        status={`${formatBytes(a.size + b.size)} ready`}
        primary={
          <button
            onClick={run}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Interleaving…" : "Interleave & download"}
          </button>
        }
      />
    </div>
  );
}

function Slot({ label, file, onFile }: { label: string; file: File | null; onFile: (f: File) => void }) {
  if (file) return <FilePill label={label} file={file} onClear={() => onFile(null as unknown as File)} />;
  return (
    <Dropzone
      accept="pdf"
      onFiles={(fs) => onFile(fs[0])}
      title={label}
      hint="Drop a PDF or click to browse"
    />
  );
}

function FilePill({ label, file, onClear }: { label: string; file: File; onClear: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
      </div>
      <button
        onClick={onClear}
        className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        Replace
      </button>
    </div>
  );
}
