"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Card, Dialog, RouteLoading, Select, Tag, TextArea, TextField } from "@ductura/ui";

import { createApi, goToSignIn } from "@/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { formatDateHr } from "../../../../../../src/lib/i18n/hr";
import { useHost } from "../../context";
import { qualMaterialsText as t } from "./messages.hr";
import { checkDraft, countText, KINDS, linesOf, type Draft, type FieldError } from "./model";
import {
  addMaterial, readMaterial, readMaterials, removeMaterial, type AddOutcome, type ListRead, type MaterialRow, type OneRead,
} from "./read";

type Api = ReturnType<typeof createApi>;
const defaultCall = (): Api => createApi();

const ADD_TEXT: Readonly<Record<Exclude<AddOutcome["kind"], "saved" | "signedOut">, string>> = {
  conflict: t.conflict, invalid: t.invalid, unknown: t.unknown,
};
const EMPTY_DRAFT: Draft = { title: "", kind: "interview", text: "" };

/**
 * Student: "Gradivo za kodiranje" (WEB-V18-KODIRANJE-GRADIVO). The student's own materials (an interview or a
 * note), adding one by typing or pasting, reading one, and deleting one after a confirmation. Private to the
 * student; another's material is "not found". No audio, no suggestion of codes (V18-3). Loading, error and
 * empty are three different states, and a note of success follows only the server's answer. `call` is for tests.
 */
