import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, formatBytes } from "@/lib/format";

type Item = { id: string; file: File };

export function MergeTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  const addFiles = (files: File[]) => {
    const next = files.map((f) => ({ id: `${f.name}-${f.size}-${Math.random()}`, file: f }));
    setItems((prev) => [...prev, ...next]);
  };

  const move = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const handleMerge = async () => {
    if (items.length < 2) {
      toast.error("Add at least two PDFs to merge.");
      return;
    }
    setBusy(true);
    try {
      const out = await PDFDocument.create();
      for (const item of items) {
        const buf = await item.file.arrayBuffer();
        const src = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
      const bytes = await out.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), "merged.pdf");
      toast.success("Merged PDF ready");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't merge those PDFs. One may be password-protected.");
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <Dropzone
        accept="pdf-multi"
        multiple
        onFiles={addFiles}
        title="Drop PDFs to merge"
        hint="or click to browse — pick two or more"
      />
    );
  }

  return (
    <div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div
            key={item.id}
            className="flex items-center gap-4 rounded-2xl border border-border bg-surface px-4 py-3"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-tool-merge/10 text-sm font-medium text-tool-merge">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{item.file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
            </div>
            <div className="flex items-center gap-1">
              <IconBtn onClick={() => move(i, -1)} disabled={i === 0} label="Move up">
                <ArrowUp className="h-4 w-4" />
              </IconBtn>
              <IconBtn onClick={() => move(i, 1)} disabled={i === items.length - 1} label="Move down">
                <ArrowDown className="h-4 w-4" />
              </IconBtn>
              <IconBtn onClick={() => remove(item.id)} label="Remove" danger>
                <Trash2 className="h-4 w-4" />
              </IconBtn>
            </div>
          </div>
        ))}
      </div>

      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-border-strong px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
        <Plus className="h-4 w-4" /> Add more PDFs
        <input
          type="file"
          accept="application/pdf"
          multiple
          className="sr-only"
          onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
        />
      </label>

      <ActionBar
        status={`${items.length} PDF${items.length === 1 ? "" : "s"} · ${formatBytes(items.reduce((s, i) => s + i.file.size, 0))}`}
        secondary={
          <button
            onClick={() => setItems([])}
            className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        }
        primary={
          <button
            onClick={handleMerge}
            disabled={busy || items.length < 2}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Merging…" : "Merge & download"}
          </button>
        }
      />
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent ${
        danger ? "hover:text-destructive" : "hover:text-foreground"
      } disabled:cursor-not-allowed disabled:opacity-30`}
    >
      {children}
    </button>
  );
}
