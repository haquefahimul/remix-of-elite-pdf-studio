import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { ModeChip } from "./SplitTool";
import { downloadBlob, formatBytes, baseName } from "@/lib/format";

type Position = "before" | "after";

export function CoverPageTool() {
  const [main, setMain] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [position, setPosition] = useState<Position>("before");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!main || !cover) return;
    setBusy(true);
    try {
      const mainBuf = await main.arrayBuffer();
      const out = await PDFDocument.load(mainBuf);

      const isImage = cover.type.startsWith("image/");
      let coverPages: number[] = [];

      if (isImage) {
        const imgBytes = await cover.arrayBuffer();
        const img =
          cover.type === "image/png"
            ? await out.embedPng(imgBytes)
            : await out.embedJpg(imgBytes);
        const firstPage = out.getPages()[0];
        const w = firstPage?.getWidth() ?? 595.28;
        const h = firstPage?.getHeight() ?? 841.89;
        const page = out.insertPage(position === "before" ? 0 : out.getPageCount(), [w, h]);
        const ratio = Math.min(w / img.width, h / img.height);
        const dw = img.width * ratio;
        const dh = img.height * ratio;
        page.drawImage(img, {
          x: (w - dw) / 2,
          y: (h - dh) / 2,
          width: dw,
          height: dh,
        });
      } else {
        const coverBuf = await cover.arrayBuffer();
        const coverDoc = await PDFDocument.load(coverBuf);
        const copied = await out.copyPages(coverDoc, coverDoc.getPageIndices());
        if (position === "before") {
          copied.forEach((p, i) => out.insertPage(i, p));
          coverPages = copied.map((_, i) => i);
        } else {
          copied.forEach((p) => out.addPage(p));
          coverPages = copied.map((_, i) => out.getPageCount() - copied.length + i);
        }
      }

      void coverPages;
      const bytes = await out.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(main.name)} (with cover).pdf`,
      );
      toast.success("Cover added");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't add cover page");
    } finally {
      setBusy(false);
    }
  };

  if (!main) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(fs) => setMain(fs[0])}
        title="Drop your main PDF"
        hint="Then upload a cover (PDF or image) to prepend or append"
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <p className="text-sm">
          <span className="font-medium">{main.name}</span>{" "}
          <span className="text-muted-foreground">· {formatBytes(main.size)}</span>
        </p>
        <button
          onClick={() => {
            setMain(null);
            setCover(null);
          }}
          className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Change
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cover</p>
        {cover ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{cover.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(cover.size)}</p>
            </div>
            <button
              onClick={() => setCover(null)}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Replace
            </button>
          </div>
        ) : (
          <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border-strong/60 bg-surface-elevated p-6 text-sm text-muted-foreground hover:bg-accent">
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setCover(f);
                e.currentTarget.value = "";
              }}
            />
            Upload cover (PDF, JPG, or PNG)
          </label>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Position</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ModeChip active={position === "before"} onClick={() => setPosition("before")}>
            Prepend (front cover)
          </ModeChip>
          <ModeChip active={position === "after"} onClick={() => setPosition("after")}>
            Append (back cover)
          </ModeChip>
        </div>
      </div>

      <ActionBar
        status={cover ? `${formatBytes(main.size + cover.size)} ready` : "Pick a cover file"}
        primary={
          <button
            onClick={run}
            disabled={busy || !cover}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Adding cover…" : "Add cover & download"}
          </button>
        }
      />
    </div>
  );
}
