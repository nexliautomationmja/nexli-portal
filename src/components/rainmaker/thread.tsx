"use client";

import { Surface } from "./surfaces";

/**
 * Inbox + conversation in one framed surface that fills the rest of the
 * column. From lg (the sidebar leaves room) the list sits left of the thread;
 * below lg one pane shows at a time — the list until a conversation is open
 * (`showThread`), then the thread (which shows its own back button). Without
 * a `list` it's a single pane.
 */
export function ThreadLayout({
  list,
  showThread,
  children,
  className = "",
}: {
  list?: React.ReactNode;
  showThread: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Surface elevated className={`flex min-h-0 flex-1 overflow-hidden ${className}`}>
      {list && (
        <div className={`${showThread ? "hidden lg:flex" : "flex"} w-full min-h-0 flex-col lg:w-80 lg:shrink-0 lg:border-r lg:border-white/10 xl:w-96`}>
          {list}
        </div>
      )}
      <div className={`${list && !showThread ? "hidden lg:flex" : "flex"} min-h-0 min-w-0 flex-1 flex-col`}>{children}</div>
    </Surface>
  );
}

/** The list pane's top line: title + count, and an optional action. */
export function ThreadListHeader({ title, count, right }: { title: React.ReactNode; count?: number; right?: React.ReactNode }) {
  return (
    <div className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-sm font-bold text-white">{title}</span>
        {count != null && <span className="text-xs text-neutral-400">{count}</span>}
      </div>
      {right}
    </div>
  );
}
