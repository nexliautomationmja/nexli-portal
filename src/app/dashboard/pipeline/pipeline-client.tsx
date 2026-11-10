"use client";

import { useCallback, useEffect, useState } from "react";
import { Toast, useToast } from "@/components/rainmaker";
import { PipelineView } from "./pipeline-view";
import { AddLeadSheet, type ContactsState } from "./add-lead-sheet";
import {
  EMPTY_KPIS,
  addLeadBody,
  contactName,
  contactSearchUrl,
  emptyForm,
  parseDollars,
  type ContactResult,
  type Lead,
  type LeadForm,
  type PipelineResponse,
  type Stage,
} from "./pipeline-types";

/** The DRS pipeline: loads it and runs every action; PipelineView draws the board. */
export function PipelineClient() {
  const [data, setData] = useState<PipelineResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Stage>("open");
  const { toast, showToast } = useToast();

  // Add-lead sheet
  const [adding, setAdding] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<LeadForm>(emptyForm);
  const [addError, setAddError] = useState<string | null>(null);
  const [picked, setPicked] = useState<ContactResult | null>(null);
  const [contactQuery, setContactQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [contactResult, setContactResult] = useState<{ key: string; list: ContactResult[]; state: ContactsState } | null>(null);

  /** Reload the board. The first load shows the error state; later ones only a toast. */
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/pipeline");
      const body = (await res.json().catch(() => null)) as PipelineResponse | null;
      if (!res.ok || !body) throw new Error(String(res.status));
      setData(body);
      setState("ready");
      return true;
    } catch {
      setState((s) => (s === "ready" ? s : "error"));
      return false;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Contact search in the sheet: 300 ms after typing stops; a newer one cancels the last.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(contactQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [contactQuery]);
  useEffect(() => {
    if (!addOpen) return;
    const ctrl = new AbortController();
    const key = debounced;
    fetch(contactSearchUrl(debounced), { signal: ctrl.signal })
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as { contacts?: ContactResult[]; connected?: boolean; error?: string } | null;
        if (!r.ok || !body) throw new Error(String(r.status));
        setContactResult({
          key,
          list: body.contacts ?? [],
          state: body.connected === false ? "disconnected" : body.error ? "error" : "ready",
        });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setContactResult({ key, list: [], state: "error" });
      });
    return () => ctrl.abort();
  }, [addOpen, debounced]);
  const contactsCurrent = contactResult?.key === debounced && contactQuery.trim() === debounced;

  async function change(lead: Lead, body: Record<string, unknown>, failMessage: string) {
    setBusyId(lead.id);
    try {
      const res = await fetch(`/api/dashboard/pipeline/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || failMessage, "error");
        return;
      }
      if (!(await load())) showToast("Saved, but the board didn't refresh. Reload the page.", "error");
    } catch {
      showToast(failMessage, "error");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(lead: Lead) {
    if (!confirm(`Remove ${lead.name} from the pipeline?`)) return;
    setBusyId(lead.id);
    try {
      const res = await fetch(`/api/dashboard/pipeline/${lead.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || `Couldn't remove ${lead.name}. Try again.`, "error");
        return;
      }
      await load();
      showToast(`${lead.name} removed`);
    } catch {
      showToast(`Couldn't remove ${lead.name}. Try again.`, "error");
    } finally {
      setBusyId(null);
    }
  }

  function closeAdd() {
    setAddOpen(false);
    setPicked(null);
    setContactQuery("");
    setAddError(null);
  }

  async function addLead() {
    if (!form.name.trim()) {
      setAddError("Please give the lead a name.");
      return;
    }
    const cents = parseDollars(form.value);
    if (cents === null) {
      setAddError("Deal value must be a number.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/dashboard/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addLeadBody(form, cents, picked?.id ?? null)),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAddError(err.error || "Couldn't add the lead. Please try again.");
        return;
      }
      const name = form.name.trim();
      closeAdd();
      setForm(emptyForm());
      setTab("open");
      await load();
      showToast(`${name} added to the pipeline 🚀`, "success");
    } catch {
      setAddError("Couldn't add the lead. Check your connection and try again.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <PipelineView
        state={state}
        leads={data?.leads ?? []}
        kpis={data?.kpis ?? EMPTY_KPIS}
        ghlLocationId={data?.ghlLocationId ?? null}
        busyId={busyId}
        tab={tab}
        onTab={setTab}
        onAdd={() => setAddOpen(true)}
        onStage={(lead, stage) => change(lead, { stage }, `Couldn't move ${lead.name}. Try again.`)}
        onValue={(lead, cents) => change(lead, { valueCents: cents }, `Couldn't save the new value for ${lead.name}. Try again.`)}
        onDelete={remove}
        onRetry={() => {
          setState("loading");
          void load();
        }}
        addSheet={
          <AddLeadSheet
            open={addOpen}
            form={form}
            onForm={setForm}
            contactQuery={contactQuery}
            onContactQuery={setContactQuery}
            contacts={contactResult?.list ?? []}
            contactsState={contactsCurrent && contactResult ? contactResult.state : "searching"}
            picked={picked}
            onPick={(c) => {
              setPicked(c);
              setForm((f) => ({ ...f, name: contactName(c), email: c.email || "", phone: c.phone || "" }));
            }}
            onUnpick={() => setPicked(null)}
            adding={adding}
            error={addError}
            onSubmit={addLead}
            onClose={closeAdd}
          />
        }
      />
      <Toast toast={toast} />
    </>
  );
}
