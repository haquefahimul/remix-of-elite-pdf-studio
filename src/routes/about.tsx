import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => {
    const title = "About Folio — Private, Browser-Native PDF Tools";
    const desc =
      "Folio is a privacy-first, browser-native PDF toolkit. 88+ free tools that run entirely on your device — no uploads, no signup, no limits.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: "/about" },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: "/about" }],
    };
  },
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 pt-16 pb-24">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        About
      </p>
      <h1 className="mt-3 font-display text-5xl leading-tight tracking-tight text-foreground sm:text-6xl">
        A kinder PDF toolkit.
      </h1>
      <div className="prose prose-neutral mt-8 max-w-none space-y-6 text-base leading-relaxed text-muted-foreground">
        <p>
          For years, working with PDFs has meant uploading sensitive documents to strangers'
          servers, watching progress bars, dodging watermarks, and bumping into daily limits.
          Folio is the alternative: every tool you need, running entirely inside your browser.
        </p>
        <p>
          We use modern web technology — WebAssembly, pdf-lib, pdf.js, the Canvas API — to do all
          the heavy lifting on your own device. Your contracts, payslips, and family photos never
          touch a server. There's nothing to delete because nothing was ever uploaded.
        </p>
        <p>
          Folio is free, unlimited, and signup-free, on purpose. It's a tool, not a funnel.
        </p>
      </div>
    </div>
  );
}
