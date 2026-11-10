"use client";

import { useEffect, useState } from "react";
import { ContactsView } from "./contacts-view";
import { contactsUrl, stateOf, type Contact, type ContactsResponse } from "./contacts-types";

/** GoHighLevel contacts: loads and searches them; ContactsView draws the page. */
export function ContactsClient() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<{ key: string; data: ContactsResponse | null; failed: boolean } | null>(null);
  const [open, setOpen] = useState<Contact | null>(null);

  // Search 300 ms after typing stops.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // One request per search (and per "Try again"); a newer one cancels the last.
  const key = `${search}\n${tick}`;
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(contactsUrl(search), { signal: ctrl.signal })
      .then(async (r) => {
        const data = (await r.json().catch(() => null)) as ContactsResponse | null;
        if (!r.ok || !data) throw new Error(String(r.status));
        setResult({ key, data, failed: false });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setResult({ key, data: null, failed: true });
      });
    return () => ctrl.abort();
  }, [key, search]);

  const current = result?.key === key ? result : null;
  // While a search runs, the last good results stay on screen with a spinner
  // (after a failure, "Try again" shows the loading state instead).
  const shown = current ?? (result && !result.failed ? result : null);
  const state = shown ? stateOf(shown.data, shown.failed) : "loading";

  return (
    <ContactsView
      state={state}
      contacts={shown?.data?.contacts ?? []}
      total={shown?.data?.total ?? 0}
      query={query}
      searching={Boolean(result) && (!current || query.trim() !== search)}
      locationId={shown?.data?.locationId ?? null}
      open={open}
      onQuery={setQuery}
      onOpen={setOpen}
      onClose={() => setOpen(null)}
      onRetry={() => setTick((t) => t + 1)}
    />
  );
}
