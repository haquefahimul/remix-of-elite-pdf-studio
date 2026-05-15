import { useEffect, useState } from "react";
import { PDFDocument, PageSizes } from "pdf-lib";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, formatBytes } from "@/lib/format";
import { ModeChip } from "./SplitTool";

type Item = { id: string; file: File; preview: string };
type PageSize = "A4" | "Letter" | "Fit";
type Orientation = "portrait" | "landscape";
type Margin = "none" | "small" | "big";

const MARGINS: Record<Margin, number> = { none: 0, small: 24, big: 56 };

export function JpgToPdfTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("A4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [margin, setMargin] = useState<Margin>("small");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => items.forEach((i) => URL.revokeObjectURL(i.preview));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (files: File[]) => {
    const next = files
      .filter((f) => f.type === "image/jpeg" || f.type === "image/png" || f.type === "image/webp")
      .map((f) => ({
        id: `${f.name}-${f.size}-${Math.random()}`,
        file: f,
        preview: URL.createObjectURL(f),
      }));
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

  const remove = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleConvert = async () => {
    if (items.length === 0) return;
    setBusy(true);
    try {
      const out = await PDFDocument.create();
      for (const item of items) {
        const bytes = new Uint8Array(await item.file.arrayBuffer());
        let img;
        // pdf-lib needs PNG vs JPG distinction. Convert non-JPG via canvas to JPG.
        if (item.file.type === "image/png") {
          img = await out.embedPng(bytes);
        } else if (item.file.type === "image/jpeg") {
          img = await out.embedJpg(bytes);
        } else {
          // webp — re-encode as jpeg
          const reencoded = await reencodeAsJpeg(item.preview);
          img = await out.embedJpg(reencoded);
        }

        const m = MARGINS[margin];
        let pageW: number, pageH: number;
        if (pageSize === "Fit") {
          pageW = img.width + m * 2;
          pageH = img.height + m * 2;
        } else {
          const base = pageSize === "A4" ? PageSizes.A4 : PageSizes.Letter;
          [pageW, pageH] = orientation === "portrait" ? base : [base[1], base[0]];
        }

        const page = out.addPage([pageW, pageH]);
        const availW = pageW - m * 2;
        const availH = pageH - m * 2;
        const ratio = Math.min(availW / img.width, availH / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        page.drawImage(img, {
          x: (pageW - w) / 2,
          y: (pageH - h) / 2,
          width: w,
          height: h,
        });
      }
      const bytes = await out.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), "images.pdf");
      toast.success("PDF ready");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't build PDF.");
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <Dropzone
        accept="image"
        multiple
        onFiles={addFiles}
        title="Drop images to convert"
        hint="JPG, PNG, or WebP — drop one or many"
      />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item, i) => (
          <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="relative aspect-[3/4] bg-muted">
              <img src={item.preview} alt={item.file.name} className="h-full w-full object-contain" />
              <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                {i + 1}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 px-3 py-2">
              <p className="min-w-0 truncate text-xs text-muted-foreground" title={item.file.name}>
                {item.file.name}
              </p>
              <div className="flex shrink-0 items-center">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove(item.id)}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-border-strong px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
        <Plus className="h-4 w-4" /> Add more images
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
        />
      </label>

      <div className="mt-8 grid gap-6 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Page size</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["A4", "Letter", "Fit"] as PageSize[]).map((s) => (
              <ModeChip key={s} active={pageSize === s} onClick={() => setPageSize(s)}>{s}</ModeChip>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Orientation</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <ModeChip active={orientation === "portrait"} onClick={() => setOrientation("portrait")}>Portrait</ModeChip>
            <ModeChip active={orientation === "landscape"} onClick={() => setOrientation("landscape")}>Landscape</ModeChip>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Margin</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <ModeChip active={margin === "none"} onClick={() => setMargin("none")}>None</ModeChip>
            <ModeChip active={margin === "small"} onClick={() => setMargin("small")}>Small</ModeChip>
            <ModeChip active={margin === "big"} onClick={() => setMargin("big")}>Big</ModeChip>
          </div>
        </div>
      </div>

      <ActionBar
        status={`${items.length} image${items.length === 1 ? "" : "s"} · ${formatBytes(items.reduce((s, i) => s + i.file.size, 0))}`}
        secondary={
          <button
            onClick={() => {
              items.forEach((i) => URL.revokeObjectURL(i.preview));
              setItems([]);
            }}
            className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        }
        primary={
          <button
            onClick={handleConvert}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Building PDF…" : "Convert to PDF"}
          </button>
        }
      />
    </div>
  );
}

async function reencodeAsJpeg(src: string): Promise<Uint8Array> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("image load"));
    img.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.92));
  return new Uint8Array(await blob.arrayBuffer());
}
