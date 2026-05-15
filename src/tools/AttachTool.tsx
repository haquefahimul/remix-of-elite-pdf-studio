import { useState } from "react";
import { PDFDocument, AFRelationship } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader } from "./SplitTool";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";

export function AttachTool() {
  const [pdf, setPdf] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const handleApply = async () => {
    if (!pdf || files.length === 0) return;
    setBusy(true);
    try {
      const buf = await pdf.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      for (const f of files) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        await doc.attach(bytes, f.name, {
          mimeType: f.type || "application/octet-stream",
          description: `Attached via Folio`,
          creationDate: new Date(),
          modificationDate: new Date(),
          afRelationship: AFRelationship.Supplement,
        });
      }
      const out = await doc.save();
      downloadBlob(
        new Blob([out as BlobPart], { type: "application/pdf" }),
        `${baseName(pdf.name)}-with-attachments.pdf`,
      );
      toast.success(`Attached ${files.length} file${files.length === 1 ? "" : "s"}`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't attach files");
    } finally {
      setBusy(false);
    }
  };

  if (!pdf) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setPdf(f[0])}
        title="Drop the PDF you want to attach files to"
        hint="Then add anything: receipts, source files, screenshots…"
      />
    );
  }

  return (
    <div>
      <FileHeader file={pdf} onReset={() => { setPdf(null); setFiles([]); }} />

      <div className="mt-6">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border-strong/60 bg-surface px-6 py-10 text-center transition hover:bg-accent/50">
          <input
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []);
              setFiles((prev) => [...prev, ...list]);
              e.currentTarget.value = "";
            }}
          />
          <p className="font-display text-2xl tracking-tight">Add files to embed</p>
          <p className="text-sm text-muted-foreground">Any type — they ride along inside the PDF.</p>
        </label>
      </div>

      {files.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
          <ul className="divide-y divide-border">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
                </div>
                <button
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ActionBar
        status={`${files.length} file${files.length === 1 ? "" : "s"} ready to embed`}
        primary={
          <button
            onClick={handleApply}
            disabled={busy || files.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Attaching…" : "Attach & download"}
          </button>
        }
      />
    </div>
  );
}
