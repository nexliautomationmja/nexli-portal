import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pageViews } from "@/db/schema";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json(null, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, pageUrl, referrer, userAgent, sessionId } = body;

    if (!clientId || !pageUrl || !sessionId) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400, headers: corsHeaders }
      );
    }

    const country = req.headers.get("x-vercel-ip-country") || "Unknown";
    const deviceType = parseDeviceType(userAgent || "");

    await db.insert(pageViews).values({
      clientId,
      pageUrl,
      referrer: referrer || null,
      userAgent: userAgent || null,
      country,
      deviceType,
      sessionId,
    });

    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

function parseDeviceType(ua: string): string {
  if (/tablet|ipad/i.test(ua)) return "tablet";
  if (/mobile|iphone|android.*mobile/i.test(ua)) return "mobile";
  return "desktop";
}
