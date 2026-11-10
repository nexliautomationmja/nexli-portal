"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Toast, useToast } from "@/components/rainmaker";
import { MercuryPanel } from "@/components/dashboard/mercury-panel";
import type { OwnerBranding } from "@/lib/branding";
import { InvoicesView } from "./invoices-view";
import { InvoiceSheet, type SheetView } from "./invoice-sheet";
import { ComposeSheet } from "./compose-sheet";
import { BatchSheet } from "./batch-sheet";
import {
  batchBody,
  batchProblem,
  blankDraft,
  blankLine,
  blankOptions,
  blankRecipient,
  createBody,
  draftProblem,
  type ClientHistory,
  type DraftLine,
  type Invoice,
  type InvoiceDraft,
  type InvoiceOptions,
  type InvoicesResponse,
  type Recipient,
} from "./invoice-types";

type PageNotice = { tone: "info" | "warn" | "error" | "success"; text: React.ReactNode } | null;

async function errorText(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return (data && typeof data.error === "string" && data.error) || fallback;
}

const NO_PAYMENTS = "It went out, but online payments aren't set up yet, so the client can't pay it online. Connect payments in Settings.";

/** Invoices: loads them and runs every action; InvoicesView and the sheets draw the page. */
export function InvoicesClient() {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [firm, setFirm] = useState({ name: "", company: "" });
  const [branding, setBranding] = useState<OwnerBranding | undefined>(undefined);
  const [origin, setOrigin] = useState("");
  const [pageNotice, setPageNotice] = useState<PageNotice>(null);

  // The invoice sheet
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<SheetView>("invoice");
  const [history, setHistory] = useState<{ state: "loading" | "ready" | "error"; data: ClientHistory | null }>({ state: "loading", data: null });
  const [busy, setBusy] = useState<null | "send" | "void" | "delete">(null);
  const [sheetNotice, setSheetNotice] = useState<PageNotice>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  // New invoice (kept until it's saved, even if the sheet is closed)
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState<InvoiceDraft>(blankDraft);
  const [composeMode, setComposeMode] = useState<"details" | "preview">("details");
  const [composeBusy, setComposeBusy] = useState<null | "draft" | "send">(null);
  const [composeError, setComposeError] = useState<string | null>(null);

  // Batch invoice
  const [batchOpen, setBatchOpen] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>(() => [blankRecipient()]);
  const [batchLines, setBatchLines] = useState<DraftLine[]>(() => [blankLine()]);
  const [batchOptions, setBatchOptions] = useState<InvoiceOptions>(blankOptions);
  const [batchBusy, setBatchBusy] = useState<null | "draft" | "send">(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  /** Reload the list; resolves the fresh list (null when it failed). */
  const reload = useCallback(async (): Promise<Invoice[] | null> => {
    try {
      const res = await fetch("/api/dashboard/invoices");
      const data = (await res.json().catch(() => null)) as InvoicesResponse | null;
      if (!res.ok || !data) throw new Error(String(res.status));
      const list = data.invoices ?? [];
      setInvoices(list);
      if (data.from) setFirm(data.from);
      if (data.branding) setBranding(data.branding);
      setState("ready");
      return list;
    } catch {
      setState((s) => (s === "ready" ? s : "error"));
      return null;
    }
  }, []);

  // First load; /dashboard/invoices?id=… opens that invoice (Clients page, Launch Pad billing).
  useEffect(() => {
    setOrigin(window.location.origin);
    void reload().then((list) => {
      const id = new URLSearchParams(window.location.search).get("id");
      if (!id || !list) return;
      if (list.some((i) => i.id === id)) {
        setOpenId(id);
        setView("invoice");
      } else {
        setPageNotice({ tone: "warn", text: "That invoice wasn't found. It may have been deleted." });
      }
    });
  }, [reload]);

  const openInvoice = invoices.find((i) => i.id === openId) ?? null;

  function open(inv: Invoice, v: SheetView = "invoice") {
    setOpenId(inv.id);
    setView(v);
    setSheetNotice(null);
    if (v === "history") void loadHistory(inv.clientEmail);
  }

  function close() {
    setOpenId(null);
    setSheetNotice(null);
    if (new URLSearchParams(window.location.search).has("id")) router.replace("/dashboard/invoices", { scroll: false });
  }

  async function loadHistory(email: string) {
    setHistory({ state: "loading", data: null });
    try {
      const res = await fetch(`/api/dashboard/invoices/client-history?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error(String(res.status));
      setHistory({ state: "ready", data: (await res.json()) as ClientHistory });
    } catch {
      setHistory({ state: "error", data: null });
    }
  }

  async function send(inv: Invoice, from: "row" | "sheet") {
    if (from === "sheet") setBusy("send");
    else setRowBusy(inv.id);
    try {
      const res = await fetch(`/api/dashboard/invoices/${inv.id}/send`, { method: "POST" });
      if (!res.ok) {
        showToast(await errorText(res, `Couldn't send ${inv.invoiceNumber}. Try again.`), "error");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { warning?: string };
      await reload();
      if (data.warning === "payments_not_configured") {
        if (from === "sheet") setSheetNotice({ tone: "warn", text: NO_PAYMENTS });
        else setPageNotice({ tone: "warn", text: `${inv.invoiceNumber}: ${NO_PAYMENTS}` });
      } else {
        showToast(`${inv.invoiceNumber} sent to ${inv.clientEmail}`, "success");
      }
    } catch {
      showToast(`Couldn't send ${inv.invoiceNumber}. Check your connection.`, "error");
    } finally {
      setBusy(null);
      setRowBusy(null);
    }
  }

  async function voidInvoice(inv: Invoice) {
    if (!confirm(`Void ${inv.invoiceNumber}? ${inv.clientName} won't be able to pay it anymore.`)) return;
    setBusy("void");
    try {
      const res = await fetch(`/api/dashboard/invoices/${inv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "void" }),
      });
      if (!res.ok) {
        showToast(await errorText(res, `Couldn't void ${inv.invoiceNumber}.`), "error");
        return;
      }
      await reload();
      showToast(`${inv.invoiceNumber} voided`);
    } catch {
      showToast(`Couldn't void ${inv.invoiceNumber}. Check your connection.`, "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove(inv: Invoice) {
    const warning =
      inv.status === "paid"
        ? `Delete ${inv.invoiceNumber}? It's PAID: deleting it removes this payment from your invoices for good.`
        : `Delete ${inv.invoiceNumber} for good? This can't be undone.`;
    if (!confirm(warning)) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/dashboard/invoices/${inv.id}`, { method: "DELETE" });
      if (!res.ok) {
        showToast(await errorText(res, `Couldn't delete ${inv.invoiceNumber}.`), "error");
        return;
      }
      setInvoices((prev) => prev.filter((i) => i.id !== inv.id));
      close();
      showToast(`${inv.invoiceNumber} deleted`);
    } catch {
      showToast(`Couldn't delete ${inv.invoiceNumber}. Check your connection.`, "error");
    } finally {
      setBusy(null);
    }
  }

  async function pdf(inv: Invoice) {
    try {
      const { generateInvoicePDF } = await import("@/lib/invoice-pdf");
      generateInvoicePDF({
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        currency: inv.currency,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        clientName: inv.clientName,
        clientEmail: inv.clientEmail,
        clientCompany: inv.clientCompany,
        fromName: firm.name,
        fromCompany: firm.company,
        lineItems: inv.lineItems,
        subtotal: inv.subtotal,
        taxRate: inv.taxRate ?? 0,
        taxAmount: inv.taxAmount ?? 0,
        total: inv.total,
        amountPaid: inv.amountPaid ?? 0,
        balanceDue: inv.balanceDue ?? inv.total,
        notes: inv.notes,
        terms: inv.terms,
      });
    } catch {
      showToast("Couldn't make the PDF. Try again.", "error");
    }
  }

  async function markPaid(inv: Invoice, method: string, note: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/dashboard/invoices/${inv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_paid", method, note: note || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.invoice) return body.error || "Couldn't mark this invoice as paid";
      setInvoices((prev) => prev.map((i) => (i.id === inv.id ? { ...i, ...body.invoice } : i)));
      void reload();
      showToast(`${inv.invoiceNumber} marked paid`, "success");
      return null;
    } catch {
      return "Network error — please try again";
    }
  }

  async function create(sendNow: boolean) {
    const problem = draftProblem(draft);
    if (problem) {
      setComposeError(problem);
      return;
    }
    setComposeBusy(sendNow ? "send" : "draft");
    setComposeError(null);
    try {
      const res = await fetch("/api/dashboard/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBody(draft)),
      });
      if (!res.ok) {
        // Nothing was saved: the sheet and everything typed stay.
        setComposeError(await errorText(res, "Couldn't save the invoice. Try again."));
        return;
      }
      const { invoice } = (await res.json()) as { invoice: Invoice };
      let sendFailed: string | null = null;
      let warning: string | undefined;
      if (sendNow) {
        const sent = await fetch(`/api/dashboard/invoices/${invoice.id}/send`, { method: "POST" });
        if (sent.ok) warning = ((await sent.json().catch(() => ({}))) as { warning?: string }).warning;
        else sendFailed = await errorText(sent, "Sending failed.");
      }
      await reload();
      setDraft(blankDraft());
      setComposeMode("details");
      setComposeOpen(false);
      if (sendFailed) {
        setOpenId(invoice.id);
        setView("invoice");
        setSheetNotice({ tone: "error", text: `Saved as a draft, but it didn't send: ${sendFailed} Try Send again.` });
      } else if (warning === "payments_not_configured") {
        setOpenId(invoice.id);
        setView("invoice");
        setSheetNotice({ tone: "warn", text: NO_PAYMENTS });
      } else {
        showToast(sendNow ? `${invoice.invoiceNumber} sent to ${invoice.clientEmail}` : `${invoice.invoiceNumber} saved as a draft`, "success");
      }
    } catch {
      setComposeError("Couldn't save the invoice. Check your connection and try again.");
    } finally {
      setComposeBusy(null);
    }
  }

  async function createBatch(sendNow: boolean) {
    const problem = batchProblem(recipients, batchLines, batchOptions);
    if (problem) {
      setBatchError(problem);
      return;
    }
    setBatchBusy(sendNow ? "send" : "draft");
    setBatchError(null);
    try {
      const res = await fetch("/api/dashboard/invoices/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchBody(recipients, batchLines, batchOptions, sendNow)),
      });
      if (!res.ok) {
        setBatchError(await errorText(res, "Couldn't create the invoices. Try again."));
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { created?: number; errors?: string[]; invoiceIds?: string[]; warning?: string };
      const list = await reload();
      setRecipients([blankRecipient()]);
      setBatchLines([blankLine()]);
      setBatchOptions(blankOptions());
      setBatchOpen(false);

      const created = data.created ?? data.invoiceIds?.length ?? 0;
      const ids = new Set(data.invoiceIds ?? []);
      const stillDrafts = sendNow && list ? list.filter((i) => ids.has(i.id) && i.status === "draft").map((i) => i.invoiceNumber) : [];
      const problems = [
        ...(data.errors ?? []),
        ...(stillDrafts.length ? [`Not sent (still drafts): ${stillDrafts.join(", ")}`] : []),
        ...(data.warning === "payments_not_configured" ? [NO_PAYMENTS] : []),
      ];
      if (problems.length) {
        setPageNotice({
          tone: "warn",
          text: (
            <>
              <span className="font-bold">
                {created} invoice{created === 1 ? "" : "s"} created.
              </span>{" "}
              {problems.join(" · ")}
            </>
          ),
        });
      } else {
        showToast(`${created} invoice${created === 1 ? "" : "s"} ${sendNow ? "sent" : "saved as drafts"}`, "success");
      }
    } catch {
      setBatchError("Couldn't create the invoices. Check your connection and try again.");
    } finally {
      setBatchBusy(null);
    }
  }

  return (
    <>
      <InvoicesView
        state={state}
        invoices={invoices}
        busyId={rowBusy}
        notice={pageNotice}
        onDismissNotice={() => setPageNotice(null)}
        onOpen={(inv) => open(inv)}
        onNew={() => {
          setComposeError(null);
          setComposeOpen(true);
        }}
        onBatch={() => {
          setBatchError(null);
          setBatchOpen(true);
        }}
        onPdf={pdf}
        onHistory={(inv) => open(inv, "history")}
        onSend={(inv) => void send(inv, "row")}
        onRetry={() => {
          setState("loading");
          void reload();
        }}
        mercury={<MercuryPanel onInvoicesChanged={() => void reload()} />}
      />
      <InvoiceSheet
        invoice={openInvoice}
        view={view}
        onView={(v) => {
          setView(v);
          if (v === "history" && openInvoice) void loadHistory(openInvoice.clientEmail);
        }}
        firm={firm}
        branding={branding}
        origin={origin}
        history={history}
        busy={busy}
        notice={sheetNotice}
        onClose={close}
        onSend={() => openInvoice && void send(openInvoice, "sheet")}
        onVoid={() => openInvoice && void voidInvoice(openInvoice)}
        onDelete={() => openInvoice && void remove(openInvoice)}
        onPdf={() => openInvoice && void pdf(openInvoice)}
        onRetryHistory={() => openInvoice && void loadHistory(openInvoice.clientEmail)}
        onOpenInvoice={(id) => {
          setOpenId(id);
          setView("invoice");
          setSheetNotice(null);
        }}
        onMarkPaid={(method, note) => (openInvoice ? markPaid(openInvoice, method, note) : Promise.resolve("No invoice open"))}
      />
      <ComposeSheet
        open={composeOpen}
        draft={draft}
        onDraft={setDraft}
        firm={firm}
        branding={branding}
        mode={composeMode}
        onMode={setComposeMode}
        busy={composeBusy}
        error={composeError}
        onSave={(sendNow) => void create(sendNow)}
        onStartOver={() => {
          setDraft(blankDraft());
          setComposeError(null);
        }}
        onClose={() => setComposeOpen(false)}
      />
      <BatchSheet
        open={batchOpen}
        recipients={recipients}
        onRecipients={setRecipients}
        lines={batchLines}
        onLines={setBatchLines}
        options={batchOptions}
        onOptions={setBatchOptions}
        busy={batchBusy}
        error={batchError}
        onSave={(sendNow) => void createBatch(sendNow)}
        onClose={() => setBatchOpen(false)}
      />
      <Toast toast={toast} />
    </>
  );
}
