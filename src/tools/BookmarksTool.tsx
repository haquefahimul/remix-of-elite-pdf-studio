import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ActionBar, Spinner } from "@/components/ActionBar";
import { FileHeader, ModeChip } from "./SplitTool";
import { pdfjsLib } from "@/lib/pdf-worker";
import { downloadBlob, baseName } from "@/lib/format";

type OutlineNode = {
  title: string;
  page: number | null;
  children: OutlineNode[];
};

type Format = "markdown" | "json" | "txt";

export function BookmarksTool() {
  const [file, setFile] = useState<File | null>(null);
  const [tree, setTree] = useState<OutlineNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<Format>("markdown");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) return;
    let cancel = false;
    setLoading(true);
    setTree(null);
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buf }).promise;
        const raw = await doc.getOutline();
        if (!raw) {
          if (!cancel) setTree([]);
          return;
        }
        const walk = async (items: any[]): Promise<OutlineNode[]> => {
          const out: OutlineNode[] = [];
          for (const item of items) {
            let page: number | null = null;
            try {
              let dest = item.dest;
              if (typeof dest === "string") dest = await doc.getDestination(dest);
              if (Array.isArray(dest)) {
                const ref = dest[0];
                const idx = await doc.getPageIndex(ref);
                page = idx + 1;
              }
            } catch {
              // ignore
            }
            const children = item.items ? await walk(item.items) : [];
            out.push({ title: item.title || "(untitled)", page, children });
          }
          return out;
        };
        const t = await walk(raw);
        if (!cancel) setTree(t);
      } catch (err) {
        console.error(err);
        if (!cancel) toast.error("Couldn't read PDF outline");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [file]);

  const renderText = (nodes: OutlineNode[]): string => {
    if (format === "json") return JSON.stringify(nodes, null, 2);
    const lines: string[] = [];
    const walk = (arr: OutlineNode[], depth: number) => {
      for (const n of arr) {
        const pageStr = n.page ? ` — p.${n.page}` : "";
        if (format === "markdown") {
          const indent = "  ".repeat(depth);
          lines.push(`${indent}- ${n.title}${pageStr}`);
        } else {
          lines.push(`${"    ".repeat(depth)}${n.title}${pageStr}`);
        }
        walk(n.children, depth + 1);
      }
    };
    walk(nodes, 0);
    return lines.join("\n");
  };

  const handleExport = async () => {
    if (!file || !tree) return;
    if (tree.length === 0) {
      toast.error("This PDF has no bookmarks");
      return;
    }
    setBusy(true);
    try {
      const text = renderText(tree);
      const ext = format === "json" ? "json" : format === "markdown" ? "md" : "txt";
      const mime = format === "json" ? "application/json" : "text/plain";
      downloadBlob(
        new Blob([text], { type: mime }),
        `${baseName(file.name)}-bookmarks.${ext}`,
      );
      toast.success("Bookmarks exported");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept="pdf"
        onFiles={(f) => setFile(f[0])}
        title="Drop a PDF to inspect bookmarks"
        hint="Folio reads the table of contents and lets you export it"
      />
    );
  }

  const flatCount = tree ? countNodes(tree) : 0;

  return (
    <div>
      <FileHeader file={file} onReset={() => { setFile(null); setTree(null); }} />

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Export format
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ModeChip active={format === "markdown"} onClick={() => setFormat("markdown")}>Markdown</ModeChip>
          <ModeChip active={format === "txt"} onClick={() => setFormat("txt")}>Plain text</ModeChip>
          <ModeChip active={format === "json"} onClick={() => setFormat("json")}>JSON</ModeChip>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Reading outline…</p>
        ) : tree && tree.length > 0 ? (
          <div className="max-h-[480px] overflow-auto">
            <OutlineList nodes={tree} depth={0} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No bookmarks were found in this PDF.
          </p>
        )}
      </div>

      <ActionBar
        status={loading ? "Reading outline…" : `${flatCount} bookmark${flatCount === 1 ? "" : "s"}`}
        primary={
          <button
            onClick={handleExport}
            disabled={busy || loading || !tree || tree.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {busy ? "Exporting…" : "Export bookmarks"}
          </button>
        }
      />
    </div>
  );
}

function countNodes(nodes: OutlineNode[]): number {
  let n = 0;
  for (const node of nodes) {
    n += 1 + countNodes(node.children);
  }
  return n;
}

function OutlineList({ nodes, depth }: { nodes: OutlineNode[]; depth: number }) {
  return (
    <ul className="space-y-1">
      {nodes.map((n, i) => (
        <li key={i} style={{ paddingLeft: depth * 16 }}>
          <div className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1 hover:bg-accent">
            <span className="truncate text-sm text-foreground">{n.title}</span>
            {n.page != null && (
              <span className="shrink-0 text-xs text-muted-foreground">p. {n.page}</span>
            )}
          </div>
          {n.children.length > 0 && <OutlineList nodes={n.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}
