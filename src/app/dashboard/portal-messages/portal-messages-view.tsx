"use client";

import { MessageSquare, MessagesSquare, Mic, Newspaper } from "lucide-react";
import {
  Button,
  Chip,
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
import { previewOf, timeAgo, type Conversation } from "./portal-messages-types";

export interface PortalMessagesViewProps {
  state: "loading" | "ready" | "error";
  /** The list, including a "New conversation" row for a deep-linked client with no messages yet. */
  conversations: Conversation[];
  /** Real conversations (without that placeholder row). */
  count: number;
  selected: string | null;
  /** For "Just now / 5m / 3h" (passed in so fixtures render the same every time). */
  now: number;
  onSelect: (email: string | null) => void;
  onRetry: () => void;
  /** The open conversation (its own container: MessageThread). */
  thread: React.ReactNode;
}

const KIND_ICON = {
  voice: <Mic className="h-4 w-4" aria-hidden="true" />,
  weekly_update: <Newspaper className="h-4 w-4" aria-hidden="true" />,
  text: <MessageSquare className="h-4 w-4" aria-hidden="true" />,
} as const;

function ConversationList(p: PortalMessagesViewProps) {
  return (
    <>
      <ThreadListHeader title="Clients" count={p.count} />
      <div className="cs-scroll min-h-0 flex-1 overflow-y-auto">
        {p.state === "loading" ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : p.state === "error" && !p.conversations.length ? (
          <div className="p-3">
            <Notice
              tone="error"
              title="Couldn't load your conversations"
              action={
                <Button size="sm" onClick={p.onRetry}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : !p.conversations.length ? (
          <div className="px-6 py-12 text-center text-sm text-neutral-400">
            No client messages yet. Open a client from Clients to start a conversation.
          </div>
        ) : (
          <List className="rounded-none border-0 bg-transparent">
            {p.conversations.map((c) => (
              <ListRow
                key={c.clientEmail}
                onClick={() => p.onSelect(c.clientEmail)}
                selected={p.selected === c.clientEmail}
                icon={KIND_ICON[c.lastKind ?? "text"]}
                tone={c.unreadCount > 0 ? "cyan" : "neutral"}
                title={c.clientEmail}
                sub={previewOf(c)}
                right={
                  <span className="flex flex-col items-end gap-1">
                    <span className="text-[10px] text-neutral-400">{timeAgo(c.lastMessageAt, p.now)}</span>
                    {c.unreadCount > 0 && (
                      <Chip tone="cyan" size="xs">
                        {c.unreadCount} new
                      </Chip>
                    )}
                  </span>
                }
              />
            ))}
          </List>
        )}
      </div>
    </>
  );
}

export function PortalMessagesView(p: PortalMessagesViewProps) {
  return (
    <RainmakerCanvas fill>
      <PageColumn fill>
        {/* Below lg an open conversation gets the whole screen. */}
        <div className={p.selected ? "hidden lg:block" : undefined}>
          <PageHero
            size="compact"
            pill={{ icon: <MessagesSquare className="h-4 w-4 text-cyan-300" aria-hidden="true" />, label: "Client Messages" }}
            title={
              <>
                Talk to your <GradientText>clients.</GradientText>
              </>
            }
            sub="Text and voice notes with your clients, all in one thread each."
          />
        </div>
        <ThreadLayout showThread={Boolean(p.selected)} list={<ConversationList {...p} />}>
          {p.selected ? (
            p.thread
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/15 text-cyan-300">
                <MessagesSquare className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold text-white">Pick a conversation</p>
              <p className="mt-1 text-xs text-neutral-400">Messages and voice notes show up here.</p>
            </div>
          )}
        </ThreadLayout>
      </PageColumn>
    </RainmakerCanvas>
  );
}
