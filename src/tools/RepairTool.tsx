import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Wrench } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { FileHeader } from "./SplitTool";
import { pdfjsLib } from "@/lib/pdf-worker";

type Diag = {
  pageCount: number;
  pdfjsOk: boolean;
  pdflibOk: boolean;
  warnings: string[];
};

export function RepairTool() {
  const [file, setFile] = useState<File | null>(null);
  const [diag, setDiag] = useState<Diag | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  const inspect = async (f: File) => {
    setFile(f);
    setDiag(null);
    setScanning(true);
    const warnings: string[] = [];
    let pageCount = 0;
    let pdfjsOk = false;
    let pdflibOk = false;
    try {
      const buf = await f.arrayBuffer();
      try {
        const pdf = await pdfjsLib.getDocument({ data: buf.slice(0), stopAtErrors: false }).promise;
        pageCount = pdf.numPages;
        pdfjsOk = true;
        await pdf.destroy();
      } catch (err) {
        warnings.push(`Renderer rejected the file: ${(err as Error).message}`);
      }
      try {
        const doc = await PDFDocument.load(buf, { ignoreEncryption: true, throwOnInvalidObject: false });
        if (!pageCount) pageCount = doc.getPageCount();
        pdflibOk = true;
      } catch (err) {
        warnings.push(`Structural parser rejected the file: ${(err as Error).message}`);
      }
    } catch {
      warnings.push("Couldn't read the file at all.");
    }
    setDiag({ pageCount, pdfjsOk, pdflibOk, warnings });
    setScanning(false);
  };

  const handleRepair = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      // Strategy 1: structural resave with pdf-lib (fastest, preserves text/vectors)
      try {
        const doc = await PDFDocument.load(buf, {
          ignoreEncryption: true,
          throwOnInvalidObject: false,
          updateMetadata: false,
        });
        // copy into fresh doc to drop dangling refs
        const out = await PDFDocument.create();
        const indices = Array.from({ length: doc.getPageCount() }, (_, i) => i);
        const pages = await out.copyPages(doc, indices);
        pages.forEach((p) => out.addPage(p));
        out.setProducer("Folio (repaired)");
        const bytes = await out.save();
        downloadBlob(
          new Blob([bytes as BlobPart], { type: "application/pdf" }),
          `${baseName(file.name)} (repaired).pdf`
        );
        toast.success("Repaired PDF ready");
        return;
      } catch (err) {
        console.warn("structural repair failed, falling back to raster", err);
      }

      // Strategy 2: raster fallback — re-render every page via pdf.js, reassemble
      const pdf = await pdfjsLib.getDocument({ data: buf.slice(0), stopAtErrors: false }).promise;
      const out = await PDFDocument.create();
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d", { alpha: false })!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: ctx, viewport } as Parameters<typeof page.render>[0])
          .promise;
        const blob: Blob = await new Promise((r) =>
          canvas.toBlob((b) => r(b!), "image/jpeg", 0.9)
        );
        const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        const p = out.addPage([viewport.width / 2, viewport.height / 2]);
        p.drawImage(img, { x: 0, y: 0, width: p.getWidth(), height: p.getHeight() });
        page.cleanup();
      }
      await pdf.destroy();
      const bytes = await out.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)} (repaired).pdf`
      );
      toast.success("Repaired via raster fallback");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't repair this file. It may be too damaged.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => inspect(f[0])}
        title="Drop a damaged PDF"
        hint="We'll diagnose it and rebuild a clean copy"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <DiagCard
          title="Page renderer"
          ok={diag?.pdfjsOk ?? null}
          loading={scanning}
          ok_label="Pages render correctly"
          fail_label="Pages can't be rendered"
        />
        <DiagCard
          title="Structural parser"
          ok={diag?.pdflibOk ?? null}
          loading={scanning}
          ok_label="PDF structure is valid"
          fail_label="Structural objects are damaged"
        />
      </div>

      {diag && diag.warnings.length > 0 && (
        <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-destructive">Warnings</p>
          <ul className="mt-2 space-y-1 text-xs text-foreground/80">
            {diag.warnings.map((w, i) => (
              <li key={i} className="font-mono">
                · {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-tool-repair/10">
            <Wrench className="h-5 w-5 text-tool-repair" />
          </div>
          <div>
            <p className="font-medium text-foreground">How repair works</p>
            <p className="mt-1 text-sm text-muted-foreground">
              First we resave the PDF with a strict parser that drops invalid objects. If that
              fails, we re-render each page locally and reassemble into a fresh document.
            </p>
          </div>
        </div>
      </div>

      <ActionBar
        status={
          diag
            ? `${diag.pageCount} pages detected · ${formatBytes(file.size)}`
            : "Diagnosing…"
        }
        primary={
          <button
            onClick={handleRepair}
            disabled={busy || scanning || !diag}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Repairing…" : "Repair & download"}
          </button>
        }
      />
    </div>
  );
}

function DiagCard({
  title,
  ok,
  loading,
  ok_label,
  fail_label,
}: {
  title: string;
  ok: boolean | null;
  loading: boolean;
  ok_label: string;
  fail_label: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="mt-3 flex items-center gap-3">
        {loading ? (
          <Spinner />
        ) : ok === true ? (
          <CheckCircle2 className="h-5 w-5 text-success" />
        ) : ok === false ? (
          <AlertCircle className="h-5 w-5 text-destructive" />
        ) : (
          <span className="h-5 w-5 rounded-full bg-muted" />
        )}
        <p className="text-sm text-foreground">
          {loading ? "Checking…" : ok ? ok_label : ok === false ? fail_label : "Pending"}
        </p>
      </div>
    </div>
  );
}
