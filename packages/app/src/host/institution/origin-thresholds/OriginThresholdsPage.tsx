"use client";

import { ActionRow, Button, Card, FieldGrid, Notice, Select, SummaryList, TextField } from "@ductura/ui";
import { useCallback, useEffect, useState } from "react";

import { createApi } from "../../../../../../src/client/api";

import { useHost } from "../../context";
import {
  ORIGIN_KINDS, STRICTNESS, deleteThreshold, parsePercent, putThreshold, readThresholds,
  type OriginKind, type OriginThreshold, type Refusal, type ThresholdCall,
} from "./contract";
import { thresholdMessages as t } from "./messages.hr";

type Draft = { readonly percent: string; readonly strictness: string };
type FieldErrors = { readonly percent?: string; readonly strictness?: string };
type Loaded = { readonly kind: "loading" } | { readonly kind: "error"; readonly message: string } | { readonly kind: "ready"; readonly rows: readonly OriginThreshold[] };

/** The catalogue text for a refusal: the page never shows a raw server code. */
export const say = (kind: Refusal): string => t.errors[kind];

/** What the form checks before anything is sent (an invalid percent is never sent). */
export function checkDraft(draft: Draft): FieldErrors {
  return {
    ...(parsePercent(draft.percent) === null ? { percent: t.percentInvalid } : {}),
    ...((STRICTNESS as readonly string[]).includes(draft.strictness) ? {} : { strictness: t.strictnessMissing }),
  };
}

const draftOf = (row: OriginThreshold | undefined): Draft =>
  row === undefined ? { percent: "", strictness: "" } : { percent: String(row.thresholdPercent), strictness: row.strictness };

function KindCard({ origin, row, call, onChanged }: { origin: OriginKind; row: OriginThreshold | undefined; call: () => ThresholdCall; onChanged: () => Promise<void> }) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(row));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const [note, setNote] = useState("");
  useEffect(() => setDraft(draftOf(row)), [row]);

  const act = async (write: () => Promise<{ kind: string }>, done: string) => {
    setBusy(true);
    setActionError(undefined);
    setNote("");
    const out = await write();
    if (out.kind === "saved") {
      setNote(done);
      await onChanged();
    } else setActionError(say(out.kind as Refusal));
    setBusy(false);
  };
  const save = () => {
    const found = checkDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    void act(() => putThreshold(call(), origin, draft.percent, draft.strictness), t.saved);
  };

  return (
    <Card title={t.kinds[origin]}>
      <SummaryList rows={[{ id: "current", label: t.current, value: row === undefined ? t.none : t.shown(row.thresholdPercent, row.strictness) }]} />
      <FieldGrid>
        <TextField label={t.percent} hint={t.percentHint} error={errors.percent} inputMode="numeric" busy={busy}
          value={draft.percent} onChange={(event) => setDraft({ ...draft, percent: event.target.value })} />
        <Select label={t.strictnessLabel} placeholder={t.strictnessPick} hint={t.strictnessHint} error={errors.strictness} busy={busy}
          options={STRICTNESS.map((value) => ({ value, label: t.strictness[value] }))}
          value={draft.strictness} onChange={(event) => setDraft({ ...draft, strictness: event.target.value })} />
      </FieldGrid>
      <ActionRow>
        <Button busy={busy} onClick={save}>{t.save}</Button>
        {row !== undefined && (
          <Button tone="secondary" busy={busy} onClick={() => void act(() => deleteThreshold(call(), origin), t.removed)}>{t.remove}</Button>
        )}
      </ActionRow>
      {actionError !== undefined && <p role="alert">{actionError}</p>}
      <p role="status">{note}</p>
    </Card>
  );
}

function AdminForm({ call }: { call: () => ThresholdCall }) {
  const [state, setState] = useState<Loaded>({ kind: "loading" });
  const read = useCallback(async () => {
    const out = await readThresholds(call());
    setState(out.kind === "ready" ? { kind: "ready", rows: out.thresholds } : { kind: "error", message: say(out.kind) });
  }, [call]);
  const load = useCallback(() => {
    setState({ kind: "loading" });
    void read();
  }, [read]);
  useEffect(load, [load]);

  if (state.kind === "loading") return <Card title={t.title} busy />;
  if (state.kind === "error") {
    return (
      <Card title={t.title} error={state.message}>
        <Button tone="secondary" onClick={load}>{t.retry}</Button>
      </Card>
    );
  }
  return ORIGIN_KINDS.map((origin) => (
    <KindCard key={origin} origin={origin} row={state.rows.find((row) => row.origin === origin)} call={call} onChanged={read} />
  ));
}

const serverCall = () => createApi() as unknown as ThresholdCall;

/**
 * /ustanova/pragovi (PIL-P1-PRAGOVI-ADMIN; P-1 rule 12): the institution administrator writes or removes
 * the threshold of each origin kind. There are no defaults. Anyone else gets a calm refusal and nothing is
 * read; the server refuses them too (403, shown as the same text). Calls go only through src/client.
 */
export default function OriginThresholdsPage({ call = serverCall }: { call?: () => ThresholdCall }) {
  const { page, role } = useHost();
  return (
    <section className="page" data-role={role ?? undefined}>
      <h1>{page.label}</h1>
      {role === "admin"
        ? (
          <>
            <p>{t.lead}</p>
            <Notice>{t.notice}</Notice>
            <AdminForm call={call} />
          </>
        )
        : <Notice>{t.errors.denied}</Notice>}
    </section>
  );
}
