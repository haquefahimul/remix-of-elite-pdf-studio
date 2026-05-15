import { useState } from "react";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { ModeChip } from "./SplitTool";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { pdfjsLib } from "@/lib/pdf-worker";

type Layout = "flow" | "preserve";

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function PdfToHtmlTool() {
  const [file, setFile] = useState<File | null>(null);
  const [layout, setLayout] = useState<Layout>("flow");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setProgress({ done: 0, total: 1 });
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
      const total = pdf.numPages;
      setProgress({ done: 0, total });

      const meta = (await pdf.getMetadata().catch(() => ({ info: {} }))) as { info?: { Title?: string } };
      const title = (meta.info?.Title || baseName(file.name)).toString();

      const sections: string[] = [];
      for (let i = 1; i <= total; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        let html = "";
        if (layout === "preserve") {
          // Preserve line breaks based on y-coords
          const lines: { y: number; text: string }[] = [];
          for (const it of tc.items as Array<{ str: string; transform: number[]; hasEOL?: boolean }>) {
            if (!("str" in it)) continue;
            const y = Math.round(it.transform[5]);
            const last = lines[lines.length - 1];
            if (last && Math.abs(last.y - y) < 2) last.text += it.str;
            else lines.push({ y, text: it.str });
          }
          lines.sort((a, b) => b.y - a.y);
          html = lines.map((l) => `<p>${escape(l.text) || "&nbsp;"}</p>`).join("\n");
        } else {
          const text = (tc.items as Array<{ str: string; hasEOL?: boolean }>)
            .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : ""))
            .join("")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
          html = text
            .split(/\n{2,}/)
            .map((p) => `<p>${escape(p).replace(/\n/g, "<br/>")}</p>`)
            .join("\n");
        }
        sections.push(`<section data-page="${i}"><h2>Page ${i}</h2>\n${html}\n</section>`);
        page.cleanup();
        setProgress({ done: i, total });
      }
      await pdf.destroy();

      const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escape(title)}</title>
<style>
  :root{color-scheme:light dark}
  body{font:16px/1.6 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:2.5rem auto;padding:0 1.25rem;color:#111}
  h1{font-size:2rem;letter-spacing:-.01em;margin:0 0 1.5rem}
  h2{font-size:.85rem;text-transform:uppercase;letter-spacing:.08em;color:#888;margin:2.5rem 0 .75rem;border-top:1px solid #eee;padding-top:1.25rem}
  p{margin:0 0 .75rem;white-space:pre-wrap}
  @media(prefers-color-scheme:dark){body{color:#eee;background:#111}h2{color:#888;border-color:#222}}
</style>
</head>
<body>
<h1>${escape(title)}</h1>
${sections.join("\n")}
</body>
</html>`;
      downloadBlob(new Blob([doc], { type: "text/html" }), `${baseName(file.name)}.html`);
      toast.success("HTML saved");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't convert that PDF");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(fs) => setFile(fs[0])}
        title="Drop a PDF to export as HTML"
        hint="Choose flow or line-preserving layout — opens in any browser"
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <p className="text-sm">
          <span className="font-medium">{file.name}</span>{" "}
          <span className="text-muted-foreground">· {formatBytes(file.size)}</span>
        </p>
        <button
          onClick={() => setFile(null)}
          className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Change
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Layout</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ModeChip active={layout === "flow"} onClick={() => setLayout("flow")}>Flowing paragraphs</ModeChip>
          <ModeChip active={layout === "preserve"} onClick={() => setLayout("preserve")}>Preserve lines</ModeChip>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Flow merges text into clean paragraphs. Preserve keeps each visual line as its own paragraph — useful for
          poetry, code, and tables.
        </p>
      </div>

      <ActionBar
        status={progress ? `Page ${progress.done} of ${progress.total}` : "Ready"}
        primary={
          <button
            onClick={convert}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Converting…" : "Export HTML"}
          </button>
        }
      />
    </div>
  );
}
