import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-12 text-sm text-muted-foreground md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden md:inline">— private, unlimited PDF tools.</span>
          </div>
          <p className="max-w-sm text-xs">
            Free online PDF editor — merge, split, compress, convert, and sign PDFs in your
            browser. Files never leave your device.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <Link to="/" className="transition-colors hover:text-foreground">
            All tools
          </Link>
          <Link to="/about" className="transition-colors hover:text-foreground">
            About
          </Link>
          <Link to="/faq" className="transition-colors hover:text-foreground">
            FAQ
          </Link>
          <a href="/sitemap.xml" className="transition-colors hover:text-foreground">
            Sitemap
          </a>
        </nav>
        <p className="text-xs">© {new Date().getFullYear()} Folio. Files never leave your device.</p>
      </div>
    </footer>
  );
}
