import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { FileHeader } from "./SplitTool";
import { pdfjsLib } from "@/lib/pdf-worker";

export function UnlockTool() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [encrypted, setEncrypted] = useState<boolean | null>(null);
  const [pageCount, setPageCount] = useState(0);

  const inspect = async (f: File) => {
    setFile(f);
    setEncrypted(null);
    setPageCount(0);
    try {
      const buf = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
      setEncrypted(false);
      setPageCount(pdf.numPages);
      await pdf.destroy();
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e?.name === "PasswordException") {
        setEncrypted(true);
      } else {
        toast.error("Couldn't read that PDF.");
      }
    }
  };

  const handleUnlock = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      // Open with password using pdf.js, render every page, then re-emit as a new PDF
      // via pdf-lib by copying pages from a buffer pdf.js produces? pdf-lib can't load
      // encrypted PDFs natively. Workaround: render all pages as PNG and reassemble.
      // For a TRUE structural unlock we need an encryption-capable lib; this approach
      // gives a clean unlocked PDF that's visually identical.
      const pdf = await pdfjsLib.getDocument({ data: buf.slice(0), password }).promise;
      const { PDFDocument } = await import("pdf-lib");
      const out = await PDFDocument.create();

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d", { alpha: false })!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({
          canvas,
          canvasContext: ctx,
          viewport,
        } as Parameters<typeof page.render>[0]).promise;
        const blob: Blob = await new Promise((res) =>
          canvas.toBlob((b) => res(b!), "image/jpeg", 0.92)
        );
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const img = await out.embedJpg(bytes);
        const pageOut = out.addPage([viewport.width / 2, viewport.height / 2]);
        pageOut.drawImage(img, {
          x: 0,
          y: 0,
          width: pageOut.getWidth(),
          height: pageOut.getHeight(),
        });
        page.cleanup();
      }
      await pdf.destroy();
      const bytes = await out.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)} (unlocked).pdf`
      );
      toast.success("Unlocked PDF ready");
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e?.name === "PasswordException") {
        toast.error("Wrong password — try again.");
      } else {
        console.error(err);
        toast.error("Unlock failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => inspect(f[0])}
        title="Drop a password-protected PDF"
        hint="We'll never store your password — it stays on this device"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-tool-unlock/10">
            <LockKeyhole className="h-5 w-5 text-tool-unlock" />
          </div>
          <div className="flex-1">
            <p className="font-display text-2xl tracking-tight text-foreground">
              {encrypted === true
                ? "This file is password-protected"
                : encrypted === false
                  ? "This file isn't encrypted"
                  : "Inspecting…"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {encrypted === false
                ? `${pageCount} pages · ${formatBytes(file.size)} · already openable without a password.`
                : "Type the password you use to open it. Nothing is uploaded."}
            </p>

            {encrypted === true && (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <label className="relative flex-1">
                  <span className="sr-only">Password</span>
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Document password"
                    autoFocus
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 pr-10 text-sm outline-none focus:border-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </label>
                <button
                  onClick={handleUnlock}
                  disabled={busy || !password}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-foreground px-5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {busy ? <Spinner /> : null}
                  {busy ? "Unlocking…" : "Unlock & download"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ActionBar
        status="Pages are re-rendered locally and reassembled into a clean, password-free PDF."
        primary={null}
      />
    </div>
  );
}
