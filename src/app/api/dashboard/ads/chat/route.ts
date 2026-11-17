import { NextRequest, NextResponse } from "next/server";
import { requireAdsAdmin } from "@/lib/ads/access";
import { ChatConflict, chatById, chatView, latestChat, newChat, runChatTurn } from "@/lib/ads/chat";
import { listChanges } from "@/lib/ads/corrections";
import { CHAT_MAX_MESSAGE, type ChatEvent } from "@/lib/ads/chat-shared";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** GET (?id=) → the latest Ask chat (or that one) and the changes it can show. */
export async function GET(req: NextRequest) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ configured: false });
  const id = req.nextUrl.searchParams.get("id");
  const [row, changes] = await Promise.all([
    id ? chatById(access.ownerId, access.accountId, id) : latestChat(access.ownerId, access.accountId),
    listChanges(access.ownerId, access.accountId),
  ]);
  return NextResponse.json({ configured: true, chat: row ? chatView(row) : null, changes });
}

/**
 * POST { action: "new" } → a fresh chat.
 * POST { chatId?, message } → Claude's answer, streamed as NDJSON (one event a line).
 * Keeps going (and saves) if the page closes mid-answer.
 */
export async function POST(req: NextRequest) {
  const access = await requireAdsAdmin();
  if (!access.ok) return access.response;
  if (!access.accountId) return NextResponse.json({ error: "Meta ads aren't connected." }, { status: 400 });
  const { ownerId, accountId, actorId } = { ownerId: access.ownerId, accountId: access.accountId, actorId: access.actorId };
  const body = ((await req.json().catch(() => null)) ?? {}) as { action?: unknown; chatId?: unknown; message?: unknown };

  if (body.action === "new") {
    const row = await newChat(ownerId, accountId, actorId);
    return NextResponse.json({ chat: chatView(row) });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Type a question first." }, { status: 400 });
  if (message.length > CHAT_MAX_MESSAGE) return NextResponse.json({ error: `Keep it under ${CHAT_MAX_MESSAGE.toLocaleString()} characters.` }, { status: 400 });
  const chat =
    (typeof body.chatId === "string" ? await chatById(ownerId, accountId, body.chatId) : await latestChat(ownerId, accountId)) ?? (await newChat(ownerId, accountId, actorId));

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (e: ChatEvent) => {
        if (!open) return;
        try {
          controller.enqueue(enc.encode(`${JSON.stringify(e)}\n`));
        } catch {
          open = false; // the page went away — the answer still finishes and is saved
        }
      };
      const ping = setInterval(() => send({ t: "ping" }), 15_000);
      send({ t: "chat", id: chat.id });
      try {
        await runChatTurn({ ownerId, accountId, actorId, chat, message, emit: send });
      } catch (err) {
        const msg = err instanceof ChatConflict || (err instanceof Error && /chat is full|connected/.test(err.message)) ? (err as Error).message : "Couldn't answer right now — try again in a moment.";
        console.error("[ads chat] failed:", err instanceof Error ? err.message : err);
        send({ t: "error", message: msg });
      } finally {
        clearInterval(ping);
        if (open) {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
