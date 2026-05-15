import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { ModeChip } from "./SplitTool";
import { downloadBlob, formatBytes, baseName } from "@/lib/format";

type Item = {
  file: File;
  preview: string;
  width: number;
  height: number;
  outBlob?: Blob;
  outSize?: number;
};

type Output = "jpeg" | "webp" | "png";

export function ImageCompressTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [quality, setQuality] = useState(75);
  const [maxSide, setMaxSide] = useState(2400);
  const [output, setOutput] = useState<Output>("jpeg");
  const [busy, setBusy] = useState(false);

  const addFiles = async (files: File[]) => {
    const next: Item[] = [];
    for (const f of files) {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.src = url;
      await img.decode().catch(() => {});
      next.push({ file: f, preview: url, width: img.naturalWidth, height: img.naturalHeight });
    }
    setItems((prev) => [...prev, ...next]);
  };

  useEffect(() => {
    return () => {
      items.forEach((i) => URL.revokeObjectURL(i.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compress = async (item: Item): Promise<{ blob: Blob; size: number }> => {
    const img = new Image();
    img.src = item.preview;
    await img.decode();
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: output === "png" })!;
    if (output !== "png") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    const mime = output === "jpeg" ? "image/jpeg" : output === "webp" ? "image/webp" : "image/png";
    const q = output === "png" ? undefined : quality / 100;
    const blob: Blob = await new Promise((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), mime, q),
    );
    return { blob, size: blob.size };
  };

  const handleApply = async () => {
    if (items.length === 0) return;
    setBusy(true);
    try {
      const updated: Item[] = [];
      for (const it of items) {
        const r = await compress(it);
        updated.push({ ...it, outBlob: r.blob, outSize: r.size });
      }
      setItems(updated);

      if (updated.length === 1) {
        const it = updated[0];
        const ext = output === "jpeg" ? "jpg" : output;
        downloadBlob(it.outBlob!, `${baseName(it.file.name)} (compressed).${ext}`);
      } else {
        const mod = await import("jszip");
        const zip = new mod.default();
        const ext = output === "jpeg" ? "jpg" : output;
        for (const it of updated) {
          zip.file(`${baseName(it.file.name)}.${ext}`, it.outBlob!);
        }
        const blob = await zip.generateAsync({ type: "blob" });
        downloadBlob(blob, `images-compressed.zip`);
      }
      toast.success("Compressed");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't compress images");
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <Dropzone
        accept="image"
        onFiles={addFiles}
        title="Drop JPGs, PNGs, or WebPs"
        hint="Pick a quality and max dimension — Folio shrinks every image locally"
      />
    );
  }

  const totalIn = items.reduce((a, b) => a + b.file.size, 0);
  const totalOut = items.reduce((a, b) => a + (b.outSize ?? 0), 0);
  const savings = totalOut > 0 ? Math.max(0, 1 - totalOut / totalIn) : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {items.length} image{items.length === 1 ? "" : "s"} · {formatBytes(totalIn)}
        </p>
        <div className="flex gap-2">
          <label className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <input
              type="file"
              accept="image/*"
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

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Format</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ModeChip active={output === "jpeg"} onClick={() => setOutput("jpeg")}>JPG</ModeChip>
            <ModeChip active={output === "webp"} onClick={() => setOutput("webp")}>WebP</ModeChip>
            <ModeChip active={output === "png"} onClick={() => setOutput("png")}>PNG</ModeChip>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Quality — {quality}
          </label>
          <input
            type="range"
            min={20}
            max={100}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            disabled={output === "png"}
            className="mt-2 w-full accent-foreground disabled:opacity-50"
          />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Max dimension — {maxSide}px
          </label>
          <input
            type="range"
            min={400}
            max={4800}
            step={100}
            value={maxSide}
            onChange={(e) => setMaxSide(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {items.map((it, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <img src={it.preview} alt={it.file.name} className="block aspect-square w-full object-cover" />
            <div className="px-2 py-1.5 text-xs">
              <p className="truncate font-medium">{it.file.name}</p>
              <p className="text-muted-foreground">
                {formatBytes(it.file.size)}
                {it.outSize ? ` → ${formatBytes(it.outSize)}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>

      <ActionBar
        status={
          totalOut > 0
            ? `${formatBytes(totalIn)} → ${formatBytes(totalOut)} · saved ${(savings * 100).toFixed(0)}%`
            : `${formatBytes(totalIn)} ready`
        }
        primary={
          <button
            onClick={handleApply}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Compressing…" : "Compress & download"}
          </button>
        }
      />
    </div>
  );
}
