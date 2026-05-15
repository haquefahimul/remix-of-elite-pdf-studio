import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader, ModeChip } from "./SplitTool";
import { downloadBlob, baseName } from "@/lib/format";

type Direction = "horizontal" | "vertical";
type Order = "ltr" | "rtl";

export function UnNupTool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [direction, setDirection] = useState<Direction>("horizontal");
  const [order, setOrder] = useState<Order>("ltr");

  const handleSplit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const out = await PDFDocument.create();

      const indices = src.getPageIndices();
      const embedded = await out.embedPdf(await src.save(), indices);

      embedded.forEach((emb) => {
        const w = emb.width;
        const h = emb.height;

        if (direction === "horizontal") {
          // Two halves: left and right
          const halfW = w / 2;
          const first = out.addPage([halfW, h]);
          const second = out.addPage([halfW, h]);
          // First page shows left half: draw page shifted so left half lands in canvas
          (order === "ltr" ? first : second).drawPage(emb, {
            x: 0,
            y: 0,
            width: w,
            height: h,
          });
          // Second page shows right half: shift by -halfW
          (order === "ltr" ? second : first).drawPage(emb, {
            x: -halfW,
            y: 0,
            width: w,
            height: h,
          });
        } else {
          const halfH = h / 2;
          const first = out.addPage([w, halfH]);
          const second = out.addPage([w, halfH]);
          // Top half first
          (order === "ltr" ? first : second).drawPage(emb, {
            x: 0,
            y: -halfH,
            width: w,
            height: h,
          });
          (order === "ltr" ? second : first).drawPage(emb, {
            x: 0,
            y: 0,
            width: w,
            height: h,
          });
        }
      });

      const bytes = await out.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)}-1up.pdf`,
      );
      toast.success("Split into single pages");
    } catch (err) {
      console.error(err);
      toast.error("Split failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a 2-up PDF"
        hint="Each sheet gets sliced into two single pages"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Split direction
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ModeChip active={direction === "horizontal"} onClick={() => setDirection("horizontal")}>
              Side by side
            </ModeChip>
            <ModeChip active={direction === "vertical"} onClick={() => setDirection("vertical")}>
              Top & bottom
            </ModeChip>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Reading order
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ModeChip active={order === "ltr"} onClick={() => setOrder("ltr")}>
              {direction === "horizontal" ? "Left first" : "Top first"}
            </ModeChip>
            <ModeChip active={order === "rtl"} onClick={() => setOrder("rtl")}>
              {direction === "horizontal" ? "Right first" : "Bottom first"}
            </ModeChip>
          </div>
        </div>
      </div>

      <div className="mt-6 grid place-items-center rounded-2xl border border-border bg-surface p-8">
        <div className="flex items-center gap-4 text-muted-foreground">
          <Mock direction={direction} />
          <span className="text-2xl">→</span>
          <Mock direction={direction} split />
        </div>
      </div>

      <ActionBar
        status="One input page becomes two output pages"
        primary={
          <button
            onClick={handleSplit}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Splitting…" : "Split & download"}
          </button>
        }
      />
    </div>
  );
}

function Mock({ direction, split }: { direction: Direction; split?: boolean }) {
  if (split) {
    return (
      <div className="flex gap-2">
        <div className="h-20 w-14 rounded-md border border-border bg-background" />
        <div className="h-20 w-14 rounded-md border border-border bg-background" />
      </div>
    );
  }
  return (
    <div className="relative h-20 w-28 rounded-md border border-border bg-background">
      <div
        className={`absolute bg-border ${direction === "horizontal" ? "left-1/2 top-0 h-full w-px" : "top-1/2 left-0 h-px w-full"}`}
      />
    </div>
  );
}
