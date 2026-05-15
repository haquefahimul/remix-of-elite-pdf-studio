import { useState } from "react";
import { PDFDocument, PDFName } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { Layers, X } from "lucide-react";

export function FlattenTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [stripJs, setStripJs] = useState(true);
  const [stripLinks, setStripLinks] = useState(false);

  const handleFlatten = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });

      let formFields = 0;
      try {
        const form = doc.getForm();
        formFields = form.getFields().length;
        if (formFields > 0) form.flatten();
      } catch {
        // no form
      }

      if (stripLinks) {
        const annotsKey = PDFName.of("Annots");
        for (const page of doc.getPages()) {
          if (page.node.has(annotsKey)) {
            page.node.delete(annotsKey);
          }
        }
      }

      if (stripJs) {
        const catalog = doc.catalog;
        try {
          catalog.delete(PDFName.of("Names"));
          catalog.delete(PDFName.of("OpenAction"));
          catalog.delete(PDFName.of("AA"));
        } catch {
          // ignore
        }
      }

      const bytes = await doc.save({ useObjectStreams: true });
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)} (flattened).pdf`
      );
      toast.success(
        formFields > 0
          ? `Flattened ${formFields} form field${formFields === 1 ? "" : "s"}`
          : "Flattened PDF ready"
      );
    } catch (err) {
      console.error(err);
      toast.error("Couldn't flatten that PDF.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to flatten"
        hint="Bakes form fields and clears interactive layers"
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-tool-flatten/10 text-tool-flatten">
          <Layers className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
        </div>
        <button
          onClick={() => setFile(null)}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Remove"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-surface p-5">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={stripJs}
            onChange={(e) => setStripJs(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Strip JavaScript & open actions</span>
            <span className="block text-xs text-muted-foreground">
              Removes embedded scripts and auto-run actions for safer sharing.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={stripLinks}
            onChange={(e) => setStripLinks(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Remove all annotations</span>
            <span className="block text-xs text-muted-foreground">
              Drops links, comments and sticky notes — visible content stays.
            </span>
          </span>
        </label>
      </div>

      <ActionBar
        status="Form values keep their look — they just stop being editable"
        primary={
          <button
            onClick={handleFlatten}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Flattening…" : "Flatten & download"}
          </button>
        }
      />
    </div>
  );
}
