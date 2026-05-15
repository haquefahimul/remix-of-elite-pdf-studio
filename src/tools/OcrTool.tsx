import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ScanText, FileText } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { FileHeader } from "./SplitTool";
import { pdfjsLib } from "@/lib/pdf-worker";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Lang = "eng" | "fra" | "deu" | "spa" | "ita" | "por";

const LANG_LABEL: Record<Lang, string> = {
  eng: "English",
  fra: "French",
  deu: "German",
  spa: "Spanish",
  ita: "Italian",
  por: "Portuguese",
};

export function OcrTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState(0);
  const [lang, setLang] = useState<Lang>("eng");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [text, setText] = useState<string>("");
  const workerRef = useRef<unknown>(null);

  useEffect(() => {
    if (!file) return;
    file.arrayBuffer().then(async (buf) => {
      try {
        const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
        setPages(pdf.numPages);
        await pdf.destroy();
      } catch {
        toast.error("Couldn't read that PDF.");
      }
    });
  }, [file]);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setProgress(0);
    setText("");
    setStage("Loading OCR engine…");
    try {
      const Tess = await import("tesseract.js");
      const worker = await Tess.createWorker(lang, 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status && typeof m.progress === "number") {
            setStage(m.status);
          }
        },
      });
      workerRef.current = worker;

      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
      const out = await PDFDocument.create();
      const font = await out.embedFont(StandardFonts.Helvetica);

      let combined = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        setStage(`Reading page ${i} of ${pdf.numPages}`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d", { alpha: false })!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({
          canvas,
          canvasContext: ctx,
          viewport,
        } as Parameters<typeof page.render>[0]).promise;

        const dataUrl = canvas.toDataURL("image/png");
        const { data } = await worker.recognize(dataUrl);
        const pageText = data.text || "";
        combined += `\n\n— Page ${i} —\n${pageText}`;

        // Build hidden-text PDF: image on top + invisible text behind for selection
        const jpegBlob: Blob = await new Promise((res) =>
          canvas.toBlob((b) => res(b!), "image/jpeg", 0.9)
        );
        const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
        const img = await out.embedJpg(jpegBytes);
        const w = viewport.width / 2;
        const h = viewport.height / 2;
        const pageOut = out.addPage([w, h]);

        // Invisible text layer (rendering mode 3 = neither stroke nor fill)
        const lines = pageText.split(/\n+/).filter(Boolean);
        let y = h - 12;
        for (const ln of lines) {
          if (y < 8) break;
          try {
            pageOut.drawText(ln.slice(0, 500), {
              x: 6,
              y,
              size: 8,
              font,
              color: rgb(1, 1, 1),
              opacity: 0.001,
            });
          } catch {
            /* skip undrawable glyphs */
          }
          y -= 10;
        }
        // Visible page image on top
        pageOut.drawImage(img, { x: 0, y: 0, width: w, height: h });

        page.cleanup();
        setProgress(Math.round((i / pdf.numPages) * 100));
      }

      await pdf.destroy();
      await worker.terminate();
      workerRef.current = null;

      setText(combined.trim());
      const bytes = await out.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)} (searchable).pdf`
      );
      toast.success("Searchable PDF ready");
    } catch (err) {
      console.error(err);
      toast.error("OCR failed.");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const downloadTxt = () => {
    if (!file || !text) return;
    downloadBlob(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
      `${baseName(file.name)}.txt`
    );
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a scanned PDF"
        hint="We'll recognize text on every page — runs fully on your device"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Document
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <Row k="Pages" v={pages ? String(pages) : "…"} />
            <Row k="Size" v={formatBytes(file.size)} />
          </dl>

          <p className="mt-6 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Language
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                disabled={busy}
                className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
                  lang === l
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-foreground hover:border-border-strong"
                }`}
              >
                {LANG_LABEL[l]}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-tool-ocr/10">
              <ScanText className="h-5 w-5 text-tool-ocr" />
            </div>
            <div>
              <p className="font-display text-2xl tracking-tight text-foreground">
                {busy ? "Recognising text…" : text ? "Recognised text" : "Ready when you are"}
              </p>
              <p className="text-sm text-muted-foreground">
                {busy ? `${stage} · ${progress}%` : "Outputs a searchable PDF + plain text."}
              </p>
            </div>
          </div>

          {busy ? (
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-accent">
              <div
                className="h-full bg-foreground transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}

          {text ? (
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Extracted text
                </p>
                <button
                  onClick={downloadTxt}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:border-border-strong"
                >
                  <FileText className="h-3.5 w-3.5" /> Download .txt
                </button>
              </div>
              <pre className="scrollbar-thin mt-3 max-h-80 overflow-auto rounded-xl border border-border bg-background p-4 text-xs leading-relaxed whitespace-pre-wrap">
                {text}
              </pre>
            </div>
          ) : null}
        </div>
      </div>

      <ActionBar
        status={busy ? `${stage}` : "First run downloads ~10 MB language model — cached after."}
        primary={
          <button
            onClick={run}
            disabled={busy || !pages}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Working…" : "Run OCR"}
          </button>
        }
      />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className="truncate text-right text-foreground">{v}</dd>
    </div>
  );
}
