"use client";

import { MessageSquareText, PlugZap } from "lucide-react";
import {
  Button,
  ButtonLink,
  GradientText,
  List,
  ListRow,
  Notice,
  PageColumn,
  PageHero,
  RainmakerCanvas,
  Skeleton,
  ThreadLayout,
  ThreadListHeader,
} from "@/components/rainmaker";
import { convoName, lastActivity, timeAgo, type GhlConversation, type ListState } from "./messages-types";

export interface MessagesViewProps {
  state: ListState;
  conversations: GhlConversation[];
  selected: string | null;
  /** For "5m / 3h" (passed in so fixtures render the same every time). */
  now: number;
  onSelect: (id: string) => void;
  onRetry: () => void;
  /** The open conversation (ThreadView, drawn by the container). */
  thread: React.ReactNode;
}

const initials = (c: GhlConversation) => {
  const parts = convoName(c).replace(/^Contact\s+/, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

function ConversationList(p: MessagesViewProps) {
  return (
    <>
      <ThreadListHeader title="Conversations" count={p.state === "ready" ? p.conversations.length : undefined} />
      <div className="cs-scroll min-h-0 flex-1 overflow-y-auto">
        {p.state === "loading" ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : p.state === "disconnected" ? (
          <div className="px-6 py-10 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/15 text-cyan-300">
              <PlugZap className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-semibold text-white">Connect GoHighLevel</p>
            <p className="mt-1 text-xs text-neutral-400">Add your Location ID in Settings and your text conversations show up here.</p>
            <ButtonLink href="/dashboard/settings" variant="primary" size="sm" className="mt-4">
              Open Settings
            </ButtonLink>
          </div>
        ) : p.state === "error" ? (
          <div className="p-3">
            <Notice
              tone="error"
              title="Couldn't reach GoHighLevel"
              action={
                <Button size="sm" onClick={p.onRetry}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : !p.conversations.length ? (
          <div className="px-6 py-12 text-center text-sm text-neutral-400">No conversations yet. New texts from leads land here.</div>
        ) : (
          <List className="rounded-none border-0 bg-transparent">
            {p.conversations.map((c) => (
              <ListRow
                key={c.id}
                onClick={() => p.onSelect(c.id)}
                selected={p.selected === c.id}
                icon={<span className="text-[11px] font-bold">{initials(c)}</span>}
                tone="blue"
                title={convoName(c)}
                right={<span className="text-[10px] text-neutral-400">{timeAgo(lastActivity(c), p.now)}</span>}
              />
            ))}
          </List>
        )}
      </div>
    </>
  );
}

export function MessagesView(p: MessagesViewProps) {
  return (
    <RainmakerCanvas fill>
      <PageColumn fill>
        {/* Below lg an open conversation gets the whole screen. */}
        <div className={p.selected ? "hidden lg:block" : undefined}>
          <PageHero
            size="compact"
            pill={{ icon: <MessageSquareText className="h-4 w-4 text-cyan-300" aria-hidden="true" />, label: "Messages" }}
            title={
              <>
                Every text, <GradientText>answered.</GradientText>
              </>
            }
            sub="Your GoHighLevel text conversations. Replies go out by SMS."
          />
        </div>
        <ThreadLayout showThread={Boolean(p.selected)} list={<ConversationList {...p} />}>
          {p.selected ? (
            p.thread
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/15 text-cyan-300">
                <MessageSquareText className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold text-white">Pick a conversation</p>
              <p className="mt-1 text-xs text-neutral-400">The texts show up here, and you can reply by SMS.</p>
            </div>
          )}
        </ThreadLayout>
      </PageColumn>
    </RainmakerCanvas>
  );
}
