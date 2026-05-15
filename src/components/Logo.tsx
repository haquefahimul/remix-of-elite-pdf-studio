import { Link } from "@tanstack/react-router";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`group inline-flex items-center gap-2 ${className}`}>
      <span className="relative grid h-9 w-9 place-items-center rounded-[12px] bg-foreground text-background shadow-soft transition-transform group-hover:-rotate-6">
        <svg viewBox="0 0 28 28" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 4.5h8.8L21 8.7v14.8H8z" />
          <path d="M16.8 4.5v4.2H21" />
          <path d="M11.4 13.2h6.4" />
          <path d="M11.4 17h4.6" />
        </svg>
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-tool-merge" />
      </span>
      <span className="font-display text-2xl tracking-tight text-foreground">
        Folio
      </span>
    </Link>
  );
}
