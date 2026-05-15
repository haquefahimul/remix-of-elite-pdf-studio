import { useState } from "react";
import JSZip from "jszip";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { X } from "lucide-react";

type Mode = "white" | "transparent";

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

function findBounds(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  mode: Mode,
  threshold: number,
): { x: number; y: number; w: number; h: number } | null {
  const isBg = (i: number) => {
    const a = data[i + 3];
    if (mode === "transparent") return a < threshold;
    if (a < 8) return true;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    return r >= 255 - threshold && g >= 255 - threshold && b >= 255 - threshold;
  };

  let top = -1;
  let bottom = -1;
  let left = -1;
  let right = -1;

  for (let y = 0; y < h && top === -1; y++) {
    for (let x = 0; x < w; x++) {
      if (!isBg((y * w + x) * 4)) {
        top = y;
        break;
      }
    }
  }
  if (top === -1) return null;
  for (let y = h - 1; y >= 0 && bottom === -1; y--) {
    for (let x = 0; x < w; x++) {
      if (!isBg((y * w + x) * 4)) {
        bottom = y;
        break;
      }
    }
  }
  for (let x = 0; x < w && left === -1; x++) {
    for (let y = top; y <= bottom; y++) {
      if (!isBg((y * w + x) * 4)) {
        left = x;
        break;
      }
    }
  }
  for (let x = w - 1; x >= 0 && right === -1; x--) {
    for (let y = top; y <= bottom; y++) {
      if (!isBg((y * w + x) * 4)) {
        right = x;
        break;
      }
    }
  }
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

export function ImageTrimTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<Mode>("white");
  const [threshold, setThreshold] = useState(8);
  const [padding, setPadding] = useState(0);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (!files.length) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      let trimmed = 0;
      for (const f of files) {
        const img = await loadImage(f);
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, w, h);
        const b = findBounds(id.data, w, h, mode, threshold);
        if (!b || (b.x === 0 && b.y === 0 && b.w === w && b.h === h)) {
          zip.file(f.name, await f.arrayBuffer());
          continue;
        }
        const px = Math.max(0, Math.min(b.x, padding));
        const py = Math.max(0, Math.min(b.y, padding));
        const ex = Math.max(0, Math.min(w - (b.x + b.w), padding));
        const ey = Math.max(0, Math.min(h - (b.y + b.h), padding));
        const ow = b.w + px + ex;
        const oh = b.h + py + ey;
        const out = document.createElement("canvas");
        out.width = ow;
        out.height = oh;
        const octx = out.getContext("2d")!;
        octx.drawImage(c, b.x - px, b.y - py, ow, oh, 0, 0, ow, oh);
        const isPng = mode === "transparent" || /png$/i.test(f.type) || /\.png$/i.test(f.name);
        const mime = isPng ? "image/png" : "image/jpeg";
        const ext = isPng ? "png" : "jpg";
        const blob = await new Promise<Blob | null>((res) =>
          out.toBlob(res, mime, 0.92),
        );
        if (blob) {
          zip.file(`${baseName(f.name)} (trimmed).${ext}`, blob);
          trimmed++;
        }
      }
      const out = await zip.generateAsync({ type: "blob" });
      downloadBlob(out, `trimmed-images.zip`);
      toast.success(`Trimmed ${trimmed} of ${files.length}`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't trim those images");
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
        title="Drop images to auto-trim borders"
        hint="Removes uniform white or transparent edges in batch"
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
            Trim
          </p>
          <div className="mt-3 inline-flex rounded-full border border-border bg-background p-1">
            {(["white", "transparent"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-full px-3 py-1 text-sm capitalize transition-colors ${
                  mode === m
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tolerance — {threshold}
          </label>
          <input
            type="range"
            min={0}
            max={64}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
          />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Padding — {padding}px
          </label>
          <input
            type="range"
            min={0}
            max={64}
            value={padding}
            onChange={(e) => setPadding(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
          />
        </div>
      </div>

      <ActionBar
        status="Detects edges automatically — keeps the rest"
        primary={
          <button
            onClick={apply}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Trimming…" : "Trim & download"}
          </button>
        }
      />
    </div>
  );
}
