import { Outlet, createRootRoute, HeadContent, Link, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="font-display text-7xl tracking-tight text-foreground">404</p>
        <h2 className="mt-4 text-xl font-medium text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for has wandered off.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
          >
            Back to tools
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Folio — Free Online PDF Tools, 100% Private & In Your Browser" },
      {
        name: "description",
        content:
          "88+ free PDF tools: merge, split, compress, convert PDF to Word/Excel/JPG, sign, edit, OCR, redact, and more. No upload, no signup, no watermark — runs entirely in your browser.",
      },
      {
        name: "keywords",
        content:
          "free pdf tools, merge pdf, split pdf, compress pdf, pdf to word, pdf to jpg, pdf to excel, edit pdf online, sign pdf, pdf editor, online pdf, no upload pdf, private pdf, browser pdf tools",
      },
      { name: "author", content: "Folio" },
      { name: "robots", content: "index, follow" },
      { name: "theme-color", content: "#0a0a0a" },
      { property: "og:site_name", content: "Folio" },
      { property: "og:title", content: "Folio — Free Online PDF Tools, 100% Private" },
      {
        property: "og:description",
        content:
          "Elite PDF tools that run entirely on your device. Free, fast, private — no uploads, no limits, no signup.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Folio — Free Online PDF Tools" },
      {
        name: "twitter:description",
        content: "88+ private, browser-native PDF tools. Free, fast, no signup.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Folio",
          description:
            "Free, private, browser-native PDF tools. Merge, split, compress, convert, sign, and edit PDFs without uploading.",
          publisher: {
            "@type": "Organization",
            name: "Folio",
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
      <Toaster position="bottom-center" richColors closeButton />
    </div>
  );
}
