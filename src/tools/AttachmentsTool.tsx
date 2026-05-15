import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader } from "./SplitTool";
import { pdfjsLib } from "@/lib/pdf-worker";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";

type Attachment = {
  filename: string;
  bytes: Uint8Array;
};

export function AttachmentsTool() {
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<Attachment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) return;
    let cancel = false;
    setLoading(true);
    setItems(null);
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buf }).promise;
        const att = (await doc.getAttachments()) as
          | Record<string, { filename: string; content: Uint8Array }>
          | null;
        const arr: Attachment[] = att
          ? Object.values(att).map((v) => ({
              filename: v.filename || "attachment",
              bytes: v.content,
            }))
          : [];
        if (!cancel) setItems(arr);
      } catch (err) {
        console.error(err);
        if (!cancel) toast.error("Couldn't read attachments");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [file]);

  const handleSave = async (a: Attachment) => {
    downloadBlob(new Blob([a.bytes as BlobPart]), a.filename);
  };

  const handleSaveAll = async () => {
    if (!items || items.length === 0) return;
    setBusy(true);
    try {
      const mod = await import("jszip");
      const zip = new mod.default();
      const used = new Set<string>();
      for (const a of items) {
        let name = a.filename;
        let i = 1;
        while (used.has(name)) {
          const dot = a.filename.lastIndexOf(".");
          const stem = dot === -1 ? a.filename : a.filename.slice(0, dot);
          const ext = dot === -1 ? "" : a.filename.slice(dot);
          name = `${stem} (${i})${ext}`;
          i++;
        }
        used.add(name);
        zip.file(name, a.bytes);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `${baseName(file!.name)}-attachments.zip`);
      toast.success(`Saved ${items.length} file${items.length === 1 ? "" : "s"}`);
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to extract attachments"
        hint="Pulls every embedded file out, with no upload"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => { setFile(null); setItems(null); }} />

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Scanning attachments…</p>
        ) : items && items.length > 0 ? (
          <ul className="divide-y divide-border">
            {items.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{a.filename}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(a.bytes.byteLength)}</p>
                </div>
                <button
                  onClick={() => handleSave(a)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No embedded attachments were found in this PDF.
          </p>
        )}
      </div>

      <ActionBar
        status={items ? `${items.length} attached file${items.length === 1 ? "" : "s"}` : ""}
        primary={
          <button
            onClick={handleSaveAll}
            disabled={busy || loading || !items || items.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Zipping…" : "Save all as zip"}
          </button>
        }
      />
    </div>
  );
}
