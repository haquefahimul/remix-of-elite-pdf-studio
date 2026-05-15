import { useState } from "react";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader, ModeChip } from "./SplitTool";
import { pdfjsLib } from "@/lib/pdf-worker";
import { downloadBlob, baseName } from "@/lib/format";

type Layout = "flow" | "preserve";

export function PdfToTextTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [layout, setLayout] = useState<Layout>("flow");
  const [includeBreaks, setIncludeBreaks] = useState(true);
  const [preview, setPreview] = useState<string>("");

  const extract = async (): Promise<string> => {
    if (!file) return "";
    const buf = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buf }).promise;
    const out: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      type Item = { str: string; transform: number[]; hasEOL?: boolean; width: number };
      const items = content.items as Item[];

      let pageText = "";
      if (layout === "flow") {
        // Concatenate, respect explicit EOLs.
        const parts: string[] = [];
        for (const it of items) {
          parts.push(it.str);
          if (it.hasEOL) parts.push("\n");
        }
        pageText = parts.join("");
        // Collapse 3+ newlines and stray spaces
        pageText = pageText.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      } else {
        // Preserve lines: cluster items by Y coordinate, sort each row by X, join with spaces.
        const rows = new Map<number, Item[]>();
        for (const it of items) {
          const y = Math.round(it.transform[5]);
          // Snap to nearest 4-pt bucket so micro-jitter doesn't split rows.
          const key = Math.round(y / 4) * 4;
          const list = rows.get(key) ?? [];
          list.push(it);
          rows.set(key, list);
        }
        const sortedKeys = Array.from(rows.keys()).sort((a, b) => b - a);
        const lines: string[] = [];
        for (const key of sortedKeys) {
          const row = rows.get(key)!.sort((a, b) => a.transform[4] - b.transform[4]);
          let line = "";
          let lastEnd = -Infinity;
          for (const it of row) {
            const x = it.transform[4];
            // Insert spaces if there's a clear gap.
            if (lastEnd !== -Infinity && x - lastEnd > 2) line += " ";
            line += it.str;
            lastEnd = x + (it.width ?? 0);
          }
          lines.push(line.trimEnd());
        }
        pageText = lines.join("\n").trim();
      }

      if (includeBreaks) {
        out.push(`──── Page ${i} ────\n${pageText}`);
      } else {
        out.push(pageText);
      }
      page.cleanup();
    }
    await doc.destroy();
    return out.join("\n\n");
  };

  const handlePreview = async () => {
    setBusy(true);
    try {
      const text = await extract();
      setPreview(text);
      toast.success("Text extracted");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't extract text.");
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const text = preview || (await extract());
      downloadBlob(
        new Blob([text], { type: "text/plain;charset=utf-8" }),
        `${baseName(file!.name)}.txt`,
      );
      toast.success("Saved .txt file");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save text.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => {
          setFile(f[0]);
          setPreview("");
        }}
        title="Drop a PDF to extract text"
        hint="Plain .txt output — flow or layout-preserved"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => { setFile(null); setPreview(""); }} />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <ModeChip active={layout === "flow"} onClick={() => setLayout("flow")}>
          Flow
        </ModeChip>
        <ModeChip active={layout === "preserve"} onClick={() => setLayout("preserve")}>
          Preserve layout
        </ModeChip>
        <label className="ml-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={includeBreaks}
            onChange={(e) => setIncludeBreaks(e.target.checked)}
            className="h-4 w-4 accent-foreground"
          />
          Add page separators
        </label>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Preview
          </p>
          <button
            onClick={handlePreview}
            disabled={busy}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {preview ? "Re-run" : "Run extraction"}
          </button>
        </div>
        <pre className="scrollbar-thin max-h-96 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-5 text-foreground">
          {preview || (
            <span className="text-muted-foreground">
              Click “Run extraction” to preview, or hit download to save without previewing.
            </span>
          )}
        </pre>
      </div>

      <ActionBar
        status={preview ? `${preview.length.toLocaleString()} chars extracted` : "Ready"}
        primary={
          <button
            onClick={handleDownload}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Working…" : "Download .txt"}
          </button>
        }
      />
    </div>
  );
}
