"use client";

import { ActionRow, Button, Card, FieldGrid, Notice, Select, SummaryList, TextField } from "@ductura/ui";
import { useCallback, useEffect, useState } from "react";

import { createApi } from "../../../../../../src/client/api";

import { useHost } from "../../context";
import {
  ORIGIN_KINDS, STRICTNESS, deleteThreshold, parsePercent, putThreshold, readThresholds,
  type OriginKind, type OriginThreshold, type ThresholdCall, type ThresholdWrite,
} from "./contract";
import { thresholdMessages as t } from "./messages.hr";

type Draft = { readonly percent: string; readonly strictness: string };
type FieldErrors = { readonly percent?: string; readonly strictness?: string };
type Loaded =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "ready"; readonly rows: readonly OriginThreshold[]; readonly stale: boolean };

/** What the form checks before anything is sent (an invalid percent is never sent). */
export function checkDraft(draft: Draft): FieldErrors {
  return {
    ...(parsePercent(draft.percent) === null ? { percent: t.percentInvalid } : {}),
    ...((STRICTNESS as readonly string[]).includes(draft.strictness) ? {} : { strictness: t.strictnessMissing }),
  };
}

const draftOf = (row: OriginThreshold | undefined): Draft =>
  row === undefined ? { percent: "", strictness: "" } : { percent: String(row.thresholdPercent), strictness: row.strictness };

type CardProps = {
  origin: OriginKind; row: OriginThreshold | undefined; call: () => ThresholdCall;
  refresh: () => Promise<boolean>;
};

function KindCard({ origin, row, call, refresh }: CardProps) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(row));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<Exclude<ThresholdWrite["kind"], "saved"> | undefined>();
  const [note, setNote] = useState("");
  // A re-read gives every row a new object: only a change of this kind's stored values replaces the draft,
  // so saving one kind keeps what the administrator typed, unsaved, in the others.
  const stored = row === undefined ? "" : `${row.thresholdPercent}|${row.strictness}`;
  useEffect(() => setDraft(draftOf(row)), [stored]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = t.kinds[origin];

  const act = async (write: () => Promise<ThresholdWrite>, done: string) => {
    setBusy(true);
    setFailed(undefined);
    setNote("");
    const out = await write();
    if (out.kind === "saved") setNote(done);
    else setFailed(out.kind);
    // After a write the server's answer was saved, or is not known: either way the page reads it again.
    if (out.kind === "saved" || out.kind === "unconfirmed") await refresh();
    setBusy(false);
  };
  const save = () => {
    const found = checkDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    void act(() => putThreshold(call(), origin, draft.percent, draft.strictness), t.saved);
  };
  const reload = async () => {
    setBusy(true);
    if (await refresh()) setFailed(undefined);
    setBusy(false);
  };

  return (
    <Card title={name}>
      <SummaryList rows={[{ id: "current", label: t.current, value: row === undefined ? t.none : t.shown(row.thresholdPercent, row.strictness) }]} />
      <FieldGrid>
        <TextField label={t.percent} hint={t.percentHint} error={errors.percent} inputMode="numeric" busy={busy}
          value={draft.percent} onChange={(event) => setDraft({ ...draft, percent: event.target.value })} />
        <Select label={t.strictnessLabel} placeholder={t.strictnessPick} hint={t.strictnessHint} error={errors.strictness} busy={busy}
          options={STRICTNESS.map((value) => ({ value, label: t.strictness[value] }))}
          value={draft.strictness} onChange={(event) => setDraft({ ...draft, strictness: event.target.value })} />
      </FieldGrid>
      <ActionRow>
        <Button busy={busy} onClick={save} aria-label={t.saveFor(name)}>{t.save}</Button>
        {row !== undefined && (
          <Button tone="secondary" busy={busy} aria-label={t.removeFor(name)}
            onClick={() => void act(() => deleteThreshold(call(), origin), t.removed)}>{t.remove}</Button>
        )}
        {failed === "unconfirmed" && (
          <Button tone="secondary" busy={busy} aria-label={t.reloadFor(name)} onClick={() => void reload()}>{t.reload}</Button>
        )}
      </ActionRow>
      {failed !== undefined && <p role="alert">{t.writeErrors[failed]}</p>}
      <p role="status">{note}</p>
    </Card>
  );
}

function AdminForm({ call }: { call: () => ThresholdCall }) {
  const [state, setState] = useState<Loaded>({ kind: "loading" });
  const load = useCallback(() => {
    setState({ kind: "loading" });
    void readThresholds(call()).then((out) =>
      setState(out.kind === "ready" ? { kind: "ready", rows: out.thresholds, stale: false } : { kind: "error", message: t.readErrors[out.kind] }));
  }, [call]);
  useEffect(load, [load]);
  // A re-read after a write keeps the cards (and what is typed in them); if it fails, the page says the view may be old.
  const refresh = useCallback(async () => {
    const out = await readThresholds(call());
    setState((now) => out.kind === "ready" ? { kind: "ready", rows: out.thresholds, stale: false }
      : now.kind === "ready" ? { ...now, stale: true } : now);
    return out.kind === "ready";
  }, [call]);

  if (state.kind === "loading") return <Card title={t.title} busy />;
  if (state.kind === "error") {
    // Card shows only its error text, so the retry sits beside it.
    return (
      <>
        <Card title={t.title} error={state.message} />
        <ActionRow><Button tone="secondary" onClick={load}>{t.retry}</Button></ActionRow>
      </>
    );
  }
  return (
    <>
      {state.stale && (
        <>
          <Notice tone="warn">{t.stale}</Notice>
          <ActionRow><Button tone="secondary" onClick={() => void refresh()}>{t.reload}</Button></ActionRow>
        </>
      )}
      {ORIGIN_KINDS.map((origin) => (
        <KindCard key={origin} origin={origin} row={state.rows.find((row) => row.origin === origin)} call={call} refresh={refresh} />
      ))}
    </>
  );
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
        : <Notice>{t.denied}</Notice>}
    </section>
  );
}
