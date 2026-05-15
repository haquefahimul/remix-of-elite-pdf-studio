import { useState } from "react";
import JSZip from "jszip";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { X } from "lucide-react";

type Mode = "blur" | "pixelate";

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

export function ImageBlurTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<Mode>("blur");
  const [strength, setStrength] = useState(12);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (!files.length) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      for (const f of files) {
        const img = await loadImage(f);
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        if (mode === "blur") {
          ctx.filter = `blur(${strength}px)`;
          ctx.drawImage(img, 0, 0, w, h);
          ctx.filter = "none";
        } else {
          // Pixelate via downscale → upscale
          const block = Math.max(2, strength);
          const sw = Math.max(1, Math.round(w / block));
          const sh = Math.max(1, Math.round(h / block));
          const tmp = document.createElement("canvas");
          tmp.width = sw;
          tmp.height = sh;
          const tctx = tmp.getContext("2d")!;
          tctx.imageSmoothingEnabled = false;
          tctx.drawImage(img, 0, 0, sw, sh);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(tmp, 0, 0, sw, sh, 0, 0, w, h);
        }
        const isPng = /png$/i.test(f.type) || /\.png$/i.test(f.name);
        const mime = isPng ? "image/png" : "image/jpeg";
        const ext = isPng ? "png" : "jpg";
        const blob = await new Promise<Blob | null>((res) =>
          canvas.toBlob(res, mime, 0.92),
        );
        if (blob) zip.file(`${baseName(f.name)} (${mode}).${ext}`, blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      downloadBlob(out, `${mode}-images.zip`);
      toast.success(`Processed ${files.length} image${files.length === 1 ? "" : "s"}`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't process those images");
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
        title="Drop images to blur or pixelate"
        hint="Apply Gaussian blur or a chunky pixelation in batch"
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

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mode</p>
          <div className="mt-3 inline-flex rounded-full border border-border bg-background p-1">
            {(["blur", "pixelate"] as Mode[]).map((m) => (
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
            {mode === "blur" ? `Blur radius — ${strength}px` : `Block size — ${strength}px`}
          </label>
          <input
            type="range"
            min={2}
            max={64}
            value={strength}
            onChange={(e) => setStrength(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
          />
        </div>
      </div>

      <ActionBar
        status={mode === "blur" ? "Gaussian blur applied to every image" : "Mosaic pixelation applied"}
        primary={
          <button
            onClick={apply}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Working…" : "Process & download"}
          </button>
        }
      />
    </div>
  );
}
