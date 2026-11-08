import { NextResponse } from "next/server";
import { requireStudioAdmin } from "@/lib/creative-studio/access";
import { lambdaLimits, remotionMissing, requestLimitRaise } from "@/lib/creative-studio/remotion";

export const maxDuration = 30;

/** The AWS account behind Remotion: its Lambda concurrency limit, account id and any request to raise it. */
export async function GET() {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  if (remotionMissing().length) return NextResponse.json({ connected: false });
  return NextResponse.json({ connected: true, ...(await lambdaLimits()) });
}

/** Ask AWS to raise the Lambda concurrency limit (the button on the video page). */
export async function POST() {
  const access = await requireStudioAdmin();
  if (!access.ok) return access.response;
  if (remotionMissing().length) return NextResponse.json({ error: "Remotion isn't connected yet." }, { status: 400 });
  const result = await requestLimitRaise();
  if (!result.ok) return NextResponse.json({ connected: true, ...result.limits, error: result.error }, { status: 400 });
  return NextResponse.json({ connected: true, ...result.limits });
}
