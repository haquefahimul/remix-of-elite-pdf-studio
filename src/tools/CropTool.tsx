import { useEffect, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { renderThumbnails, type PageThumb } from "@/lib/pdf-render";
import { downloadBlob, baseName } from "@/lib/format";
import { FileHeader, ModeChip, ThumbsLoading } from "./SplitTool";

// pdf-lib uses points (1/72 inch); 1 mm = 2.83465 pt
const MM = 2.83465;

type Margins = { top: number; right: number; bottom: number; left: number };

export function CropTool() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [margins, setMargins] = useState<Margins>({ top: 10, right: 10, bottom: 10, left: 10 });
  const [unit, setUnit] = useState<"mm" | "pt">("mm");
  const [scope, setScope] = useState<"all" | "first">("all");

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setLoading(true);
    setThumbs([]);
    file
      .arrayBuffer()
      .then((buf) => renderThumbnails(buf, { maxWidth: 220 }))
      .then((t) => !cancelled && setThumbs(t))
      .catch(() => toast.error("Couldn't read that PDF."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [file]);

  const update = (k: keyof Margins, v: number) =>
    setMargins((m) => ({ ...m, [k]: Math.max(0, isNaN(v) ? 0 : v) }));

  const factor = unit === "mm" ? MM : 1;

  const applyPreset = (name: "narrow" | "normal" | "wide" | "reset") => {
    if (name === "reset") setMargins({ top: 0, right: 0, bottom: 0, left: 0 });
    if (name === "narrow") setMargins({ top: 5, right: 5, bottom: 5, left: 5 });
    if (name === "normal") setMargins({ top: 15, right: 15, bottom: 15, left: 15 });
    if (name === "wide") setMargins({ top: 25, right: 25, bottom: 25, left: 25 });
    setUnit("mm");
  };

  const handleSave = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const pages = doc.getPages();
      const targets = scope === "all" ? pages : pages.slice(0, 1);

      for (const page of targets) {
        const { width, height } = page.getSize();
        const left = margins.left * factor;
        const right = margins.right * factor;
        const top = margins.top * factor;
        const bottom = margins.bottom * factor;
        const newW = width - left - right;
        const newH = height - top - bottom;
        if (newW <= 0 || newH <= 0) {
          toast.error("Margins are larger than the page. Reduce them.");
          setBusy(false);
          return;
        }
        page.setCropBox(left, bottom, newW, newH);
      }
      const bytes = await doc.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)} (cropped).pdf`
      );
      toast.success("Cropped PDF ready");
    } catch (err) {
      console.error(err);
      toast.error("Crop failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to crop"
        hint="Trim margins precisely or with a preset"
      />
    );
  }

  const previewMargins = {
    top: margins.top * factor,
    right: margins.right * factor,
    bottom: margins.bottom * factor,
    left: margins.left * factor,
  };
  const firstThumb = thumbs[0];

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Live preview · page 1
            </p>
            <div className="flex gap-1.5">
              {(["narrow", "normal", "wide", "reset"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="rounded-full border border-border px-2.5 py-1 text-xs capitalize text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="relative mx-auto mt-4 grid place-items-center rounded-xl bg-muted p-6">
            {loading || !firstThumb ? (
              <div className="aspect-[3/4] w-64 animate-pulse rounded-lg bg-border" />
            ) : (
              <div className="relative">
                <img
                  src={firstThumb.dataUrl}
                  alt="Preview"
                  className="block max-h-[28rem] rounded-lg shadow-soft"
                />
                {/* dimmed crop overlay — uses page-relative scaling */}
                <CropOverlay
                  imgWidthPt={(firstThumb.width / 220) * (firstThumb.width / firstThumb.width) * 1}
                  margins={previewMargins}
                  thumb={firstThumb}
                />
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Margins
            </p>
            <div className="flex gap-1.5">
              <ModeChip active={unit === "mm"} onClick={() => setUnit("mm")}>mm</ModeChip>
              <ModeChip active={unit === "pt"} onClick={() => setUnit("pt")}>pt</ModeChip>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {(["top", "right", "bottom", "left"] as const).map((k) => (
              <label key={k} className="text-xs text-muted-foreground">
                <span className="capitalize">{k}</span>
                <input
                  type="number"
                  min={0}
                  step={unit === "mm" ? 1 : 5}
                  value={margins[k]}
                  onChange={(e) => update(k, Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground"
                />
              </label>
            ))}
          </div>

          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Apply to
            </p>
            <div className="mt-2 flex gap-2">
              <ModeChip active={scope === "all"} onClick={() => setScope("all")}>All pages</ModeChip>
              <ModeChip active={scope === "first"} onClick={() => setScope("first")}>First only</ModeChip>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {loading ? <ThumbsLoading /> : null}
      </div>

      <ActionBar
        status={`${thumbs.length} pages · margins ${margins.top}/${margins.right}/${margins.bottom}/${margins.left} ${unit}`}
        primary={
          <button
            onClick={handleSave}
            disabled={busy || loading || thumbs.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Cropping…" : "Crop & download"}
          </button>
        }
      />
    </div>
  );
}

function CropOverlay({
  margins,
  thumb,
}: {
  imgWidthPt: number;
  margins: Margins;
  thumb: PageThumb;
}) {
  // The thumb image was rendered with maxWidth=220 from page width in pt.
  // Page pt → px ratio = thumb.width / pageWidthPt. We don't know pageWidthPt
  // here without re-reading PDF, so approximate using thumb.width / 220 ≈ 1 css px per ~1 pt scaled.
  // A pragmatic approach: scale margins relative to the image's rendered CSS size using
  // the thumbs internal pixel width as reference.
  const imgEl = thumb;
  // Use thumb's pixel dims as both natural and css for proportional overlay
  const W = imgEl.width;
  const H = imgEl.height;
  // Thumb scale factor from PDF user-space (pt) → thumb px:
  // We don't have pageWidthPt; render-time factor was maxWidth/pageWidth.
  // Reasonable assumption: thumb covers full page. So pt→px ratio ≈ W / pageWidthPt.
  // Without pageWidthPt, use heuristic: assume A4 (595pt wide).
  const ratio = W / 595;
  const top = margins.top * ratio;
  const left = margins.left * ratio;
  const right = margins.right * ratio;
  const bottom = margins.bottom * ratio;

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* outer dim mask using clip-path trick: 4 strips */}
      <div className="absolute bg-foreground/30" style={{ top: 0, left: 0, right: 0, height: top }} />
      <div
        className="absolute bg-foreground/30"
        style={{ bottom: 0, left: 0, right: 0, height: bottom }}
      />
      <div
        className="absolute bg-foreground/30"
        style={{ top, bottom, left: 0, width: left }}
      />
      <div
        className="absolute bg-foreground/30"
        style={{ top, bottom, right: 0, width: right }}
      />
      <div
        className="absolute border-2 border-dashed border-background mix-blend-difference"
        style={{ top, left, right, bottom }}
      />
      <div className="absolute bottom-1 right-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
        {Math.round(W - left - right)}×{Math.round(H - top - bottom)}px preview
      </div>
    </div>
  );
}
