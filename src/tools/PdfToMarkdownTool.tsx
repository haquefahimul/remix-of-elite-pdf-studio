import { useState } from "react";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader, ModeChip } from "./SplitTool";
import { downloadBlob, baseName } from "@/lib/format";
import { pdfjsLib } from "@/lib/pdf-worker";

type Item = { str: string; x: number; y: number; size: number; bold: boolean };

async function extractItems(file: File): Promise<Item[][]> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages: Item[][] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const items: Item[] = [];
    for (const it of tc.items as Array<{
      str: string;
      transform: number[];
      height: number;
      fontName?: string;
    }>) {
      if (!it.str) continue;
      const fontName = (it.fontName ?? "").toLowerCase();
      items.push({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        size: it.height || it.transform[0] || 12,
        bold: /bold|black|heavy|semibold/.test(fontName),
      });
    }
    pages.push(items);
    page.cleanup();
  }
  await pdf.destroy();
  return pages;
}

function buildMarkdown(pages: Item[][], pageBreaks: boolean): string {
  // Determine size buckets for headings: top 5%, next 10%, next 15%
  const all = pages.flat();
  if (all.length === 0) return "";
  const sizes = all.map((i) => i.size).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)] || 12;

  const out: string[] = [];
  pages.forEach((items, pageIdx) => {
    if (pageBreaks && pageIdx > 0) out.push("\n---\n");
    // Group lines by Y
    const map = new Map<number, Item[]>();
    for (const it of items) {
      const y = Math.round(it.y);
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(it);
    }
    const ys = Array.from(map.keys()).sort((a, b) => b - a);
    let prevY: number | null = null;
    for (const y of ys) {
      const line = map.get(y)!.sort((a, b) => a.x - b.x);
      const text = line
        .map((i) => i.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;
      const lineSize = line.reduce((s, i) => s + i.size, 0) / line.length;
      const isBold = line.every((i) => i.bold);
      const ratio = lineSize / median;

      let prefix = "";
      if (ratio >= 1.8) prefix = "# ";
      else if (ratio >= 1.45) prefix = "## ";
      else if (ratio >= 1.2) prefix = "### ";
      else if (isBold && text.length < 80) prefix = "#### ";

      // Detect bullets
      let body = text;
      if (/^[•·●▪◦]\s+/.test(body)) {
        body = body.replace(/^[•·●▪◦]\s+/, "");
        prefix = "- ";
      } else if (/^\d+[\.\)]\s+/.test(body)) {
        const m = body.match(/^(\d+)[\.\)]\s+(.*)$/);
        if (m) {
          body = m[2];
          prefix = `${m[1]}. `;
        }
      }

      // Paragraph break if vertical gap is large
      if (prevY !== null && Math.abs(prevY - y) > median * 1.6 && !prefix) {
        out.push("");
      }
      out.push(prefix + body);
      prevY = y;
    }
    out.push("");
  });

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function PdfToMarkdownTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [pageBreaks, setPageBreaks] = useState(true);

  const handleConvert = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const pages = await extractItems(file);
      const md = buildMarkdown(pages, pageBreaks);
      if (!md.trim()) {
        toast.error("No text found. This PDF may be scanned — try OCR first.");
        return;
      }
      downloadBlob(new Blob([md], { type: "text/markdown" }), `${baseName(file.name)}.md`);
      toast.success("Markdown ready");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't convert this PDF");
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
        hint="Headings, lists, and paragraphs detected automatically"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Page breaks
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ModeChip active={pageBreaks} onClick={() => setPageBreaks(true)}>
            Insert <code className="ml-1">---</code> per page
          </ModeChip>
          <ModeChip active={!pageBreaks} onClick={() => setPageBreaks(false)}>
            Continuous flow
          </ModeChip>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Folio infers heading levels from font size and bold weight, and detects bulleted and
          numbered lists. Works best on PDFs with selectable text.
        </p>
      </div>

      <ActionBar
        status="Exports a clean .md file"
        primary={
          <button
            onClick={handleConvert}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Converting…" : "Convert & download .md"}
          </button>
        }
      />
    </div>
  );
}
