import { useState } from "react";
import JSZip from "jszip";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { X } from "lucide-react";

type Ratio = "1:1" | "4:3" | "3:2" | "16:9" | "9:16" | "3:4" | "2:3";
type Anchor = "center" | "top" | "bottom" | "left" | "right";

const RATIOS: Record<Ratio, number> = {
  "1:1": 1,
  "4:3": 4 / 3,
  "3:2": 3 / 2,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "3:4": 3 / 4,
  "2:3": 2 / 3,
};

function computeCrop(w: number, h: number, ratio: number, anchor: Anchor) {
  const current = w / h;
  let cw = w;
  let ch = h;
  if (current > ratio) {
    cw = Math.round(h * ratio);
  } else {
    ch = Math.round(w / ratio);
  }
  let sx = Math.round((w - cw) / 2);
  let sy = Math.round((h - ch) / 2);
  if (anchor === "left") sx = 0;
  if (anchor === "right") sx = w - cw;
  if (anchor === "top") sy = 0;
  if (anchor === "bottom") sy = h - ch;
  return { sx, sy, cw, ch };
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("load"));
      img.src = url;
    });
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function ImageCropTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [ratio, setRatio] = useState<Ratio>("1:1");
  const [anchor, setAnchor] = useState<Anchor>("center");
  const [quality, setQuality] = useState(92);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (!files.length) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      const r = RATIOS[ratio];
      for (const f of files) {
        const img = await loadImage(f);
        const { sx, sy, cw, ch } = computeCrop(img.naturalWidth, img.naturalHeight, r, anchor);
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);
        const isPng = /png$/i.test(f.type) || /\.png$/i.test(f.name);
        const mime = isPng ? "image/png" : "image/jpeg";
        const ext = isPng ? "png" : "jpg";
        const blob = await new Promise<Blob | null>((res) =>
          canvas.toBlob(res, mime, quality / 100),
        );
        if (blob) zip.file(`${baseName(f.name)} (${ratio}).${ext}`, blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      downloadBlob(out, `cropped-${ratio.replace(":", "x")}.zip`);
      toast.success(`Cropped ${files.length} image${files.length === 1 ? "" : "s"}`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't crop those images");
    } finally {
      setBusy(false);
    }
  };

  if (!files.length) {
    return (
      <Dropzone
        accept="image"
        multiple
        onFiles={setFiles}
        title="Drop images to crop"
        hint="JPG, PNG, WebP — pick a ratio and anchor"
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <p className="text-sm">
          <span className="font-medium">{files.length}</span> image
          {files.length === 1 ? "" : "s"}{" "}
          <span className="text-muted-foreground">
            · {formatBytes(files.reduce((a, f) => a + f.size, 0))}
          </span>
        </p>
        <button
          onClick={() => setFiles([])}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Aspect ratio
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(Object.keys(RATIOS) as Ratio[]).map((r) => (
              <button
                key={r}
                onClick={() => setRatio(r)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  ratio === r
                    ? "bg-foreground text-background"
                    : "border border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Anchor
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["center", "top", "bottom", "left", "right"] as Anchor[]).map((a) => (
              <button
                key={a}
                onClick={() => setAnchor(a)}
                className={`rounded-full px-3 py-1 text-xs capitalize transition-colors ${
                  anchor === a
                    ? "bg-foreground text-background"
                    : "border border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            JPG quality — {quality}%
          </label>
          <input
            type="range"
            min={40}
            max={100}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
          />
        </div>
      </div>

      <ActionBar
        status={`Cropped to ${ratio}, anchored ${anchor}`}
        primary={
          <button
            onClick={apply}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Cropping…" : "Crop & download"}
          </button>
        }
      />
    </div>
  );
}
