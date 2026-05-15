import { useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { toast } from "sonner";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob } from "@/lib/format";

function tokenize(s: string): { t: string; k: "key" | "str" | "num" | "bool" | "null" | "punct" | "space" }[] {
  const out: { t: string; k: "key" | "str" | "num" | "bool" | "null" | "punct" | "space" }[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '"') {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === "\\") {
          j += 2;
          continue;
        }
        if (s[j] === '"') {
          j++;
          break;
        }
        j++;
      }
      const str = s.slice(i, j);
      // key if next non-space is :
      let k = j;
      while (k < s.length && /\s/.test(s[k])) k++;
      out.push({ t: str, k: s[k] === ":" ? "key" : "str" });
      i = j;
    } else if (/[0-9.\-+eE]/.test(c) && (out.length === 0 || out[out.length - 1].k !== "key")) {
      let j = i;
      while (j < s.length && /[0-9.\-+eE]/.test(s[j])) j++;
      out.push({ t: s.slice(i, j), k: "num" });
      i = j;
    } else if (s.startsWith("true", i)) {
      out.push({ t: "true", k: "bool" });
      i += 4;
    } else if (s.startsWith("false", i)) {
      out.push({ t: "false", k: "bool" });
      i += 5;
    } else if (s.startsWith("null", i)) {
      out.push({ t: "null", k: "null" });
      i += 4;
    } else if (/\s/.test(c)) {
      out.push({ t: c, k: "space" });
      i++;
    } else {
      out.push({ t: c, k: "punct" });
      i++;
    }
  }
  return out;
}

export function JsonToPdfTool() {
  const [input, setInput] = useState('{\n  "name": "Folio",\n  "version": 1.0,\n  "features": ["fast", "private", "local"],\n  "active": true\n}');
  const [busy, setBusy] = useState(false);
  const [pretty, setPretty] = useState(2);

  const apply = async () => {
    if (!input.trim()) return;
    setBusy(true);
    try {
      let formatted = input;
      try {
        const parsed = JSON.parse(input);
        formatted = JSON.stringify(parsed, null, pretty);
      } catch {
        toast.error("Invalid JSON — exporting as-is");
      }

      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Courier);
      const fontSize = 10;
      const lineH = fontSize * 1.4;
      const pageW = 595;
      const pageH = 842;
      const margin = 48;

      const colors = {
        key: rgb(0.18, 0.36, 0.7),
        str: rgb(0.18, 0.5, 0.36),
        num: rgb(0.65, 0.36, 0.1),
        bool: rgb(0.55, 0.18, 0.55),
        null: rgb(0.5, 0.5, 0.55),
        punct: rgb(0.25, 0.25, 0.28),
        space: rgb(0.25, 0.25, 0.28),
      } as const;

      const lines = formatted.split("\n");
      let page = pdf.addPage([pageW, pageH]);
      let y = pageH - margin;

      for (const line of lines) {
        if (y < margin) {
          page = pdf.addPage([pageW, pageH]);
          y = pageH - margin;
        }
        let x = margin;
        const tokens = tokenize(line);
        for (const tok of tokens) {
          page.drawText(tok.t.replace(/\t/g, "  "), {
            x,
            y,
            size: fontSize,
            font,
            color: colors[tok.k],
          });
          x += font.widthOfTextAtSize(tok.t, fontSize);
        }
        y -= lineH;
      }

      const bytes = await pdf.save();
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), "data.pdf");
      toast.success("JSON exported");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't render JSON");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            JSON input
          </p>
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            Indent
            <div className="inline-flex rounded-full border border-border bg-background p-0.5">
              {[2, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setPretty(n)}
                  className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                    pretty === n
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={16}
          className="w-full resize-y rounded-xl border border-border bg-background p-3 font-mono text-sm shadow-soft outline-none focus:ring-2 focus:ring-ring"
          spellCheck={false}
        />
      </div>

      <ActionBar
        status="Syntax-highlighted, monospaced, paginated"
        primary={
          <button
            onClick={apply}
            disabled={busy || !input.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Building…" : "Export PDF"}
          </button>
        }
      />
    </div>
  );
}
