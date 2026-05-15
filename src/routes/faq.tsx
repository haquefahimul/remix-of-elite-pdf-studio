import { createFileRoute, Link } from "@tanstack/react-router";

const FAQS = [
  {
    q: "Is Folio really free to use?",
    a: "Yes — every tool on Folio is 100% free, with no signup, no daily limits, and no watermarks. We don't ask for an email or a credit card.",
  },
  {
    q: "Are my PDF files uploaded to a server?",
    a: "No. Folio runs entirely in your browser using WebAssembly, pdf-lib, pdf.js, and the Canvas API. Your files never leave your device — there is literally no server to upload to.",
  },
  {
    q: "How do I merge PDF files online for free?",
    a: "Open the Merge PDF tool, drag in your files, drag to reorder, and click download. The merged PDF is built in your browser and saved straight to your device.",
  },
  {
    q: "How do I compress a PDF without losing quality?",
    a: "Open the Compress PDF tool and pick a quality level. Folio re-encodes embedded images locally, shrinking file size while preserving sharp text and crisp graphics.",
  },
  {
    q: "Can I convert PDF to Word, Excel, JPG or PNG?",
    a: "Yes. Folio includes PDF to Word, PDF to Excel, PDF to JPG, PDF to PNG, PDF to HTML, PDF to Text, and PDF to Markdown — plus the reverse conversions. All run on-device.",
  },
  {
    q: "How do I split a PDF into separate pages?",
    a: "Use the Split PDF tool to extract a single page, a custom range, or burst the document into one PDF per page. You can also split by file size or by every N pages.",
  },
  {
    q: "Can I sign or fill PDF forms in the browser?",
    a: "Yes — Sign PDF, Fill Forms, Annotate, Stamp, Redact, and Add Signature tools all run locally so sensitive contracts never touch a remote server.",
  },
  {
    q: "Does Folio work on mobile?",
    a: "Yes. Folio is a responsive web app — it works on iPhone, iPad, Android, Windows, macOS, and Linux. Any modern browser will do.",
  },
  {
    q: "How is Folio different from iLovePDF, Smallpdf, or PDF24?",
    a: "Most online PDF tools upload your files to a server, gate features behind paywalls, or limit how many tasks you can run per day. Folio processes everything on your device, has no limits, no signup, and no watermark.",
  },
  {
    q: "Can I use Folio offline?",
    a: "After the first visit your browser may cache the app. For full offline support, install Folio as a PWA from your browser's address bar.",
  },
];

export const Route = createFileRoute("/faq")({
  head: () => {
    const title = "PDF Tools FAQ — Folio";
    const desc =
      "Answers to the most common questions about merging, splitting, compressing, converting and editing PDF files online for free with Folio.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        {
          name: "keywords",
          content:
            "pdf faq, free pdf tools, merge pdf online, compress pdf, convert pdf to word, pdf to jpg, edit pdf in browser, private pdf tool",
        },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: "/faq" },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: "/faq" }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        },
      ],
    };
  },
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 pt-16 pb-24">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Frequently asked
      </p>
      <h1 className="mt-3 font-display text-5xl leading-tight tracking-tight text-foreground sm:text-6xl">
        Free PDF tools, answered.
      </h1>
      <p className="mt-5 text-lg text-muted-foreground">
        Everything you might wonder about using Folio to merge, split, compress, convert, sign, and
        edit PDFs — privately, in your browser.
      </p>

      <div className="mt-10 space-y-4">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="group rounded-2xl border border-border bg-surface p-5 shadow-soft open:shadow-elevated"
          >
            <summary className="cursor-pointer list-none font-display text-xl tracking-tight text-foreground">
              {f.q}
            </summary>
            <p className="mt-3 leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>

      <div className="mt-12 rounded-[1.75rem] border border-border bg-surface p-6 shadow-soft">
        <h2 className="font-display text-2xl tracking-tight text-foreground">
          Ready to try a tool?
        </h2>
        <p className="mt-2 text-muted-foreground">
          Browse 88+ private, browser-native PDF tools — all free, all instant.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
        >
          See all tools
        </Link>
      </div>
    </div>
  );
}
