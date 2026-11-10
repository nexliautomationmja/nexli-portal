"use client";

import { MessagesSquare } from "lucide-react";
import { GradientText, PageColumn, PageHero, RainmakerCanvas, ThreadLayout } from "@/components/rainmaker";
import { MessageThread } from "@/components/messages/message-thread";

/**
 * A DRS/Foundation firm's thread with the Nexli team: weekly updates, text
 * and voice notes, with replies by text or voice.
 */
export function NexliMessagesClient() {
  return (
    <RainmakerCanvas fill>
      <PageColumn width="thread" fill>
        {/* Phones give the thread the whole screen. */}
        <div className="hidden md:block">
          <PageHero
            size="compact"
            pill={{ icon: <MessagesSquare className="h-4 w-4 text-cyan-300" aria-hidden="true" />, label: "Nexli Team" }}
            title={
              <>
                Your <GradientText>Nexli team.</GradientText>
              </>
            }
          />
        </div>
        <ThreadLayout showThread>
          <MessageThread
            fetchUrl="/api/dashboard/nexli-messages"
            postUrl="/api/dashboard/nexli-messages"
            voiceUrl="/api/dashboard/nexli-messages/voice"
            mineSide="client"
            title="Nexli Team"
            subtitle="Your updates and messages from the Nexli team — reply anytime by text or voice."
            theirLabel="Nexli Team"
            emptyText="No messages yet. Say hello — type a message or record a voice note."
          />
        </ThreadLayout>
      </PageColumn>
    </RainmakerCanvas>
  );
}
