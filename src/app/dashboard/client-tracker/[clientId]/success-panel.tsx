"use client";

import { ArrowUpRight, HeartPulse } from "lucide-react";
import { Chip, EmptyState, Inset, StatusDot, Surface } from "@/components/rainmaker";
import { SCALE_QUESTION_IDS, scaleQuestionLabel, valueAnswerLabel } from "@/lib/survey-questions";
import { npsHeader, npsTone, scaleTone, shortDate, surveyExpired, weekLabel } from "./detail-status";
import type { NpsStatusItem, SurveyItem } from "./detail-types";

/** The every-other-Monday pulse check: where it stands now, then every survey with its answers. */
export function SuccessPanel({ surveys, status }: { surveys: SurveyItem[]; status: NpsStatusItem | null }) {
  const header = npsHeader(status);
  return (
    <Surface className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <Chip tone={header.tone} dot>
          {header.label}
        </Chip>
        <div className="flex items-center gap-3 text-[11px] text-neutral-400">
          <span>Every other Monday</span>
          <a href="/survey/preview" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 font-semibold text-cyan-300 hover:underline">
            Preview the survey <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
      </div>
      {surveys.length === 0 ? (
        <div className="p-4">
          <EmptyState icon={<HeartPulse className="h-5 w-5" aria-hidden="true" />} title="No responses yet" body="Surveys go out every other Monday." />
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {surveys.map((s) => {
            const answered = Boolean(s.submittedAt);
            const isNps = answered && s.npsScore != null;
            const isLegacy = answered && !isNps && s.legacyScore != null;
            const expired = !answered && surveyExpired(s.expiresAt);
            const tone = isNps ? npsTone(s.npsScore as number) : isLegacy ? scaleTone(s.legacyScore as number) : expired ? "amber" : "neutral";
            const rated = SCALE_QUESTION_IDS.filter((id) => typeof s.answers?.[id] === "number");
            const headline = isNps
              ? `NPS ${s.npsScore}`
              : isLegacy
                ? `${s.legacyScore}/5 (older survey)`
                : answered
                  ? "Answered"
                  : !s.sentAt
                    ? "Not sent"
                    : expired
                      ? "Expired, no answer"
                      : "Waiting for an answer";
            const when = answered ? `answered ${shortDate(s.submittedAt)}` : s.sentAt ? `sent ${shortDate(s.sentAt)}${s.viewedAt ? " · opened" : ""}` : "not sent";
            return (
              <div key={s.id} className="flex items-start gap-3 px-4 py-3.5">
                <StatusDot tone={tone} className="mt-1.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <div className="text-sm font-semibold text-white">
                      {headline}
                      {(isNps || isLegacy) && s.valueAnswer && <span className="font-normal text-neutral-300"> · Getting value: {valueAnswerLabel(s.valueAnswer)}</span>}
                    </div>
                    <span className="text-[11px] text-neutral-400">
                      Week of {weekLabel(s.weekStart)} · {when}
                    </span>
                  </div>
                  {rated.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {rated.map((id) => (
                        <Chip key={id} tone={scaleTone(s.answers?.[id] as number)} size="xs">
                          {scaleQuestionLabel(id)} {s.answers?.[id]}
                        </Chip>
                      ))}
                    </div>
                  )}
                  {s.comment && <Inset className="mt-2 whitespace-pre-wrap px-3 py-2 text-sm italic text-neutral-200">&ldquo;{s.comment}&rdquo;</Inset>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Surface>
  );
}
