import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clientSurveys, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { getNexliAdminId } from "@/lib/foundation-project";
import {
  getSurveyByToken,
  isLowScore,
  isSurveyExpired,
  valueAnswerLabel,
  VALUE_ANSWERS,
  type ValueAnswer,
} from "@/lib/client-success";

// Public weekly pulse-check API. The token in the URL is the credential.
// Only the client's own answers are ever echoed back.

async function clientDisplayName(clientUserId: string): Promise<string> {
  const [u] = await db
    .select({ name: users.name, companyName: users.companyName, email: users.email })
    .from(users)
    .where(eq(users.id, clientUserId))
    .limit(1);
  return u?.name || u?.companyName || u?.email || "Client";
}

// GET — validate token, return state, stamp viewedAt
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const survey = await getSurveyByToken(token);
  if (!survey) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const submitted = Boolean(survey.submittedAt);
  if (!submitted && isSurveyExpired(survey)) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  if (!survey.viewedAt) {
    await db
      .update(clientSurveys)
      .set({ viewedAt: new Date() })
      .where(eq(clientSurveys.id, survey.id));
  }

  return NextResponse.json({
    clientName: await clientDisplayName(survey.clientUserId),
    weekStart: survey.weekStart,
    submitted,
    results: submitted
      ? {
          score: survey.resultsScore,
          valueAnswer: survey.valueAnswer,
          comment: survey.comment,
        }
      : null,
  });
}

// POST — submit answers (once)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const rate = checkRateLimit(`survey:${token}`, 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  const survey = await getSurveyByToken(token);
  if (!survey) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (survey.submittedAt) {
    return NextResponse.json({ error: "already_submitted" }, { status: 409 });
  }
  if (isSurveyExpired(survey)) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const score = Number(body.resultsScore);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return NextResponse.json({ error: "Pick a score from 1 to 5." }, { status: 400 });
  }
  const valueAnswer = body.valueAnswer;
  if (typeof valueAnswer !== "string" || !VALUE_ANSWERS.includes(valueAnswer as ValueAnswer)) {
    return NextResponse.json(
      { error: "Tell us whether you're getting what you pay for." },
      { status: 400 }
    );
  }
  const comment =
    typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) : "";

  const now = new Date();
  const low = isLowScore(score, valueAnswer);

  // Conditional on submittedAt still being null so a double-submit can't
  // overwrite the first answer.
  const updated = await db
    .update(clientSurveys)
    .set({
      resultsScore: score,
      valueAnswer,
      comment: comment || null,
      submittedAt: now,
      viewedAt: survey.viewedAt ?? now,
      ...(low ? { alertedAt: now } : {}),
    })
    .where(eq(clientSurveys.id, survey.id))
    .returning({ id: clientSurveys.id });
  if (updated.length === 0) {
    return NextResponse.json({ error: "already_submitted" }, { status: 409 });
  }

  // Tell Marcel. Never block the client's thank-you on notification plumbing.
  try {
    const adminId = await getNexliAdminId();
    if (adminId) {
      const clientName = await clientDisplayName(survey.clientUserId);
      const metadata = {
        surveyId: survey.id,
        clientUserId: survey.clientUserId,
        weekStart: survey.weekStart,
        score,
        valueAnswer,
        comment: comment || null,
      };
      await createNotification({
        userId: adminId,
        type: "survey_submitted",
        title: "Weekly pulse check answered",
        message: `${clientName} rated this week ${score}/5 — getting what they pay for: ${valueAnswerLabel(valueAnswer)}${comment ? ` — "${comment.slice(0, 160)}${comment.length > 160 ? "…" : ""}"` : ""}`,
        metadata,
      });
      if (low) {
        await createNotification({
          userId: adminId,
          type: "survey_low_score",
          title: "Low pulse-check score",
          message: `🚨 ${clientName} scored ${score}/5 and said they're ${valueAnswer === "no" ? "NOT" : valueAnswer === "somewhat" ? "only somewhat" : ""} getting what they pay for.${comment ? ` They wrote: "${comment.slice(0, 400)}${comment.length > 400 ? "…" : ""}"` : " No comment left — worth a call today."}`,
          metadata,
        });
      }
    }
  } catch (err) {
    console.error("Survey notification failed:", err);
  }

  return NextResponse.json({ ok: true, submittedAt: now.toISOString() });
}
