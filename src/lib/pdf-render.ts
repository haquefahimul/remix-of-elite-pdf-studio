import { pdfjsLib } from "./pdf-worker";

export type PageThumb = {
  pageIndex: number; // 0-based
  dataUrl: string;
  width: number;
  height: number;
};

/**
 * Render every page of a PDF (from a binary buffer) to small JPEG thumbnails.
 */
export async function renderThumbnails(
  data: ArrayBuffer,
  options: {
    maxWidth?: number;
    quality?: number;
    password?: string;
    onProgress?: (done: number, total: number) => void;
  } = {}
): Promise<PageThumb[]> {
  const { maxWidth = 220, quality = 0.7, password, onProgress } = options;

  const buf = data.slice(0);
  const pdf = await pdfjsLib.getDocument({ data: buf, password }).promise;
  const thumbs: PageThumb[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const scale = maxWidth / viewport.width;
    const scaled = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(scaled.width);
    canvas.height = Math.ceil(scaled.height);
    const ctx = canvas.getContext("2d", { alpha: false })!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: ctx, viewport: scaled } as Parameters<typeof page.render>[0])
      .promise;

    thumbs.push({
      pageIndex: i - 1,
      dataUrl: canvas.toDataURL("image/jpeg", quality),
      width: canvas.width,
      height: canvas.height,
    });
    page.cleanup();
    onProgress?.(i, pdf.numPages);
  }

  await pdf.destroy();
  return thumbs;
}

/**
 * Render every page to image blobs at full resolution. Supports JPG and PNG.
 */
export async function renderPagesAsImages(
  data: ArrayBuffer,
  options: {
    scale?: number;
    quality?: number;
    format?: "image/jpeg" | "image/png";
    grayscale?: boolean;
    password?: string;
    onProgress?: (done: number, total: number) => void;
  } = {}
): Promise<Blob[]> {
  const {
    scale = 2,
    quality = 0.92,
    format = "image/jpeg",
    grayscale = false,
    password,
    onProgress,
  } = options;
  const buf = data.slice(0);
  const pdf = await pdfjsLib.getDocument({ data: buf, password }).promise;
  const blobs: Blob[] = [];
  const isPng = format === "image/png";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d", { alpha: isPng })!;
    if (!isPng) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    await page.render({ canvas, canvasContext: ctx, viewport } as Parameters<typeof page.render>[0])
      .promise;

    if (grayscale) {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = img.data;
      for (let p = 0; p < d.length; p += 4) {
        const g = Math.round(0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]);
        d[p] = d[p + 1] = d[p + 2] = g;
      }
      ctx.putImageData(img, 0, 0);
    }

    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b!), format, isPng ? undefined : quality)
    );
    blobs.push(blob);
    page.cleanup();
    onProgress?.(i, pdf.numPages);
  }

  await pdf.destroy();
  return blobs;
}

/** Backwards-compatible alias used by existing tools. */
export const renderPagesAsJpegs = (
  data: ArrayBuffer,
  options: { scale?: number; quality?: number; onProgress?: (done: number, total: number) => void } = {}
) => renderPagesAsImages(data, { ...options, format: "image/jpeg" });
