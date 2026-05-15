import { useEffect, useState } from "react";
import { PDFDocument, PDFName, PDFArray } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader } from "./SplitTool";
import { downloadBlob, baseName } from "@/lib/format";

export function StripAnnotationsTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [annotCount, setAnnotCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) return;
    let cancel = false;
    (async () => {
      try {
        const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
        const pages = doc.getPages();
        let total = 0;
        for (const p of pages) {
          const annots = p.node.lookup(PDFName.of("Annots"));
          if (annots instanceof PDFArray) total += annots.size();
        }
        if (!cancel) {
          setPageCount(pages.length);
          setAnnotCount(total);
        }
      } catch {
        if (!cancel) toast.error("Couldn't read that PDF");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [file]);

  const handleApply = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      let removed = 0;
      for (const p of doc.getPages()) {
        const annots = p.node.lookup(PDFName.of("Annots"));
        if (annots instanceof PDFArray) {
          removed += annots.size();
          p.node.delete(PDFName.of("Annots"));
        }
      }
      const out = await doc.save();
      downloadBlob(
        new Blob([out as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)}-clean.pdf`,
      );
      toast.success(`Removed ${removed} annotation${removed === 1 ? "" : "s"}`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't strip annotations");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to strip annotations"
        hint="Removes highlights, sticky notes, links, form widgets, and stamps"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Stat label="Pages" value={pageCount.toString()} />
        <Stat label="Annotations found" value={annotCount.toString()} />
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        Strips comments, highlights, sticky notes, link rectangles, and other annotation
        objects. Page content (text, images) is left untouched.
      </p>

      <ActionBar
        status={annotCount === 0 ? "Nothing to strip" : `${annotCount} annotation${annotCount === 1 ? "" : "s"} will be removed`}
        primary={
          <button
            onClick={handleApply}
            disabled={busy || annotCount === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Stripping…" : "Strip & download"}
          </button>
        }
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl tracking-tight text-foreground">{value}</p>
    </div>
  );
}
