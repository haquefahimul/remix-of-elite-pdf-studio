import { useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader } from "./SplitTool";
import { downloadBlob, baseName } from "@/lib/format";

type Pos = "left" | "center" | "right";

export function HeaderFooterTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const [headerLeft, setHeaderLeft] = useState("");
  const [headerCenter, setHeaderCenter] = useState("{filename}");
  const [headerRight, setHeaderRight] = useState("");

  const [footerLeft, setFooterLeft] = useState("{date}");
  const [footerCenter, setFooterCenter] = useState("");
  const [footerRight, setFooterRight] = useState("Page {page} of {pages}");

  const [fontSize, setFontSize] = useState(10);
  const [margin, setMargin] = useState(28);
  const [opacity, setOpacity] = useState(0.85);

  const handleApply = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const pages = pdf.getPages();
      const total = pages.length;
      const today = new Date().toLocaleDateString();
      const stem = baseName(file.name);

      const expand = (tpl: string, pageIdx: number) =>
        tpl
          .replace(/\{page\}/gi, String(pageIdx + 1))
          .replace(/\{pages\}/gi, String(total))
          .replace(/\{date\}/gi, today)
          .replace(/\{filename\}/gi, stem);

      pages.forEach((page, i) => {
        const { width, height } = page.getSize();
        const draw = (text: string, pos: Pos, y: number) => {
          if (!text) return;
          const txt = expand(text, i);
          const w = font.widthOfTextAtSize(txt, fontSize);
          let x = margin;
          if (pos === "center") x = (width - w) / 2;
          if (pos === "right") x = width - margin - w;
          page.drawText(txt, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(0.15, 0.15, 0.18),
            opacity,
          });
        };
        const headerY = height - margin;
        const footerY = margin - fontSize * 0.2;
        draw(headerLeft, "left", headerY);
        draw(headerCenter, "center", headerY);
        draw(headerRight, "right", headerY);
        draw(footerLeft, "left", footerY);
        draw(footerCenter, "center", footerY);
        draw(footerRight, "right", footerY);
      });

      const bytes = await pdf.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${stem} (header-footer).pdf`,
      );
      toast.success("Headers & footers applied");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't apply headers/footers.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to add headers & footers"
        hint="Use {page}, {pages}, {date}, {filename} as placeholders"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Header">
          <SlotInput label="Left" value={headerLeft} onChange={setHeaderLeft} />
          <SlotInput label="Center" value={headerCenter} onChange={setHeaderCenter} />
          <SlotInput label="Right" value={headerRight} onChange={setHeaderRight} />
        </Section>
        <Section title="Footer">
          <SlotInput label="Left" value={footerLeft} onChange={setFooterLeft} />
          <SlotInput label="Center" value={footerCenter} onChange={setFooterCenter} />
          <SlotInput label="Right" value={footerRight} onChange={setFooterRight} />
        </Section>
      </div>

      <div className="mt-6 grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-3">
        <NumField label="Font size" value={fontSize} onChange={setFontSize} min={6} max={24} />
        <NumField label="Margin (pt)" value={margin} onChange={setMargin} min={8} max={120} />
        <NumField
          label="Opacity"
          value={Math.round(opacity * 100)}
          onChange={(v) => setOpacity(v / 100)}
          min={10}
          max={100}
          suffix="%"
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Placeholders: <code className="rounded bg-accent px-1">{"{page}"}</code>{" "}
        <code className="rounded bg-accent px-1">{"{pages}"}</code>{" "}
        <code className="rounded bg-accent px-1">{"{date}"}</code>{" "}
        <code className="rounded bg-accent px-1">{"{filename}"}</code>
      </p>

      <ActionBar
        primary={
          <button
            onClick={handleApply}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Applying…" : "Apply & download"}
          </button>
        }
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function SlotInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-[64px_1fr] items-center gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="(empty)"
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground"
      />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-foreground"
        />
        <span className="w-12 text-right text-xs tabular-nums text-foreground">
          {value}
          {suffix ?? ""}
        </span>
      </div>
    </label>
  );
}
