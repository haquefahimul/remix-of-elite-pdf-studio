import { useState } from "react";
import { toast } from "sonner";
import { GitCompareArrows, X } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { renderThumbnails, type PageThumb } from "@/lib/pdf-render";
import { formatBytes } from "@/lib/format";

type Loaded = {
  file: File;
  thumbs: PageThumb[];
};

export function CompareTool() {
  const [a, setA] = useState<Loaded | null>(null);
  const [b, setB] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState<"a" | "b" | null>(null);
  const [highlight, setHighlight] = useState(true);
  const [threshold, setThreshold] = useState(20);
  const [diffs, setDiffs] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  const load = async (which: "a" | "b", file: File) => {
    setLoading(which);
    try {
      const buf = await file.arrayBuffer();
      const thumbs = await renderThumbnails(buf, { maxWidth: 480, quality: 0.85 });
      const loaded = { file, thumbs };
      if (which === "a") setA(loaded);
      else setB(loaded);
      setDiffs({});
    } catch {
      toast.error("Couldn't read that PDF.");
    } finally {
      setLoading(null);
    }
  };

  const compute = async () => {
    if (!a || !b) return;
    setBusy(true);
    try {
      const out: Record<number, string> = {};
      const total = Math.max(a.thumbs.length, b.thumbs.length);
      for (let i = 0; i < total; i++) {
        const left = a.thumbs[i];
        const right = b.thumbs[i];
        if (!left || !right) continue;
        const url = await diffImages(left.dataUrl, right.dataUrl, threshold);
        if (url) out[i] = url;
      }
      setDiffs(out);
      toast.success(`Compared ${total} pages`);
    } catch (err) {
      console.error(err);
      toast.error("Compare failed.");
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.max(a?.thumbs.length ?? 0, b?.thumbs.length ?? 0);

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <Slot
          label="Original"
          loaded={a}
          loading={loading === "a"}
          onPick={(f) => load("a", f)}
          onClear={() => setA(null)}
        />
        <Slot
          label="Revised"
          loaded={b}
          loading={loading === "b"}
          onPick={(f) => load("b", f)}
          onClear={() => setB(null)}
        />
      </div>

      {a && b ? (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-tool-compare/10">
              <GitCompareArrows className="h-5 w-5 text-tool-compare" />
            </div>
            <div className="flex-1 min-w-[12rem]">
              <p className="font-display text-xl tracking-tight">Visual diff</p>
              <p className="text-sm text-muted-foreground">
                {totalPages} page pairs · sensitivity {threshold}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={highlight}
                onChange={(e) => setHighlight(e.target.checked)}
                className="h-4 w-4"
              />
              Show diff overlay
            </label>
            <label className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Sensitivity</span>
              <input
                type="range"
                min={5}
                max={80}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-32 accent-foreground"
              />
            </label>
          </div>
        </div>
      ) : null}

      {a && b ? (
        <div className="mt-6 grid gap-6">
          {Array.from({ length: totalPages }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Page {i + 1}</span>
                <span>
                  {a.thumbs[i] && b.thumbs[i]
                    ? diffs[i]
                      ? "Differences detected"
                      : busy
                        ? "Comparing…"
                        : "Run compare to inspect"
                    : !a.thumbs[i]
                      ? "Missing in Original"
                      : "Missing in Revised"}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Pane label="Original" src={a.thumbs[i]?.dataUrl} />
                <Pane label="Revised" src={b.thumbs[i]?.dataUrl} />
                <Pane
                  label="Diff"
                  src={diffs[i]}
                  empty={!diffs[i] ? "Run compare" : undefined}
                  overlay={highlight}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <ActionBar
        status={
          a && b ? `Ready to compare ${totalPages} pages` : "Drop two PDFs to start a visual diff"
        }
        primary={
          <button
            onClick={compute}
            disabled={!a || !b || busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Comparing…" : "Run comparison"}
          </button>
        }
      />
    </div>
  );
}

function Slot({
  label,
  loaded,
  loading,
  onPick,
  onClear,
}: {
  label: string;
  loaded: Loaded | null;
  loading: boolean;
  onPick: (f: File) => void;
  onClear: () => void;
}) {
  if (!loaded) {
    return (
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Dropzone
          accept="pdf"
          onFiles={(f) => onPick(f[0])}
          title={loading ? "Reading…" : `Drop ${label.toLowerCase()} PDF`}
          hint="Single PDF"
        />
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 truncate text-sm font-medium text-foreground">{loaded.file.name}</p>
          <p className="text-xs text-muted-foreground">
            {loaded.thumbs.length} pages · {formatBytes(loaded.file.size)}
          </p>
        </div>
        <button
          onClick={onClear}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Pane({
  label,
  src,
  empty,
  overlay,
}: {
  label: string;
  src?: string;
  empty?: string;
  overlay?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-background">
        {src ? (
          <img
            src={src}
            alt={label}
            className="h-full w-full object-contain"
            style={overlay && label === "Diff" ? { mixBlendMode: "normal" } : undefined}
          />
        ) : (
          <div className="grid h-full place-items-center text-xs text-muted-foreground">
            {empty ?? "—"}
          </div>
        )}
      </div>
    </div>
  );
}

async function diffImages(a: string, b: string, threshold: number): Promise<string | null> {
  const [imgA, imgB] = await Promise.all([loadImg(a), loadImg(b)]);
  const w = Math.max(imgA.width, imgB.width);
  const h = Math.max(imgA.height, imgB.height);
  const ca = drawTo(imgA, w, h);
  const cb = drawTo(imgB, w, h);
  const da = ca.getContext("2d")!.getImageData(0, 0, w, h);
  const db = cb.getContext("2d")!.getImageData(0, 0, w, h);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d")!;
  octx.drawImage(ca, 0, 0);
  const od = octx.getImageData(0, 0, w, h);
  let changed = 0;
  for (let i = 0; i < da.data.length; i += 4) {
    const dr = Math.abs(da.data[i] - db.data[i]);
    const dg = Math.abs(da.data[i + 1] - db.data[i + 1]);
    const dbb = Math.abs(da.data[i + 2] - db.data[i + 2]);
    const delta = (dr + dg + dbb) / 3;
    if (delta > threshold) {
      od.data[i] = 220;
      od.data[i + 1] = 30;
      od.data[i + 2] = 60;
      od.data[i + 3] = 255;
      changed++;
    } else {
      od.data[i] = 240;
      od.data[i + 1] = 240;
      od.data[i + 2] = 240;
    }
  }
  if (changed === 0) return null;
  octx.putImageData(od, 0, 0);
  return out.toDataURL("image/png");
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function drawTo(img: HTMLImageElement, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { alpha: false })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}
