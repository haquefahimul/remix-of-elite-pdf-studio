import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { TOOLS } from "@/lib/tools";
import {
  ArrowRight,
  BadgeCheck,
  Gauge,
  Infinity as InfinityIcon,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Folio — Free Online PDF Tools (No Upload, No Signup)" },
      {
        name: "description",
        content:
          "88+ free PDF tools that run in your browser. Merge, split, compress, rotate, sign, edit, OCR, redact, and convert PDF to Word, Excel, JPG, PNG, and HTML — all on-device.",
      },
      { property: "og:title", content: "Folio — Free Online PDF Tools" },
      {
        property: "og:description",
        content:
          "88+ private, browser-native PDF tools. Merge, split, compress, convert, sign — free and unlimited.",
      },
      { property: "og:url", content: "/" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
});

function HomePage() {
  const [query, setQuery] = useState("");
  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOLS;
    return TOOLS.filter((tool) =>
      [tool.name, tool.tagline, tool.description, tool.slug].some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [query]);

  return (
    <div>
      <section className="mx-auto max-w-7xl px-6 pt-10 pb-8 sm:pt-16 sm:pb-12">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground shadow-soft">
            <Sparkles className="h-3.5 w-3.5 text-tool-rotate" />
            Private PDF workbench · no uploads, no accounts, no limits
          </span>
          <h1 className="mt-6 font-display text-5xl leading-[1.02] tracking-tight text-foreground sm:text-7xl">
            Folio turns browser PDF work into a pro-grade studio.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            {TOOLS.length} polished tools to merge, split, compress, crop, OCR, redact, protect,
            compare, sign, resize, booklet-impose, invert, and convert between PDF, Word, Excel,
            JPG, PNG, and HTML — all processed locally on your device.
          </p>

          <div className="mx-auto mt-8 max-w-2xl rounded-[2rem] border border-border bg-surface p-2 shadow-elevated">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative flex min-h-14 flex-1 items-center">
                <Search className="pointer-events-none absolute left-4 h-4 w-4 text-muted-foreground" />
                <span className="sr-only">Search PDF tools</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tools: merge, compress, JPG…"
                  className="h-14 w-full rounded-[1.5rem] border border-transparent bg-accent/60 pr-4 pl-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-border-strong focus:bg-surface"
                />
              </label>
              <Link
                to="/tool/$slug"
                params={{ slug: "merge" }}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-[1.5rem] bg-foreground px-5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
              >
                Start merging
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Files never leave your device
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-tool-rotate" /> Runs with browser-native engines
            </span>
            <span className="inline-flex items-center gap-1.5">
              <InfinityIcon className="h-3.5 w-3.5 text-tool-merge" /> Unlimited & free
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-14">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Core toolkit
            </p>
            <h2 className="mt-1 font-display text-3xl tracking-tight text-foreground">
              Choose exactly what you need
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {filteredTools.length} of {TOOLS.length} tools ready
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filteredTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.id}
                to="/tool/$slug"
                params={{ slug: tool.slug }}
                className="group relative flex min-h-56 flex-col overflow-hidden rounded-[1.75rem] border border-border bg-surface p-6 shadow-soft transition-all hover:-translate-y-1 hover:border-border-strong hover:shadow-elevated"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-border-strong to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div
                  className={`mb-5 grid h-12 w-12 place-items-center rounded-2xl ${tool.accentSoft} transition-transform group-hover:scale-105`}
                >
                  <Icon className={`h-5 w-5 ${tool.accent}`} strokeWidth={1.75} />
                </div>
                <h3 className="font-display text-2xl tracking-tight text-foreground">
                  {tool.name}
                </h3>
                <p className="mt-1 text-sm font-medium text-muted-foreground">{tool.tagline}</p>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {tool.description}
                </p>
                <div className="mt-auto pt-6">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/70 transition-colors group-hover:text-foreground">
                    Open
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        {filteredTools.length === 0 ? (
          <div className="mt-6 rounded-[1.75rem] border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
            <p className="font-medium text-foreground">No matching tool yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Try merge, split, compress, rotate, organize, delete, PDF, or JPG.</p>
          </div>
        ) : null}
      </section>

      <section className="border-y border-border bg-surface-elevated">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-3 md:py-16">
          <div>
            <LockKeyhole className="h-5 w-5 text-success" />
            <h3 className="mt-4 font-display text-2xl tracking-tight text-foreground">
              Local processing by default
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Every tool reads and writes files in the browser, so private documents stay on your
              machine instead of moving through a remote queue.
            </p>
          </div>
          <div>
            <Gauge className="h-5 w-5 text-tool-rotate" />
            <h3 className="mt-4 font-display text-2xl tracking-tight text-foreground">
              Fast visual workflows
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Page thumbnails, drag-reorder, rotation previews, and batch export controls make the
              core PDF jobs feel precise instead of tedious.
            </p>
          </div>
          <div>
            <BadgeCheck className="h-5 w-5 text-tool-merge" />
            <h3 className="mt-4 font-display text-2xl tracking-tight text-foreground">
              No watermark traps
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Export clean files without signup gates, daily quotas, or surprise branding stamped
              onto your documents.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-border bg-surface p-7 shadow-soft sm:p-8">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-tool-pdf-jpg/10">
                <UploadCloud className="h-5 w-5 text-tool-pdf-jpg" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  What works today
                </p>
                <h3 className="mt-2 font-display text-3xl tracking-tight text-foreground">
                  Real exports, not mockups
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  The current toolset already downloads finished PDFs, JPGs, and ZIP bundles from
                  your browser. Pick a tool, drop files, adjust the controls, and export.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Metric value={String(TOOLS.length)} label="working tools" />
            <Metric value="0" label="server uploads" />
            <Metric value="∞" label="usage limits" />
            <Metric value="PDF" label="first-class format" />
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-surface px-5 py-6 shadow-soft">
      <p className="font-display text-4xl tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
