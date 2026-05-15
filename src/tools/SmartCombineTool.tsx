import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, formatBytes } from "@/lib/format";
import { GripVertical, X, FileText, ImageIcon } from "lucide-react";

type Item = {
  id: string;
  file: File;
  kind: "pdf" | "image";
};

export function SmartCombineTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const addFiles = (files: File[]) => {
    const next: Item[] = [];
    for (const f of files) {
      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      const isImg = f.type.startsWith("image/");
      if (!isPdf && !isImg) continue;
      next.push({
        id: crypto.randomUUID() as string,
        file: f,
        kind: isPdf ? "pdf" : "image",
      });
    }
    setItems((prev) => [...prev, ...next]);
  };

  const handleDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    setItems((prev) => {
      const from = prev.findIndex((p) => p.id === dragId);
      const to = prev.findIndex((p) => p.id === overId);
      if (from === -1 || to === -1) return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleApply = async () => {
    if (items.length === 0) return;
    setBusy(true);
    try {
      const out = await PDFDocument.create();
      for (const it of items) {
        const buf = await it.file.arrayBuffer();
        if (it.kind === "pdf") {
          const src = await PDFDocument.load(buf, { ignoreEncryption: true });
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach((p) => out.addPage(p));
        } else {
          const isJpg = it.file.type === "image/jpeg" || /\.jpe?g$/i.test(it.file.name);
          const isPng = it.file.type === "image/png" || /\.png$/i.test(it.file.name);
          let bytes = new Uint8Array(buf);
          let img;
          if (isJpg) {
            img = await out.embedJpg(bytes);
          } else if (isPng) {
            img = await out.embedPng(bytes);
          } else {
            // Re-encode webp/etc. to PNG via canvas
            const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
            const i = new Image();
            i.src = url;
            await i.decode();
            const c = document.createElement("canvas");
            c.width = i.naturalWidth;
            c.height = i.naturalHeight;
            const ctx = c.getContext("2d")!;
            ctx.drawImage(i, 0, 0);
            const blob: Blob = await new Promise((res) =>
              c.toBlob((b) => res(b!), "image/png"),
            );
            URL.revokeObjectURL(url);
            bytes = new Uint8Array(await blob.arrayBuffer());
            img = await out.embedPng(bytes);
          }
          const page = out.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        }
      }
      const bytes = await out.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `combined.pdf`,
      );
      toast.success(`Combined ${items.length} item${items.length === 1 ? "" : "s"}`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't combine files");
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <Dropzone
        accept="image"
        onFiles={addFiles}
        title="Drop PDFs and images to combine"
        hint="Mix .pdf, .jpg, .png, .webp into one ordered document"
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <p className="text-sm text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"}</p>
        <div className="flex gap-2">
          <label className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <input
              type="file"
              accept="application/pdf,image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) addFiles(Array.from(e.target.files));
                e.currentTarget.value = "";
              }}
            />
            Add more
          </label>
          <button
            onClick={() => setItems([])}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Clear
          </button>
        </div>
      </div>

      <ul className="mt-6 space-y-2">
        {items.map((it) => (
          <li
            key={it.id}
            draggable
            onDragStart={() => setDragId(it.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => handleDragOver(e, it.id)}
            className={`flex items-center gap-3 rounded-2xl border bg-surface p-3 transition ${
              dragId === it.id ? "border-foreground opacity-60" : "border-border"
            }`}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <div className={`grid h-9 w-9 place-items-center rounded-xl ${
              it.kind === "pdf" ? "bg-tool-merge/10 text-tool-merge" : "bg-tool-jpg-pdf/10 text-tool-jpg-pdf"
            }`}>
              {it.kind === "pdf" ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{it.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {it.kind === "pdf" ? "PDF" : "Image"} · {formatBytes(it.file.size)}
              </p>
            </div>
            <button
              onClick={() => setItems((prev) => prev.filter((p) => p.id !== it.id))}
              className="rounded-full p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <ActionBar
        status="Drag to reorder · images become single pages at native size"
        primary={
          <button
            onClick={handleApply}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Combining…" : "Combine & download"}
          </button>
        }
      />
    </div>
  );
}