export default function QualMaterialsPage({ call = defaultCall }: { call?: () => Api }) {
  const { base } = useHost();
  const here = appHref(base, "/zadaci/gradivo-kodiranja");
  const [list, setList] = useState<ListRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<{ field: string; error: FieldError } | null>(null);
  const [note, setNote] = useState<{ tone: "status" | "alert"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [asking, setAsking] = useState<MaterialRow | null>(null);

  useEffect(() => {
    let live = true;
    void readMaterials(call()).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") goToSignIn(here);
      setList(result);
    });
    return () => { live = false; };
    // `call` and `here` are stable per visit; the attempt is what asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const back = <p><a href={appHref(base, "/zadaci")}><span aria-hidden="true">← </span>{t.back}</a></p>;
  const head = <header><h1>{t.title}</h1><p>{t.lead}</p></header>;

  if (list === null || list.kind === "signedOut") return <div className="page">{back}{head}<RouteLoading label={t.loading} /></div>;
  if (list.kind === "unavailable") {
    return (
      <div className="page">{back}{head}
        <Card level={2} title={t.listTitle}>
          <p role="alert">{t.unavailable}</p>
          <p><Button tone="quiet" onClick={reload}>{t.retry}</Button></p>
        </Card>
      </div>
    );
  }
  const materials = list.materials;
  const fieldError = (field: string) => (error?.field === field ? t.errors[error.error] : undefined);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setNote(null);
    const checked = checkDraft(draft, materials.length);
    if (!checked.ok) { setError({ field: checked.field, error: checked.error }); return; }
    setError(null);
    setBusy(true);
    const outcome = await addMaterial(call(), checked.value);
    setBusy(false);
    if (outcome.kind === "signedOut") { goToSignIn(here); return; }
    if (outcome.kind === "saved") {
      setNote({ tone: "status", text: t.saved });
      setDraft(EMPTY_DRAFT);
    } else {
      setNote({ tone: "alert", text: ADD_TEXT[outcome.kind] });
    }
    // The server may know something the page did not (a conflict, a lost answer): read again either way.
    reload();
  }

  async function confirmRemove(row: MaterialRow) {
    if (busy) return;
    setBusy(true);
    const outcome = await removeMaterial(call(), row.id);
    setBusy(false);
    if (outcome.kind === "signedOut") { goToSignIn(here); return; }
    setAsking(null);
    if (openId === row.id) setOpenId(null);
    if (outcome.kind === "removed") setNote({ tone: "status", text: t.removed });
    else if (outcome.kind === "notFound") setNote({ tone: "alert", text: t.gone });
    else setNote({ tone: "alert", text: t.removeUnknown });
    reload();
  }

  return (
    <div className="page">
      {back}{head}
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
      <Card level={2} title={t.formTitle}>
        <form onSubmit={(event) => void send(event)} noValidate>
          {error?.field === "form" && <p role="alert">{t.errors[error.error]}</p>}
          <TextField label={t.fieldTitle} value={draft.title} busy={busy} error={fieldError("title")} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <Select label={t.fieldKind} disabled={busy} error={fieldError("kind")} value={draft.kind} options={KINDS.map((k) => ({ value: k, label: t.kind[k] }))}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value })} />
          <TextArea label={t.fieldText} busy={busy} hint={t.fieldTextHint} value={draft.text} error={fieldError("text")} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          <p><Button type="submit" busy={busy}>{busy ? t.saving : t.save}</Button></p>
        </form>
      </Card>
      <Card level={2} title={t.listTitle}>
        {materials.length === 0 ? <><h3>{t.noMaterials.title}</h3><p>{t.noMaterials.body}</p></> : (
          <ul>
            {materials.map((m) => (
              <li key={m.id} data-testid="material">
                <strong>{m.title}</strong>{" "}
                <Tag>{t.kind[m.kind]}</Tag>{" "}
                <Tag>{countText(m.charCount, t.charCount)}</Tag>{" "}
                <Tag tone={m.segmentCount === 0 ? "neutral" : "accent"}>{m.segmentCount === 0 ? t.noSegments : countText(m.segmentCount, t.segmentCount)}</Tag>{" "}
                {m.locked && <Tag tone="warn">{t.locked}</Tag>}
                <br /><span>{t.created.replace("{date}", formatDateHr(m.createdOn))}</span>{m.locked && <> · <span>{t.lockedHint}</span></>}
                <br />
                {openId === m.id ? <span>{t.opened}</span> : (
                  <Button tone="quiet" aria-label={t.openAria.replace("{title}", m.title)} onClick={() => setOpenId(m.id)}>{t.open}</Button>
                )}{" "}
                <Button tone="quiet" disabled={busy} aria-label={t.removeAria.replace("{title}", m.title)} onClick={() => setAsking(m)}>{t.remove}</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {openId !== null && materials.some((m) => m.id === openId) && (
        <Viewer key={openId} id={openId} call={call} here={here} onClose={() => setOpenId(null)} onGone={() => { setOpenId(null); setNote({ tone: "alert", text: t.gone }); reload(); }} />
      )}
      <Dialog
        open={asking !== null} title={t.confirmTitle} dismissible={!busy} onClose={() => setAsking(null)}
        actions={asking === null ? null : (
          <>
            <Button tone="quiet" disabled={busy} onClick={() => setAsking(null)}>{t.confirmNo}</Button>
            <Button busy={busy} onClick={() => void confirmRemove(asking)}>{busy ? t.removing : t.confirmYes}</Button>
          </>
        )}
      >
        {asking !== null && (
          <p>
            {asking.segmentCount === 0 ? t.confirmBodyNone.replace("{title}", asking.title)
              : t.confirmBody.replace("{title}", asking.title).replace("{segments}", String(asking.segmentCount))}
          </p>
        )}
      </Dialog>
    </div>
  );
}

function Viewer({ id, call, here, onClose, onGone }: { id: string; call: () => Api; here: string; onClose: () => void; onGone: () => void }) {
  const [read, setRead] = useState<OneRead | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void readMaterial(call(), id).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") goToSignIn(here);
      if (result.kind === "notFound") { onGone(); return; }
      setRead(result);
    });
    return () => { live = false; };
    // `call`, `here` and `onGone` are stable per visit; the attempt and the id are what ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, id]);

  if (read === null || read.kind === "signedOut" || read.kind === "notFound") return <Card level={2} title={t.viewTitle}><RouteLoading label={t.loadingOne} /></Card>;
  if (read.kind === "unavailable") {
    return (
      <Card level={2} title={t.viewTitle}>
        <p role="alert">{t.oneUnavailable}</p>
        <p><Button tone="quiet" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>{" "}<Button tone="quiet" onClick={onClose}>{t.viewClose}</Button></p>
      </Card>
    );
  }
  const m = read.material;
  return (
    <Card level={2} title={`${t.viewTitle}: ${m.title}`}>
      <p><Tag>{t.kind[m.kind]}</Tag>{" "}{m.locked && <Tag tone="warn">{t.locked}</Tag>}</p>
      <div data-testid="material-text">
        {linesOf(m.text).map((line, index) => (line === "" ? null : <p key={index} data-line={index}>{line}</p>))}
      </div>
      <p><Button tone="quiet" onClick={onClose}>{t.viewClose}</Button></p>
    </Card>
  );
}
