import { useEffect, useState } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { Input } from "@/components/ui/input";
import { downloadBlob, formatBytes, baseName } from "@/lib/format";
import { pdfjsLib } from "@/lib/pdf-worker";

type Match = { page: number; x: number; y: number; w: number; h: number };

export function HighlightSearchTool() {
  const [file, setFile] = useState<File | null>(null);
  const [term, setTerm] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);

  useEffect(() => {
    setMatches([]);
  }, [file, term, caseSensitive]);

  const scan = async () => {
    if (!file || !term.trim()) return;
    setScanning(true);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
      const needle = caseSensitive ? term : term.toLowerCase();
      const found: Match[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        for (const it of content.items as Array<{
          str: string;
          transform: number[];
          width: number;
          height: number;
        }>) {
          const haystack = caseSensitive ? it.str : it.str.toLowerCase();
          if (!haystack.includes(needle)) continue;
          const t = it.transform;
          const x = t[4];
          const y = t[5];
          const h = Math.max(8, Math.abs(t[3]) || it.height || 10);
          found.push({ page: i - 1, x, y: y - 1, w: it.width, h });
        }
        page.cleanup();
      }
      await pdf.destroy();
      setMatches(found);
      if (found.length === 0) toast("No matches found");
      else toast.success(`Found ${found.length} match${found.length === 1 ? "" : "es"}`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't scan that PDF");
    } finally {
      setScanning(false);
    }
  };

  const apply = async () => {
    if (!file || matches.length === 0) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const doc = await PDFDocument.load(buf);
      const pages = doc.getPages();
      for (const m of matches) {
        const p = pages[m.page];
        if (!p) continue;
        p.drawRectangle({
          x: m.x,
          y: m.y,
          width: m.w,
          height: m.h,
          color: rgb(1, 0.92, 0.2),
          opacity: 0.45,
        });
      }
      const bytes = await doc.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)} (highlighted).pdf`,
      );
      toast.success("Highlights applied");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't apply highlights");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(fs) => setFile(fs[0])}
        title="Drop a PDF to search & highlight"
        hint="Type a phrase — Folio paints a yellow box over every match"
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

      <div className="mt-6 grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[1fr_auto_auto]">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search phrase…"
          className="h-11"
        />
        <label className="inline-flex items-center gap-2 px-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />
          Match case
        </label>
        <button
          onClick={scan}
          disabled={!term.trim() || scanning}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          {scanning ? <Spinner /> : null}
          {scanning ? "Scanning…" : "Find matches"}
        </button>
      </div>

      {matches.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          {matches.length} match{matches.length === 1 ? "" : "es"} ready to highlight.
        </p>
      )}

      <ActionBar
        status={matches.length ? `${matches.length} matches` : "Search to begin"}
        primary={
          <button
            onClick={apply}
            disabled={busy || matches.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Highlighting…" : "Highlight & download"}
          </button>
        }
      />
    </div>
  );
}
