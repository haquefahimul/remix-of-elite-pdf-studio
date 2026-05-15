import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { ModeChip } from "./SplitTool";
import { downloadBlob, formatBytes, baseName } from "@/lib/format";

type Rotation = 0 | 90 | 180 | 270;
type Flip = "none" | "h" | "v";
type Output = "jpeg" | "png" | "webp";

export function ImageRotateTool() {
  const [items, setItems] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [rot, setRot] = useState<Rotation>(90);
  const [flip, setFlip] = useState<Flip>("none");
  const [output, setOutput] = useState<Output>("jpeg");
  const [busy, setBusy] = useState(false);

  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p)), [previews]);

  const addFiles = (fs: File[]) => {
    setItems((prev) => [...prev, ...fs]);
    setPreviews((prev) => [...prev, ...fs.map((f) => URL.createObjectURL(f))]);
  };

  const transform = async (file: File): Promise<Blob> => {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const swap = rot === 90 || rot === 270;
      const cw = swap ? ih : iw;
      const ch = swap ? iw : ih;
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d", { alpha: output === "png" })!;
      if (output !== "png") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cw, ch);
      }
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.scale(flip === "h" ? -1 : 1, flip === "v" ? -1 : 1);
      ctx.drawImage(img, -iw / 2, -ih / 2);
      const mime = output === "jpeg" ? "image/jpeg" : output === "png" ? "image/png" : "image/webp";
      return await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), mime, output === "png" ? undefined : 0.92),
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const run = async () => {
    if (items.length === 0) return;
    setBusy(true);
    try {
      const ext = output === "jpeg" ? "jpg" : output;
      if (items.length === 1) {
        const blob = await transform(items[0]);
        downloadBlob(blob, `${baseName(items[0].name)} (rotated).${ext}`);
      } else {
        const mod = await import("jszip");
        const zip = new mod.default();
        for (const f of items) {
          const blob = await transform(f);
          zip.file(`${baseName(f.name)}.${ext}`, blob);
        }
        const out = await zip.generateAsync({ type: "blob" });
        downloadBlob(out, `images-rotated.zip`);
      }
      toast.success("Done");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't transform images");
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <Dropzone
        accept="image"
        onFiles={addFiles}
        title="Drop images to rotate or flip"
        hint="Bulk rotate 90/180/270° and mirror horizontally or vertically"
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {items.length} image{items.length === 1 ? "" : "s"} · {formatBytes(items.reduce((a, b) => a + b.size, 0))}
        </p>
        <button
          onClick={() => {
            previews.forEach((p) => URL.revokeObjectURL(p));
            setItems([]);
            setPreviews([]);
          }}
          className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Clear
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Rotation</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {([0, 90, 180, 270] as Rotation[]).map((r) => (
              <ModeChip key={r} active={rot === r} onClick={() => setRot(r)}>
                {r}°
              </ModeChip>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Flip</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ModeChip active={flip === "none"} onClick={() => setFlip("none")}>None</ModeChip>
            <ModeChip active={flip === "h"} onClick={() => setFlip("h")}>Horizontal</ModeChip>
            <ModeChip active={flip === "v"} onClick={() => setFlip("v")}>Vertical</ModeChip>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Output</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ModeChip active={output === "jpeg"} onClick={() => setOutput("jpeg")}>JPG</ModeChip>
            <ModeChip active={output === "png"} onClick={() => setOutput("png")}>PNG</ModeChip>
            <ModeChip active={output === "webp"} onClick={() => setOutput("webp")}>WebP</ModeChip>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {previews.map((src, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface">
            <img
              src={src}
              alt=""
              className="block aspect-square w-full object-cover transition-transform"
              style={{
                transform: `rotate(${rot}deg) scale(${flip === "h" ? -1 : 1}, ${flip === "v" ? -1 : 1})`,
              }}
            />
          </div>
        ))}
      </div>

      <ActionBar
        status={`${rot}° · ${flip === "none" ? "no flip" : flip === "h" ? "flipped H" : "flipped V"}`}
        primary={
          <button
            onClick={run}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Working…" : "Apply & download"}
          </button>
        }
      />
    </div>
  );
}
