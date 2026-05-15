import { useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob } from "@/lib/format";
import { Camera, CameraOff, Trash2, ScanLine } from "lucide-react";

type Scan = { id: string; dataUrl: string };
type Filter = "color" | "grayscale" | "bw";

export function ScanTool() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [scans, setScans] = useState<Scan[]>([]);
  const [filter, setFilter] = useState<Filter>("color");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't access the camera. Check browser permissions.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  };

  const applyFilter = (canvas: HTMLCanvasElement, f: Filter) => {
    if (f === "color") return;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    if (f === "grayscale") {
      for (let i = 0; i < d.length; i += 4) {
        const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        d[i] = d[i + 1] = d[i + 2] = g;
      }
    } else {
      // B&W with auto-contrast for document scans
      // Compute histogram
      const hist = new Uint32Array(256);
      for (let i = 0; i < d.length; i += 4) {
        const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        hist[g]++;
      }
      // Otsu's threshold
      const total = canvas.width * canvas.height;
      let sum = 0;
      for (let t = 0; t < 256; t++) sum += t * hist[t];
      let sumB = 0,
        wB = 0,
        max = 0,
        threshold = 127;
      for (let t = 0; t < 256; t++) {
        wB += hist[t];
        if (wB === 0) continue;
        const wF = total - wB;
        if (wF === 0) break;
        sumB += t * hist[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const between = wB * wF * (mB - mF) * (mB - mF);
        if (between > max) {
          max = between;
          threshold = t;
        }
      }
      for (let i = 0; i < d.length; i += 4) {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const v = g > threshold ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    }
    ctx.putImageData(img, 0, 0);
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(v, 0, 0);
    applyFilter(canvas, filter);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setScans((p) => [...p, { id: crypto.randomUUID(), dataUrl }]);
  };

  const importImages = async (files: File[]) => {
    for (const file of files) {
      const bmp = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      applyFilter(canvas, filter);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      setScans((p) => [...p, { id: crypto.randomUUID(), dataUrl }]);
      bmp.close();
    }
  };

  const removeScan = (id: string) => setScans((p) => p.filter((s) => s.id !== id));

  const handleExport = async () => {
    if (scans.length === 0) return;
    setBusy(true);
    try {
      const out = await PDFDocument.create();
      for (const s of scans) {
        const bytes = await fetch(s.dataUrl).then((r) => r.arrayBuffer());
        const img = await out.embedJpg(bytes);
        // A4 page sized to image aspect
        const a4w = 595.28;
        const a4h = 841.89;
        const ar = img.width / img.height;
        let w = a4w,
          h = a4w / ar;
        if (h > a4h) {
          h = a4h;
          w = a4h * ar;
        }
        const page = out.addPage([a4w, a4h]);
        page.drawImage(img, {
          x: (a4w - w) / 2,
          y: (a4h - h) / 2,
          width: w,
          height: h,
        });
      }
      const bytes = await out.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), "scan.pdf");
      toast.success("Scanned PDF ready");
    } catch (err) {
      console.error(err);
      toast.error("Export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="overflow-hidden rounded-3xl border border-border bg-foreground/95 aspect-[4/3] relative grid place-items-center">
          {active ? (
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="text-center">
              <ScanLine className="mx-auto h-10 w-10 text-background/60" />
              <p className="mt-3 font-display text-2xl text-background">Camera off</p>
              <p className="mt-1 text-sm text-background/70">
                Start the camera or import an image to scan.
              </p>
            </div>
          )}
          {active && (
            <button
              onClick={capture}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 grid h-14 w-14 place-items-center rounded-full border-4 border-white bg-white/20 backdrop-blur transition-transform hover:scale-105"
              aria-label="Capture"
            >
              <span className="block h-10 w-10 rounded-full bg-white" />
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Filter
            </span>
            <div className="mt-2 inline-flex rounded-full border border-border bg-background p-1">
              {(["color", "grayscale", "bw"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 text-sm capitalize transition-colors ${
                    filter === f
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "bw" ? "B&W" : f}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              B&W applies Otsu threshold — best for clean documents.
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={active ? stopCamera : startCamera}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              {active ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {active ? "Stop camera" : "Start camera"}
            </button>
            <Dropzone
              accept="image"
              multiple
              onFiles={importImages}
              title="…or drop images"
              hint="JPG / PNG / WebP"
              className="!py-8"
            />
          </div>
        </div>
      </div>

      {scans.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl">Captured pages</h2>
            <span className="text-sm text-muted-foreground">{scans.length} page{scans.length === 1 ? "" : "s"}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {scans.map((s, i) => (
              <div
                key={s.id}
                className="group relative overflow-hidden rounded-xl border border-border bg-surface"
              >
                <img src={s.dataUrl} alt={`Scan ${i + 1}`} className="block w-full" />
                <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-foreground text-xs text-background">
                  {i + 1}
                </span>
                <button
                  onClick={() => removeScan(s.id)}
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/95 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ActionBar
        status={
          scans.length === 0
            ? "Capture pages, then export"
            : `${scans.length} page${scans.length === 1 ? "" : "s"} ready`
        }
        secondary={
          scans.length > 0 && (
            <button
              onClick={() => setScans([])}
              className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )
        }
        primary={
          <button
            onClick={handleExport}
            disabled={busy || scans.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Building…" : "Export PDF"}
          </button>
        }
      />
    </div>
  );
}
