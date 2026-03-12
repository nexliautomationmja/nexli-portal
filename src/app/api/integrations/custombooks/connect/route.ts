import { NextResponse } from "next/server";
import { auth } from "@/auth";
import crypto from "crypto";
import { getCustomBooksAuthUrl } from "@/lib/custombooks";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // State encodes userId for callback verification
  const state = Buffer.from(
    JSON.stringify({
      userId: session.user.id,
      nonce: crypto.randomBytes(16).toString("hex"),
    })
  ).toString("base64url");

  const url = getCustomBooksAuthUrl(state);
  return NextResponse.redirect(url);
}
