"use client";

import { MessageThread } from "@/components/messages/message-thread";

/**
 * A DRS/Foundation firm's thread with the Nexli team: weekly updates, text
 * and voice notes, with replies by text or voice.
 */
export function NexliMessagesClient() {
  return (
    <div className="max-w-3xl mx-auto glass-card overflow-hidden h-[calc(100dvh-88px)] md:h-[calc(100dvh-48px)]">
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
    </div>
  );
}
