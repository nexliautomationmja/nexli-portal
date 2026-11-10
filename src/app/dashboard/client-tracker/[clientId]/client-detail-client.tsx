"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { ButtonLink, EmptyState, PageColumn, RainmakerCanvas, Skeleton, useHashScroll } from "@/components/rainmaker";
import { DetailView } from "./detail-view";
import type { DetailData } from "./detail-types";

/** One client's dashboard, as Marcel sees it: loads it, keeps local edits; DetailView draws it. */
export function ClientDetailClient({ clientId }: { clientId: string }) {
  const [data, setData] = useState<DetailData | null>(null);
  const [errored, setErrored] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`/api/dashboard/client-tracker/${clientId}`)
      .then((r) => {
        if (!r.ok) throw new Error("load_failed");
        return r.json();
      })
      .then((d) => {
        if (alive) {
          setData(d);
          setErrored(false);
        }
      })
      .catch(() => alive && setErrored(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [clientId, attempt]);

  useHashScroll(Boolean(data));

  if (loading || errored || !data) {
    return (
      <RainmakerCanvas>
        <PageColumn>
          {loading ? (
            <div className="space-y-4 pt-10" aria-busy="true" aria-label="Loading this client's dashboard">
              <Skeleton className="mx-auto h-8 w-48 rounded-full" />
              <Skeleton className="mx-auto h-12 w-3/4" />
              <div className="grid grid-cols-2 gap-3 pt-6 lg:grid-cols-4">
                <Skeleton className="col-span-2 h-36" />
                <Skeleton className="h-36" />
                <Skeleton className="h-36" />
              </div>
              <Skeleton className="h-64" />
            </div>
          ) : (
            <div className="pt-16">
              <EmptyState
                tone="red"
                icon={<CircleAlert className="h-5 w-5" aria-hidden="true" />}
                title="Couldn't load this client's dashboard"
                body="The connection may have dropped, or this client was removed."
                action={
                  <>
                    <ButtonLink href="/dashboard/client-tracker">
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      Client tracker
                    </ButtonLink>
                    <button
                      type="button"
                      onClick={() => {
                        setLoading(true);
                        setAttempt((a) => a + 1);
                      }}
                      className="inline-flex min-h-11 items-center rounded-full bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-500"
                    >
                      Try again
                    </button>
                  </>
                }
              />
            </div>
          )}
        </PageColumn>
      </RainmakerCanvas>
    );
  }

  return (
    <DetailView
      data={data}
      onWebsiteSaved={(url) => setData((prev) => (prev ? { ...prev, client: { ...prev.client, websiteUrl: url } } : prev))}
      onUpdatesChange={(updates) => setData((prev) => (prev ? { ...prev, weeklyUpdates: updates } : prev))}
    />
  );
}
