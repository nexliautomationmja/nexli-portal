"use client";

import { ExternalLink, Mail, Phone, PlugZap, Search, SearchX, Users } from "lucide-react";
import {
  Button,
  ButtonLink,
  Chip,
  DataTable,
  EmptyState,
  FIELD,
  GradientText,
  Notice,
  NUM_FONT,
  PageColumn,
  PageHero,
  RainmakerCanvas,
  Section,
  Sheet,
  Spinner,
  Surface,
  type Column,
} from "@/components/rainmaker";
import { dateOrDash, daysSince, relativeDay } from "@/lib/format";
import { contactName, ghlContactUrl, initials, type Contact, type ContactsState } from "./contacts-types";

export interface ContactsViewProps {
  state: ContactsState;
  contacts: Contact[];
  total: number;
  query: string;
  /** A search is on its way while the last results stay on screen. */
  searching: boolean;
  locationId: string | null;
  open: Contact | null;
  onQuery: (q: string) => void;
  onOpen: (c: Contact) => void;
  onClose: () => void;
  onRetry: () => void;
}

function Avatar({ c, size = "sm" }: { c: Contact; size?: "sm" | "lg" }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 font-bold text-white ${
        size === "lg" ? "h-12 w-12 text-base" : "h-8 w-8 text-[11px]"
      }`}
      aria-hidden="true"
    >
      {initials(c)}
    </span>
  );
}

const source = (c: Contact) => c.source?.trim() || "Direct";

function ContactSheet({ c, locationId, onClose }: { c: Contact | null; locationId: string | null; onClose: () => void }) {
  return (
    <Sheet open={Boolean(c)} onClose={onClose} title={c ? contactName(c) : ""} sub={c ? `Added ${dateOrDash(c.dateAdded)}` : undefined} size="md">
      {c && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Avatar c={c} size="lg" />
            <div className="min-w-0">
              <div className="truncate text-base font-bold text-white">{contactName(c)}</div>
              {c.companyName && <div className="truncate text-sm text-neutral-400">{c.companyName}</div>}
            </div>
          </div>

          <Surface className="divide-y divide-white/5">
            {(
              [
                ["Email", c.email ? <a href={`mailto:${c.email}`} className="break-all text-cyan-300 hover:underline">{c.email}</a> : null],
                ["Phone", c.phone ? <a href={`tel:${c.phone}`} className="text-cyan-300 hover:underline" style={NUM_FONT}>{c.phone}</a> : null],
                ["Source", <Chip key="s" size="xs">{source(c)}</Chip>],
                ["Added", <span key="a" style={NUM_FONT}>{dateOrDash(c.dateAdded)} · {relativeDay(c.dateAdded)}</span>],
              ] as [string, React.ReactNode][]
            )
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="flex min-h-12 items-center justify-between gap-4 px-4 py-2.5 text-sm">
                  <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-neutral-400">{label}</span>
                  <span className="min-w-0 text-right text-white">{value}</span>
                </div>
              ))}
          </Surface>

          {c.tags && c.tags.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-400">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {c.tags.map((t) => (
                  <Chip key={t} tone="cyan" size="xs">
                    {t}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {c.email && (
              <ButtonLink href={`mailto:${c.email}`} variant="secondary" size="sm" external>
                <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Email
              </ButtonLink>
            )}
            {c.phone && (
              <ButtonLink href={`tel:${c.phone}`} variant="secondary" size="sm" external>
                <Phone className="h-3.5 w-3.5" aria-hidden="true" /> Call
              </ButtonLink>
            )}
            {locationId && (
              <ButtonLink href={ghlContactUrl(locationId, c.id)} variant="secondary" size="sm" external>
                Open in GoHighLevel <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </ButtonLink>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

export function ContactsView(p: ContactsViewProps) {
  const ready = p.state === "ready";
  const capped = ready && !p.query.trim() && p.total > p.contacts.length;

  const columns: Column<Contact>[] = [
    {
      key: "name",
      header: "Name",
      sticky: true,
      className: "max-w-[260px]",
      cell: (c) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            p.onOpen(c);
          }}
          className="flex max-w-full items-center gap-2.5 text-left"
        >
          <Avatar c={c} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-white hover:text-cyan-200 hover:underline">{contactName(c)}</span>
            {c.companyName && <span className="block truncate text-[11px] text-neutral-400">{c.companyName}</span>}
          </span>
        </button>
      ),
    },
    {
      key: "email",
      header: "Email",
      className: "max-w-[260px]",
      cell: (c) =>
        c.email ? (
          <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()} className="block truncate text-cyan-300 hover:underline">
            {c.email}
          </a>
        ) : (
          <span className="text-neutral-500">—</span>
        ),
    },
    {
      key: "phone",
      header: "Phone",
      className: "whitespace-nowrap",
      cell: (c) =>
        c.phone ? (
          <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="text-cyan-300 hover:underline">
            {c.phone}
          </a>
        ) : (
          <span className="text-neutral-500">—</span>
        ),
    },
    { key: "source", header: "Source", cell: (c) => <Chip size="xs">{source(c)}</Chip> },
    {
      key: "added",
      header: "Added",
      className: "whitespace-nowrap",
      cell: (c) => (
        <div>
          <div className="text-neutral-200">{dateOrDash(c.dateAdded)}</div>
          {daysSince(c.dateAdded) < 14 && <div className="text-[10px] text-neutral-400">{relativeDay(c.dateAdded)}</div>}
        </div>
      ),
    },
  ];

  const searchBox = (
    <div className="relative w-full sm:w-80">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
      <input
        type="search"
        value={p.query}
        onChange={(e) => p.onQuery(e.target.value)}
        placeholder="Search by name, email or phone"
        aria-label="Search contacts"
        disabled={p.state === "disconnected"}
        className={`${FIELD} pl-10 pr-10`}
      />
      {p.searching && (
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-cyan-300">
          <Spinner />
        </span>
      )}
    </div>
  );

  return (
    <RainmakerCanvas>
      <PageColumn>
        <PageHero
          pill={{ icon: <Users className="h-4 w-4 text-cyan-300" aria-hidden="true" />, label: "Contacts" }}
          title={
            <>
              Every contact, <GradientText>at hand.</GradientText>
            </>
          }
          sub="Your GoHighLevel contacts. Search by name, email or phone, and open one for the details."
          meta={ready && p.total > 0 ? <span>{p.total.toLocaleString("en-US")} contacts in GoHighLevel</span> : undefined}
        />

        <Section id="contacts" eyebrow="GoHighLevel" title="Your contacts" right={searchBox}>
          {p.state === "disconnected" ? (
            <EmptyState
              icon={<PlugZap className="h-5 w-5" aria-hidden="true" />}
              title="Connect GoHighLevel"
              body="Add your GoHighLevel Location ID in Settings, and your contacts show up here."
              action={
                <ButtonLink href="/dashboard/settings" variant="primary" size="sm">
                  Open Settings
                </ButtonLink>
              }
            />
          ) : p.state === "error" ? (
            <Notice
              tone="error"
              title="Couldn't reach GoHighLevel"
              action={
                <Button size="sm" onClick={p.onRetry}>
                  Try again
                </Button>
              }
            >
              Your contacts are safe there. This is usually a short hiccup on their side.
            </Notice>
          ) : (
            <>
              {capped && (
                <Notice tone="info" className="mb-3">
                  Showing {p.contacts.length} of {p.total.toLocaleString("en-US")}. Search by name, email or phone to find anyone else.
                </Notice>
              )}
              <DataTable
                caption="Contacts"
                columns={columns}
                rows={p.contacts}
                rowKey={(c) => c.id}
                onRowClick={p.onOpen}
                loading={p.state === "loading"}
                breakpoint="xl"
                cardGrid
                card={(c) => (
                  <button type="button" onClick={() => p.onOpen(c)} className="flex w-full min-w-0 items-start gap-3 text-left">
                    <Avatar c={c} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{contactName(c)}</span>
                      {c.email && <span className="block truncate text-xs text-neutral-400">{c.email}</span>}
                      {c.phone && (
                        <span className="block truncate text-xs text-neutral-400" style={NUM_FONT}>
                          {c.phone}
                        </span>
                      )}
                      <span className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Chip size="xs">{source(c)}</Chip>
                        <span className="text-[10px] text-neutral-400">Added {relativeDay(c.dateAdded)}</span>
                      </span>
                    </span>
                  </button>
                )}
                empty={
                  p.query.trim() ? (
                    <EmptyState
                      icon={<SearchX className="h-5 w-5" aria-hidden="true" />}
                      title={`No contacts match “${p.query.trim()}”`}
                      body="Check the spelling, or search by email or phone instead."
                      action={
                        <Button variant="secondary" size="sm" onClick={() => p.onQuery("")}>
                          Clear search
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={<Users className="h-5 w-5" aria-hidden="true" />}
                      title="No contacts yet"
                      body="New leads from your website and ads land here."
                    />
                  )
                }
              />
            </>
          )}
        </Section>
      </PageColumn>
      <ContactSheet c={p.open} locationId={p.locationId} onClose={p.onClose} />
    </RainmakerCanvas>
  );
}
