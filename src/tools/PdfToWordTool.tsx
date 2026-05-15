import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { FileHeader } from "./SplitTool";
import { pdfjsLib } from "@/lib/pdf-worker";

type Mode = "flow" | "lines";

export function PdfToWordTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState(0);
  const [mode, setMode] = useState<Mode>("flow");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

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
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;

      const docx = await import("docx");
      const { Document, Packer, Paragraph, TextRun, PageBreak, HeadingLevel } = docx;

      const pageParagraphs: InstanceType<typeof Paragraph>[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();

        pageParagraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun({ text: `Page ${i}`, bold: true })],
          })
        );

        if (mode === "lines") {
          // Group items by their y-coordinate (rounded) to preserve layout lines
          const lineMap = new Map<number, string[]>();
          for (const item of tc.items as Array<{ str: string; transform: number[] }>) {
            const y = Math.round(item.transform[5]);
            const arr = lineMap.get(y) ?? [];
            arr.push(item.str);
            lineMap.set(y, arr);
          }
          const ys = [...lineMap.keys()].sort((a, b) => b - a);
          for (const y of ys) {
            const text = (lineMap.get(y) ?? []).join(" ").replace(/\s+/g, " ").trim();
            if (text) {
              pageParagraphs.push(new Paragraph({ children: [new TextRun(text)] }));
            }
          }
        } else {
          // Flow mode — concatenate items, break paragraphs on EOL hints
          let para = "";
          for (const item of tc.items as Array<{ str: string; hasEOL?: boolean }>) {
            para += item.str;
            if (item.hasEOL) {
              const t = para.trim();
              if (t) pageParagraphs.push(new Paragraph({ children: [new TextRun(t)] }));
              para = "";
            } else {
              para += " ";
            }
          }
          if (para.trim()) {
            pageParagraphs.push(new Paragraph({ children: [new TextRun(para.trim())] }));
          }
        }

        if (i < pdf.numPages) {
          pageParagraphs.push(new Paragraph({ children: [new PageBreak()] }));
        }

        page.cleanup();
        setProgress(Math.round((i / pdf.numPages) * 100));
      }

      await pdf.destroy();

      const doc = new Document({
        creator: "Folio",
        title: baseName(file.name),
        sections: [{ children: pageParagraphs }],
      });
      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `${baseName(file.name)}.docx`);
      toast.success("Word document ready");
    } catch (err) {
      console.error(err);
      toast.error("Conversion failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to convert"
        hint="Exports a real .docx with selectable text"
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
            <Row k="Output" v=".docx (Word)" />
          </dl>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-tool-pdf-word/10">
              <FileText className="h-5 w-5 text-tool-pdf-word" />
            </div>
            <div>
              <p className="font-display text-2xl tracking-tight text-foreground">
                Conversion mode
              </p>
              <p className="text-sm text-muted-foreground">
                Pick how you want the text laid out in Word.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ModeCard
              active={mode === "flow"}
              title="Flow"
              desc="Reads paragraphs naturally, ideal for articles and reports."
              onClick={() => setMode("flow")}
            />
            <ModeCard
              active={mode === "lines"}
              title="Preserve lines"
              desc="Keeps line breaks as they appear — better for forms & receipts."
              onClick={() => setMode("lines")}
            />
          </div>

          {busy ? (
            <div className="mt-5">
              <p className="text-xs text-muted-foreground">Working… {progress}%</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-accent">
                <div className="h-full bg-foreground transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}

          <p className="mt-5 rounded-xl bg-accent/60 px-3 py-2 text-xs text-muted-foreground">
            Text is extracted directly from the PDF text layer. Scanned PDFs without text need
            OCR first — try the OCR tool.
          </p>
        </div>
      </div>

      <ActionBar
        status={busy ? "Building Word document…" : "Ready"}
        primary={
          <button
            onClick={run}
            disabled={busy || !pages}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Converting…" : "Convert to Word"}
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

function ModeCard({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-all ${
        active
          ? "border-foreground bg-foreground/5"
          : "border-border bg-background hover:border-border-strong"
      }`}
    >
      <p className="font-display text-lg tracking-tight text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</p>
    </button>
  );
}
