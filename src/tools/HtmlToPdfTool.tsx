import { useState } from "react";
import { toast } from "sonner";
import { Code2, Globe, FileType2 } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob } from "@/lib/format";

type Source = "html" | "url" | "markdown";
type PageSize = "A4" | "Letter";

const PAGE: Record<PageSize, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
};

const SAMPLE_HTML = `<h1>Folio · HTML to PDF</h1>
<p>Paste HTML, type Markdown, or fetch any public URL. Folio renders it inside a sandboxed iframe and prints to a real PDF — no servers involved.</p>
<h2>Things you can do</h2>
<ul>
  <li>Quote articles into a clean PDF</li>
  <li>Archive long-form blog posts</li>
  <li>Print receipts with custom HTML</li>
</ul>`;

export function HtmlToPdfTool() {
  const [source, setSource] = useState<Source>("html");
  const [html, setHtml] = useState(SAMPLE_HTML);
  const [url, setUrl] = useState("");
  const [markdown, setMarkdown] = useState("# Hello Folio\n\nType **Markdown** here.");
  const [size, setSize] = useState<PageSize>("A4");
  const [margin, setMargin] = useState(36);
  const [busy, setBusy] = useState(false);

  const buildHtml = async (): Promise<string> => {
    if (source === "html") return html;
    if (source === "markdown") return mdToHtml(markdown);
    if (!url) throw new Error("Enter a URL");
    // Direct fetch will hit CORS for many sites; use a public read-only proxy.
    const res = await fetch(`https://r.jina.ai/${url}`);
    if (!res.ok) throw new Error("Couldn't fetch that URL");
    const text = await res.text();
    return `<pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:12px;line-height:1.5;">${escapeHtml(
      text
    )}</pre>`;
  };

  const run = async () => {
    setBusy(true);
    try {
      const body = await buildHtml();
      const [pageW, pageH] = PAGE[size];
      // Render in a hidden iframe at the requested width to measure flow height,
      // then paginate by slicing canvas-rendered chunks via foreignObject SVG.
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.left = "-99999px";
      iframe.style.top = "0";
      iframe.style.width = `${pageW - margin * 2}px`;
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument!;
      doc.open();
      doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>
        html,body{margin:0;padding:0;background:#fff;color:#111;font:14px/1.55 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;}
        h1{font-size:24px;margin:.4em 0;}
        h2{font-size:18px;margin:.6em 0 .3em;}
        p{margin:.5em 0;}
        ul,ol{padding-left:1.4em;margin:.4em 0;}
        a{color:#0a66c2;}
        img{max-width:100%;}
        pre,code{font-family:ui-monospace,Menlo,monospace;font-size:12px;}
        pre{background:#f6f6f6;padding:10px;border-radius:6px;overflow:auto;}
        table{border-collapse:collapse;}
        td,th{border:1px solid #ddd;padding:4px 8px;}
      </style></head><body>${body}</body></html>`);
      doc.close();

      // wait for layout & images
      await new Promise((r) => setTimeout(r, 400));
      const totalW = doc.body.scrollWidth;
      const totalH = doc.body.scrollHeight;

      // Render the body using SVG foreignObject -> image -> canvas
      const serializer = new XMLSerializer();
      const cloned = doc.documentElement.cloneNode(true) as HTMLElement;
      const svgStr = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}">
          <foreignObject width="100%" height="100%">
            ${serializer.serializeToString(cloned)}
          </foreignObject>
        </svg>`;
      const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = svgUrl;
      });

      const dpr = 2;
      const fullCanvas = document.createElement("canvas");
      fullCanvas.width = totalW * dpr;
      fullCanvas.height = totalH * dpr;
      const fctx = fullCanvas.getContext("2d", { alpha: false })!;
      fctx.fillStyle = "#fff";
      fctx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
      fctx.scale(dpr, dpr);
      fctx.drawImage(img, 0, 0, totalW, totalH);
      URL.revokeObjectURL(svgUrl);

      const out = await PDFDocument.create();
      const innerW = pageW - margin * 2;
      const innerH = pageH - margin * 2;
      const pxPerPdfPt = totalW / innerW;
      const sliceHpx = innerH * pxPerPdfPt;

      let yPx = 0;
      while (yPx < totalH) {
        const slice = document.createElement("canvas");
        const realH = Math.min(sliceHpx, totalH - yPx);
        slice.width = totalW * dpr;
        slice.height = realH * dpr;
        const sctx = slice.getContext("2d", { alpha: false })!;
        sctx.fillStyle = "#fff";
        sctx.fillRect(0, 0, slice.width, slice.height);
        sctx.drawImage(
          fullCanvas,
          0,
          yPx * dpr,
          totalW * dpr,
          realH * dpr,
          0,
          0,
          totalW * dpr,
          realH * dpr
        );
        const blob: Blob = await new Promise((res) =>
          slice.toBlob((b) => res(b!), "image/jpeg", 0.92)
        );
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const jpg = await out.embedJpg(bytes);
        const page = out.addPage([pageW, pageH]);
        const drawH = (realH / sliceHpx) * innerH;
        page.drawImage(jpg, {
          x: margin,
          y: pageH - margin - drawH,
          width: innerW,
          height: drawH,
        });
        yPx += sliceHpx;
      }

      // Footer with source label
      const font = await out.embedFont(StandardFonts.Helvetica);
      const label =
        source === "url" ? url : source === "markdown" ? "Markdown · Folio" : "HTML · Folio";
      out.getPages().forEach((p, idx) => {
        p.drawText(`${label}  ·  ${idx + 1}/${out.getPageCount()}`, {
          x: margin,
          y: 18,
          size: 9,
          font,
          color: rgb(0.45, 0.45, 0.45),
        });
      });

      const bytes = await out.save();
      iframe.remove();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), "folio-export.pdf");
      toast.success("PDF generated");
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Export failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Source
          </p>
          <div className="mt-3 grid gap-2">
            <SourceBtn active={source === "html"} icon={<Code2 className="h-4 w-4" />} label="HTML" onClick={() => setSource("html")} />
            <SourceBtn active={source === "markdown"} icon={<FileType2 className="h-4 w-4" />} label="Markdown" onClick={() => setSource("markdown")} />
            <SourceBtn active={source === "url"} icon={<Globe className="h-4 w-4" />} label="URL" onClick={() => setSource("url")} />
          </div>

          <p className="mt-6 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Page size
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["A4", "Letter"] as PageSize[]).map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
                  size === s
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background hover:border-border-strong"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <p className="mt-6 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Margin: {margin}pt
          </p>
          <input
            type="range"
            min={12}
            max={96}
            value={margin}
            onChange={(e) => setMargin(Number(e.target.value))}
            className="mt-3 w-full accent-foreground"
          />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          {source === "url" ? (
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">URL</span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article"
                className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Fetched through a public reader proxy (r.jina.ai) so most pages work without
                CORS issues. Output is plain-text rendering of the page contents.
              </p>
            </label>
          ) : (
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {source === "markdown" ? "Markdown" : "HTML"}
              </span>
              <textarea
                value={source === "markdown" ? markdown : html}
                onChange={(e) =>
                  source === "markdown" ? setMarkdown(e.target.value) : setHtml(e.target.value)
                }
                rows={18}
                spellCheck={false}
                className="scrollbar-thin mt-2 w-full rounded-xl border border-border bg-background p-3 font-mono text-xs outline-none focus:border-foreground"
              />
            </label>
          )}
        </div>
      </div>

      <ActionBar
        status={busy ? "Rasterising and paginating…" : `Page: ${size} · margin ${margin}pt`}
        primary={
          <button
            onClick={run}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Building…" : "Generate PDF"}
          </button>
        }
      />
    </div>
  );
}

function SourceBtn({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-foreground hover:border-border-strong"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function mdToHtml(md: string): string {
  // Tiny Markdown subset: headings, bold/italic, lists, links, code, paragraphs
  const esc = (s: string) => escapeHtml(s);
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  let inCode = false;
  let buf: string[] = [];

  const flushPara = () => {
    if (buf.length) {
      const p = buf.join(" ");
      out.push(`<p>${inline(p)}</p>`);
      buf = [];
    }
  };
  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("```")) {
      flushPara();
      if (inCode) {
        out.push("</pre>");
        inCode = false;
      } else {
        out.push("<pre>");
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(esc(raw));
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      flushPara();
      const m = line.match(/^(#{1,6})\s+(.*)/)!;
      const level = m[1].length;
      out.push(`<h${level}>${inline(m[2])}</h${level}>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushPara();
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }
    if (inList && !line.trim()) {
      out.push("</ul>");
      inList = false;
      continue;
    }
    if (!line.trim()) {
      flushPara();
      continue;
    }
    buf.push(line);
  }
  flushPara();
  if (inList) out.push("</ul>");
  if (inCode) out.push("</pre>");
  return out.join("\n");
}
