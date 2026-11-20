"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button, SourceForm, TextField, type SourceDraft, type SourceFormAction } from "@ductura/ui";

import { lookupSource, type LookupOutcome, type SourceLookup } from "./lookup";
import { quickSourceHr as t } from "./messages.hr";

export type QuickSourceProps = {
  onSubmit: (source: SourceDraft, action: SourceFormAction) => void;
  allowCite?: boolean;
  disabled?: boolean;
  lookup?: SourceLookup;
};

const message = { invalid: t.invalid, not_found: t.notFound, unavailable: t.unavailable, failed: t.failed } as const;

/** Quick source (E§3.3): a DOI or ISBN looked up on the server, or manual entry; the form always checks the result. */
export function QuickSource({ onSubmit, allowCite, disabled, lookup }: QuickSourceProps) {
  const manualRef = useRef<HTMLButtonElement>(null);
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<LookupOutcome | null>(null);
  const [draft, setDraft] = useState<SourceDraft | undefined>();
  const [open, setOpen] = useState(false);
  const run = useRef(0);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (busy || disabled) return;
    const mine = ++run.current;
    setBusy(true);
    setOutcome(null);
    const result = await lookupSource(identifier, lookup);
    if (mine !== run.current) return;
    setBusy(false);
    setOutcome(result);
    if (result.state === "found") { setDraft(result.draft); setOpen(true); }
  }

  const failure = outcome && outcome.state !== "found" ? message[outcome.state] : undefined;
  return (
    <section aria-label={t.heading}>
      <form onSubmit={search} noValidate>
        <TextField label={t.identifier} hint={t.hint} value={identifier} disabled={disabled}
          error={failure} busy={busy} onChange={(event) => setIdentifier(event.currentTarget.value)} />
        <Button type="submit" disabled={disabled || busy}>{t.lookup}</Button>
        <Button ref={manualRef} tone="quiet" disabled={disabled}
          onClick={() => { setDraft(undefined); setOpen(true); }}>{t.manual}</Button>
      </form>
      <p role="status">{busy ? t.searching : outcome?.state === "found" ? t.found : ""}</p>
      <SourceForm key={draft ? JSON.stringify(draft) : "manual"} open={open} anchor={manualRef} initial={draft}
        allowCite={allowCite} disabled={disabled} onClose={() => setOpen(false)}
        onSubmit={(source, action) => { setOpen(false); onSubmit(source, action); }} />
    </section>
  );
}
