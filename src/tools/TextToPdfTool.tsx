import { useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { toast } from "sonner";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob } from "@/lib/format";

const PAGE_SIZES: Record<string, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008],
  A5: [419.53, 595.28],
};

const FONTS = {
  Helvetica: StandardFonts.Helvetica,
  "Times Roman": StandardFonts.TimesRoman,
  "Courier (mono)": StandardFonts.Courier,
};

export function TextToPdfTool() {
  const [text, setText] = useState(
    "Paste or type any text here.\n\nFolio will paginate it cleanly into a PDF — no servers, no accounts.",
  );
  const [size, setSize] = useState<keyof typeof PAGE_SIZES>("A4");
  const [fontSize, setFontSize] = useState(12);
  const [fontKey, setFontKey] = useState<keyof typeof FONTS>("Helvetica");
  const [margin, setMargin] = useState(54);
  const [busy, setBusy] = useState(false);

  const wrap = (line: string, font: any, max: number): string[] => {
    if (line === "") return [""];
    const words = line.split(/(\s+)/);
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur + w;
      if (font.widthOfTextAtSize(test, fontSize) <= max) {
        cur = test;
      } else {
        if (cur) out.push(cur.trimEnd());
        // word longer than line — hard break
        if (font.widthOfTextAtSize(w, fontSize) > max) {
          let buf = "";
          for (const ch of w) {
            if (font.widthOfTextAtSize(buf + ch, fontSize) > max) {
              out.push(buf);
              buf = ch;
            } else buf += ch;
          }
          cur = buf;
        } else {
          cur = w.trimStart();
        }
      }
    }
    if (cur) out.push(cur.trimEnd());
    return out;
  };

  const handleBuild = async () => {
    setBusy(true);
    try {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(FONTS[fontKey]);
      const [pw, ph] = PAGE_SIZES[size];
      const lh = fontSize * 1.4;
      const maxW = pw - margin * 2;
      const maxLines = Math.floor((ph - margin * 2) / lh);

      const allLines: string[] = [];
      for (const para of text.split(/\r?\n/)) {
        const wrapped = wrap(para, font, maxW);
        for (const l of wrapped) allLines.push(l);
      }

      let page = doc.addPage([pw, ph]);
      let row = 0;
      for (const line of allLines) {
        if (row >= maxLines) {
          page = doc.addPage([pw, ph]);
          row = 0;
        }
        page.drawText(line, {
          x: margin,
          y: ph - margin - (row + 1) * lh + (lh - fontSize),
          size: fontSize,
          font,
          color: rgb(0.1, 0.1, 0.12),
        });
        row++;
      }

      const bytes = await doc.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), "document.pdf");
      toast.success(`Created ${doc.getPageCount()}-page PDF`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't create PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={16}
        className="w-full resize-y rounded-2xl border border-border bg-surface p-4 font-sans text-sm leading-7 text-foreground outline-none focus:border-foreground"
        placeholder="Paste text here…"
      />

      <div className="mt-4 grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-4">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Page size</span>
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as keyof typeof PAGE_SIZES)}
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            {Object.keys(PAGE_SIZES).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Font</span>
          <select
            value={fontKey}
            onChange={(e) => setFontKey(e.target.value as keyof typeof FONTS)}
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            {Object.keys(FONTS).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Font size</span>
          <input
            type="number"
            min={6}
            max={48}
            value={fontSize}
            onChange={(e) => setFontSize(Math.max(6, Math.min(48, Number(e.target.value) || 12)))}
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Margin (pt)</span>
          <input
            type="number"
            min={12}
            max={144}
            value={margin}
            onChange={(e) => setMargin(Math.max(12, Math.min(144, Number(e.target.value) || 54)))}
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <ActionBar
        status={`${text.length.toLocaleString()} characters`}
        primary={
          <button
            onClick={handleBuild}
            disabled={busy || text.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Building…" : "Build PDF"}
          </button>
        }
      />
    </div>
  );
}
