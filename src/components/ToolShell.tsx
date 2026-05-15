import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, LockKeyhole, Zap } from "lucide-react";
import type { Tool } from "@/lib/tools";

export function ToolShell({
  tool,
  children,
}: {
  tool: Tool;
  children: ReactNode;
}) {
  const Icon = tool.icon;
  return (
    <div className="mx-auto max-w-6xl px-6 pt-8 pb-24">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All tools
      </Link>

      <header className="mt-6 overflow-hidden rounded-[2rem] border border-border bg-surface shadow-soft">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_18rem] lg:items-end">
          <div className="flex items-start gap-5">
            <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${tool.accentSoft}`}>
              <Icon className={`h-6 w-6 ${tool.accent}`} strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Private browser tool
              </p>
              <h1 className="mt-2 font-display text-4xl tracking-tight text-foreground sm:text-6xl">
                {tool.name}
              </h1>
              <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">{tool.description}</p>
            </div>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-2">
              <LockKeyhole className="h-4 w-4 text-success" /> On-device processing
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-2">
              <Zap className="h-4 w-4 text-tool-rotate" /> Instant local export
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-2">
              <BadgeCheck className="h-4 w-4 text-tool-merge" /> No watermark
            </span>
          </div>
        </div>
      </header>

      <div className="mt-10">{children}</div>
    </div>
  );
}
