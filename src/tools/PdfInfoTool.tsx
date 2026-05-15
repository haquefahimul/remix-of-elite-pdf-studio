import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { Spinner } from "@/components/ActionBar";
import { FileHeader } from "./SplitTool";
import { formatBytes } from "@/lib/format";
import { pdfjsLib } from "@/lib/pdf-worker";

type Info = {
  pageCount: number;
  fileSize: number;
  encrypted: boolean;
  pdfVersion: string;
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  created: string;
  modified: string;
  pageSizes: { w: number; h: number; count: number }[];
  fontCount: number;
  imageCount: number;
  textCharCount: number;
};

export function PdfInfoTool() {
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);

  const analyze = async (f: File) => {
    setFile(f);
    setInfo(null);
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const sizes = new Map<string, { w: number; h: number; count: number }>();
      for (const p of src.getPages()) {
        const { width, height } = p.getSize();
        const key = `${width.toFixed(1)}x${height.toFixed(1)}`;
        const cur = sizes.get(key);
        if (cur) cur.count++;
        else sizes.set(key, { w: width, h: height, count: 1 });
      }

      // pdfjs for fonts/images/text
      const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
      const fonts = new Set<string>();
      let imgs = 0;
      let chars = 0;
      const pagesToScan = Math.min(pdf.numPages, 30);
      for (let i = 1; i <= pagesToScan; i++) {
        const page = await pdf.getPage(i);
        const ops = await page.getOperatorList();
        for (let j = 0; j < ops.fnArray.length; j++) {
          const fn = ops.fnArray[j];
          if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject) {
            imgs++;
          }
        }
        const tc = await page.getTextContent();
        for (const item of tc.items as any[]) {
          if (item.str) chars += item.str.length;
          if (item.fontName) fonts.add(item.fontName);
        }
        page.cleanup();
      }
      await pdf.destroy();

      const fmt = (d?: Date) => (d ? d.toLocaleString() : "—");
      const txt = (s?: string) => (s && s.length ? s : "—");

      // Detect PDF version from header
      const head = new Uint8Array(buf.slice(0, 16));
      const headStr = new TextDecoder().decode(head);
      const ver = headStr.match(/%PDF-(\d\.\d)/)?.[1] ?? "?";

      // Detect encryption flag
      const headerCheck = new TextDecoder().decode(new Uint8Array(buf.slice(0, Math.min(buf.byteLength, 4096))));
      const encrypted = /\/Encrypt\b/.test(new TextDecoder().decode(new Uint8Array(buf))) || headerCheck.includes("/Encrypt");

      setInfo({
        pageCount: src.getPageCount(),
        fileSize: f.size,
        encrypted,
        pdfVersion: ver,
        title: txt(src.getTitle()),
        author: txt(src.getAuthor()),
        subject: txt(src.getSubject()),
        keywords: txt(src.getKeywords()),
        creator: txt(src.getCreator()),
        producer: txt(src.getProducer()),
        created: fmt(src.getCreationDate()),
        modified: fmt(src.getModificationDate()),
        pageSizes: Array.from(sizes.values()).sort((a, b) => b.count - a.count),
        fontCount: fonts.size,
        imageCount: imgs,
        textCharCount: chars,
      });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't analyze PDF");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => analyze(f[0])}
        title="Drop a PDF to inspect"
        hint="Folio reports pages, sizes, fonts, images, and metadata"
      />
    );
  }

  return (
    <div>
      <FileHeader file={file} onReset={() => { setFile(null); setInfo(null); }} />
      {busy && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          <Spinner /> Analyzing document…
        </div>
      )}
      {info && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card title="Document">
            <Row k="Pages" v={String(info.pageCount)} />
            <Row k="File size" v={formatBytes(info.fileSize)} />
            <Row k="PDF version" v={info.pdfVersion} />
            <Row k="Encrypted" v={info.encrypted ? "Yes" : "No"} />
            <Row k="Fonts (sampled)" v={String(info.fontCount)} />
            <Row k="Images (sampled)" v={String(info.imageCount)} />
            <Row k="Text characters (sampled)" v={info.textCharCount.toLocaleString()} />
          </Card>
          <Card title="Metadata">
            <Row k="Title" v={info.title} />
            <Row k="Author" v={info.author} />
            <Row k="Subject" v={info.subject} />
            <Row k="Keywords" v={info.keywords} />
            <Row k="Creator" v={info.creator} />
            <Row k="Producer" v={info.producer} />
            <Row k="Created" v={info.created} />
            <Row k="Modified" v={info.modified} />
          </Card>
          <Card title="Page sizes">
            <div className="space-y-2 text-sm">
              {info.pageSizes.map((s, i) => (
                <div key={i} className="flex items-center justify-between border-b border-border pb-1.5 last:border-0">
                  <span className="text-muted-foreground">
                    {s.w.toFixed(0)} × {s.h.toFixed(0)} pt
                    <span className="ml-2 text-xs">({(s.w / 72 * 25.4).toFixed(0)} × {(s.h / 72 * 25.4).toFixed(0)} mm)</span>
                  </span>
                  <span className="font-medium tabular-nums">{s.count} page{s.count === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-display text-2xl tracking-tight">{title}</h2>
      <div className="mt-3 space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="max-w-[60%] truncate text-right font-medium text-foreground">{v}</span>
    </div>
  );
}
