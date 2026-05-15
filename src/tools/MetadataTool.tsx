import { useEffect, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { downloadBlob, baseName, formatBytes } from "@/lib/format";
import { FileHeader } from "./SplitTool";

type Meta = {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  producer: string;
  creator: string;
};

const empty: Meta = { title: "", author: "", subject: "", keywords: "", producer: "", creator: "" };

export function MetadataTool() {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<Meta>(empty);
  const [original, setOriginal] = useState<Meta>(empty);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setLoading(true);
    file
      .arrayBuffer()
      .then(async (buf) => {
        const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
        const m: Meta = {
          title: doc.getTitle() ?? "",
          author: doc.getAuthor() ?? "",
          subject: doc.getSubject() ?? "",
          keywords: (doc.getKeywords() ?? "") as string,
          producer: doc.getProducer() ?? "",
          creator: doc.getCreator() ?? "",
        };
        if (cancelled) return;
        setMeta(m);
        setOriginal(m);
        setPageCount(doc.getPageCount());
      })
      .catch(() => toast.error("Couldn't read that PDF."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [file]);

  const handleSave = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      doc.setTitle(meta.title);
      doc.setAuthor(meta.author);
      doc.setSubject(meta.subject);
      doc.setKeywords(
        meta.keywords
          .split(/[,\n]/)
          .map((k) => k.trim())
          .filter(Boolean)
      );
      doc.setProducer(meta.producer || "Folio");
      doc.setCreator(meta.creator || "Folio");
      doc.setModificationDate(new Date());
      const bytes = await doc.save();
      downloadBlob(
        new Blob([bytes as BlobPart], { type: "application/pdf" }),
        `${baseName(file.name)} (metadata).pdf`
      );
      toast.success("Metadata saved");
    } catch (err) {
      console.error(err);
      toast.error("Save failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to inspect"
        hint="View and rewrite document metadata"
      />
    );
  }

  const dirty = JSON.stringify(meta) !== JSON.stringify(original);

  return (
    <div>
      <FileHeader file={file} onReset={() => setFile(null)} />

      <div className="mt-6 grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            File summary
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <Row k="Pages" v={loading ? "…" : String(pageCount)} />
            <Row k="Size" v={formatBytes(file.size)} />
            <Row k="Type" v="application/pdf" />
            <Row k="Producer" v={original.producer || "—"} mono />
            <Row k="Creator" v={original.creator || "—"} mono />
          </dl>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Editable metadata
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Title" value={meta.title} onChange={(v) => setMeta({ ...meta, title: v })} />
            <Field label="Author" value={meta.author} onChange={(v) => setMeta({ ...meta, author: v })} />
            <Field
              label="Subject"
              value={meta.subject}
              onChange={(v) => setMeta({ ...meta, subject: v })}
              span
            />
            <Field
              label="Keywords (comma-separated)"
              value={meta.keywords}
              onChange={(v) => setMeta({ ...meta, keywords: v })}
              span
            />
            <Field label="Producer" value={meta.producer} onChange={(v) => setMeta({ ...meta, producer: v })} />
            <Field label="Creator" value={meta.creator} onChange={(v) => setMeta({ ...meta, creator: v })} />
          </div>
        </div>
      </div>

      <ActionBar
        status={dirty ? "Unsaved changes" : "No changes yet"}
        secondary={
          dirty && (
            <button
              onClick={() => setMeta(original)}
              className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Discard
            </button>
          )
        }
        primary={
          <button
            onClick={handleSave}
            disabled={busy || loading || !dirty}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Saving…" : "Save & download"}
          </button>
        }
      />
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className={`truncate text-right text-foreground ${mono ? "font-mono text-xs" : ""}`}>{v}</dd>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  span,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  span?: boolean;
}) {
  return (
    <label className={`text-xs text-muted-foreground ${span ? "sm:col-span-2" : ""}`}>
      <span>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground"
      />
    </label>
  );
}
