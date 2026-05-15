import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <Link to="/" activeOptions={{ exact: true }} className="transition-colors hover:text-foreground" activeProps={{ className: "text-foreground" }}>
            Tools
          </Link>
          <Link to="/about" className="transition-colors hover:text-foreground" activeProps={{ className: "text-foreground" }}>
            About
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success" /> On-device
          </span>
        </div>
      </div>
    </header>
  );
}
