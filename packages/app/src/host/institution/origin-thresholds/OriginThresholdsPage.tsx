"use client";

import { ActionRow, Button, Card, FieldGrid, Notice, Select, SummaryList, TextField } from "@ductura/ui";
import { useCallback, useEffect, useState } from "react";

import { createApi } from "../../../../../../src/client/api";

import { useHost } from "../../context";
import {
  ORIGIN_KINDS, STRICTNESS, deleteThreshold, parsePercent, putThreshold, readThresholds,
  type OriginKind, type OriginThreshold, type Refusal, type ThresholdCall, type ThresholdWrite, type WriteRefusal,
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

const draftOf = (percent: number | undefined, strictness: string | undefined): Draft =>
  percent === undefined ? { percent: "", strictness: "" } : { percent: String(percent), strictness: strictness ?? "" };

type KindProps = {
  origin: OriginKind;
  row: OriginThreshold | undefined;
  call: () => ThresholdCall;
  /** Reads the list again after a confirmed change. */
  onChanged: () => Promise<void>;
  /** Reads the list from scratch, for a change the client could not confirm. */
  onReload: () => void;
};

function KindCard({ origin, row, call, onChanged, onReload }: KindProps) {
  const percent = row?.thresholdPercent;
  const strictness = row?.strictness;
  const [draft, setDraft] = useState<Draft>(() => draftOf(percent, strictness));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<WriteRefusal | undefined>();
  const [note, setNote] = useState("");
  // Only a change of this kind's own threshold resets its fields: a read caused by another card keeps what is typed here.
  useEffect(() => setDraft(draftOf(percent, strictness)), [percent, strictness]);

  const act = async (write: () => Promise<ThresholdWrite>, done: string) => {
    setBusy(true);
    setFailed(undefined);
    setNote("");
    const out = await write();
    if (out.kind === "saved") {
      setNote(done);
      await onChanged();
    } else setFailed(out.kind);
    setBusy(false);
  };
  const save = () => {
    const found = checkDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    void act(() => putThreshold(call(), origin, draft.percent, draft.strictness), t.saved);
  };
  const kind = t.kinds[origin];

  return (
    <Card title={kind}>
      <SummaryList rows={[{ id: "current", label: t.current, value: row === undefined ? t.none : t.shown(row.thresholdPercent, row.strictness) }]} />
      <FieldGrid>
        <TextField label={t.percent} hint={t.percentHint} error={errors.percent} inputMode="numeric" busy={busy}
          value={draft.percent} onChange={(event) => setDraft({ ...draft, percent: event.target.value })} />
        <Select label={t.strictnessLabel} placeholder={t.strictnessPick} hint={t.strictnessHint} error={errors.strictness} busy={busy}
          options={STRICTNESS.map((value) => ({ value, label: t.strictness[value] }))}
          value={draft.strictness} onChange={(event) => setDraft({ ...draft, strictness: event.target.value })} />
      </FieldGrid>
      <ActionRow>
        <Button busy={busy} aria-label={`${t.save}: ${kind}`} onClick={save}>{t.save}</Button>
        {row !== undefined && (
          <Button tone="secondary" busy={busy} aria-label={`${t.remove}: ${kind}`}
            onClick={() => void act(() => deleteThreshold(call(), origin), t.removed)}>{t.remove}</Button>
        )}
      </ActionRow>
      {failed !== undefined && <p role="alert">{say(failed)}</p>}
      {failed === "unconfirmed" && <ActionRow><Button tone="secondary" onClick={onReload}>{t.reload}</Button></ActionRow>}
      <p role="status">{note}</p>
    </Card>
  );
}

function AdminForm({ call }: { call: () => ThresholdCall }) {
  const [state, setState] = useState<Loaded>({ kind: "loading" });
  const [stale, setStale] = useState<string | undefined>();
  const load = useCallback(() => {
    setState({ kind: "loading" });
    setStale(undefined);
    void readThresholds(call()).then((out) =>
      setState(out.kind === "ready" ? { kind: "ready", rows: out.thresholds } : { kind: "error", message: say(out.kind) }));
  }, [call]);
  // After a confirmed change: a failed read keeps the cards and says the list is not current, never that nothing changed.
  const refresh = useCallback(async () => {
    const out = await readThresholds(call());
    if (out.kind === "ready") {
      setState({ kind: "ready", rows: out.thresholds });
      setStale(undefined);
    } else setStale(out.kind === "unavailable" ? t.errors.staleAfterSave : say(out.kind));
  }, [call]);
  useEffect(load, [load]);

  if (state.kind === "loading") return <Card title={t.title} busy />;
  if (state.kind === "error") {
    return (
      <>
        <Card title={t.title} error={state.message} />
        <ActionRow><Button tone="secondary" onClick={load}>{t.retry}</Button></ActionRow>
      </>
    );
  }
  return (
    <>
      {stale !== undefined && (
        <>
          <Notice tone="warn">{stale}</Notice>
          <ActionRow><Button tone="secondary" onClick={load}>{t.reload}</Button></ActionRow>
        </>
      )}
      {ORIGIN_KINDS.map((origin) => (
        <KindCard key={origin} origin={origin} row={state.rows.find((row) => row.origin === origin)} call={call} onChanged={refresh} onReload={load} />
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
        : <Notice>{t.errors.denied}</Notice>}
    </section>
  );
}
