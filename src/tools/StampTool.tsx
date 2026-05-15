import { useState } from "react";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader, ModeChip } from "./SplitTool";
import { downloadBlob, baseName } from "@/lib/format";

const PRESETS = ["APPROVED", "DRAFT", "CONFIDENTIAL", "REVIEWED", "REJECTED", "FINAL"] as const;
type Preset = (typeof PRESETS)[number];

const COLORS: Record<string, [number, number, number]> = {
  Red: [0.78, 0.12, 0.18],
  Black: [0.1, 0.1, 0.12],
  Blue: [0.16, 0.32, 0.78],
  Green: [0.14, 0.5, 0.28],
};

const POSITIONS = ["Center", "Top-left", "Top-right", "Bottom-left", "Bottom-right"] as const;
type Position = (typeof POSITIONS)[number];

export function StampTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preset, setPreset] = useState<Preset>("APPROVED");
  const [custom, setCustom] = useState("");
  const [color, setColor] = useState<keyof typeof COLORS>("Red");
  const [size, setSize] = useState(72);
  const [rotation, setRotation] = useState(-20);
  const [opacity, setOpacity] = useState(0.35);
  const [position, setPosition] = useState<Position>("Center");
  const [outline, setOutline] = useState(true);

  const text = (custom.trim() || preset).toUpperCase();

  const handleApply = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      const font = await pdf.embedFont(StandardFonts.HelveticaBold);
      const [r, g, b] = COLORS[color];

      pdf.getPages().forEach((page) => {
        const { width, height } = page.getSize();
        const w = font.widthOfTextAtSize(text, size);
        const h = size;
        const padX = 24;
        const padY = 16;

        let cx = width / 2;
        let cy = height / 2;
        const margin = 60;
        if (position === "Top-left") {
          cx = margin + w / 2;
          cy = height - margin - h / 2;
        } else if (position === "Top-right") {
          cx = width - margin - w / 2;
          cy = height - margin - h / 2;
        } else if (position === "Bottom-left") {
          cx = margin + w / 2;
          cy = margin + h / 2;
        } else if (position === "Bottom-right") {
          cx = width - margin - w / 2;
          cy = margin + h / 2;
        }

        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // Position so the text's center sits on (cx, cy) after rotation.
        const localX = -w / 2;
        const localY = -h / 3;
        const drawX = cx + localX * cos - localY * sin;
        const drawY = cy + localX * sin + localY * cos;

        if (outline) {
          // Bordered box around the text
          const bx = -w / 2 - padX;
          const by = -h / 3 - padY;
          const bw = w + padX * 2;
          const bh = h + padY * 2;
          const rectX = cx + bx * cos - by * sin;
          const rectY = cy + bx * sin + by * cos;
          page.drawRectangle({
            x: rectX,
            y: rectY,
            width: bw,
            height: bh,
            rotate: degrees(rotation),
            borderColor: rgb(r, g, b),
            borderWidth: Math.max(2, size / 24),
            opacity,
            borderOpacity: opacity,
          });
        }

        page.drawText(text, {
          x: drawX,
          y: drawY,
          size,
          font,
          color: rgb(r, g, b),
          rotate: degrees(rotation),
          opacity,
        });
      });

      const bytes = await pdf.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)} (stamped).pdf`,
      );
      toast.success("Stamp applied");
    } catch (err) {
      console.error(err);
      toast.error("Stamp failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to stamp"
        hint="APPROVED, DRAFT, CONFIDENTIAL, and more"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Stamp text
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <ModeChip
              key={p}
              active={preset === p && custom.trim() === ""}
              onClick={() => {
                setPreset(p);
                setCustom("");
              }}
            >
              {p}
            </ModeChip>
          ))}
        </div>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="…or type a custom stamp"
          className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
        />
      </div>

      <div className="mt-4 grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Color
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.keys(COLORS).map((c) => (
              <button
                key={c}
                onClick={() => setColor(c as keyof typeof COLORS)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  color === c
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-border-strong"
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{
                    background: `rgb(${COLORS[c][0] * 255}, ${COLORS[c][1] * 255}, ${COLORS[c][2] * 255})`,
                  }}
                />
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Position
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {POSITIONS.map((p) => (
              <ModeChip key={p} active={position === p} onClick={() => setPosition(p)}>
                {p}
              </ModeChip>
            ))}
          </div>
        </div>
        <Slider label="Size" value={size} onChange={setSize} min={24} max={180} suffix="pt" />
        <Slider
          label="Rotation"
          value={rotation}
          onChange={setRotation}
          min={-90}
          max={90}
          suffix="°"
        />
        <Slider
          label="Opacity"
          value={Math.round(opacity * 100)}
          onChange={(v) => setOpacity(v / 100)}
          min={10}
          max={100}
          suffix="%"
        />
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm">
          <span className="text-foreground">Border box</span>
          <input
            type="checkbox"
            checked={outline}
            onChange={(e) => setOutline(e.target.checked)}
            className="h-4 w-4 accent-foreground"
          />
        </label>
      </div>

      <ActionBar
        status={`Stamping every page with “${text}”`}
        primary={
          <button
            onClick={handleApply}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Stamping…" : "Stamp & download"}
          </button>
        }
      />
    </div>
  );
}

function Slider({
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
        <span className="w-14 text-right text-xs tabular-nums text-foreground">
          {value}
          {suffix ?? ""}
        </span>
      </div>
    </label>
  );
}
