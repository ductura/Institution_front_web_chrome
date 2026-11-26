"use client";

// WEB-V16-POVJERENSTVO: CommitteeEditor, the administrator's form for the committee of one work: members are chosen
// from the confirmed teachers, one chair at most, five members at most. Rules are checked before sending; a note of
// success follows only the server's answer. It is mounted by the faculty's list of theses (WEB-V16-POPIS-FAKULTET).
import { useEffect, useState } from "react";

import { createApi, goToSignIn } from "@/client/api";
import { Button, Notice, Select } from "@ductura/ui";

import { checkCommittee, MAX_MEMBERS, writeCommittee, type Draft } from "./actions";
import { committeeHr as t } from "./messages.hr";
import { readCandidates, type Candidate, type CommitteeMember, type CommitteeRole, type PersonName } from "./read";

type Api = ReturnType<typeof createApi>;
const nameText = (n: PersonName | null | undefined, id: string) => (n ? `${n.givenName} ${n.familyName}` : `${t.unnamed} (${id.slice(0, 8)})`);

export type CommitteeEditorProps = {
  readonly documentId: string;
  /** The committee in force, as the server last returned it. */
  readonly value: readonly CommitteeMember[];
  readonly call?: () => Api;
  /** Called with the saved list after the server's 200. */
  readonly onSaved?: (members: readonly CommitteeMember[]) => void;
  /** The work is gone (404): the caller hides the editor. */
  readonly onNotFound?: () => void;
};

export function CommitteeEditor({ documentId, value, call = () => createApi(), onSaved, onNotFound }: CommitteeEditorProps) {
  const [current, setCurrent] = useState<readonly CommitteeMember[]>(value);
  const [draft, setDraft] = useState<readonly Draft[]>(value.map((m) => ({ userId: m.userId, role: m.role })));
  const [candidates, setCandidates] = useState<readonly Candidate[] | "loading" | "unavailable">("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "status" | "alert"; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    void readCandidates(call()).then((c) => { if (live) setCandidates(c ?? "unavailable"); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const names = new Map<string, PersonName | null>();
  for (const m of current) names.set(m.userId, m.name);
  if (Array.isArray(candidates)) for (const c of candidates as readonly Candidate[]) names.set(c.personId, c.name);
  const free = Array.isArray(candidates) ? (candidates as readonly Candidate[]).filter((c) => !draft.some((d) => d.userId === c.personId)) : [];
  const problem = checkCommittee(draft);
  const full = draft.length >= MAX_MEMBERS;

  async function save() {
    setNote(null);
    if (problem !== null) { setNote({ tone: "alert", text: t.problems[problem] }); return; }
    setBusy(true);
    const r = await writeCommittee(call(), documentId, current.map((m) => ({ userId: m.userId, role: m.role })), draft);
    setBusy(false);
    switch (r.kind) {
      case "saved": setCurrent(r.members); setDraft(r.members.map((m) => ({ userId: m.userId, role: m.role }))); setNote({ tone: "status", text: t.saved }); onSaved?.(r.members); return;
      case "unchanged": setNote({ tone: "status", text: t.unchanged }); return;
      case "problem": setNote({ tone: "alert", text: t.problems[r.problem] }); return;
      case "signedOut": goToSignIn(window.location.pathname); return;
      case "notFound": setNote({ tone: "alert", text: t.errors.notFound }); onNotFound?.(); return;
      default: setNote({ tone: "alert", text: t.errors[r.kind] });
    }
  }

  return (
    <form aria-label={t.editor.title} onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <p>{t.editor.hint}</p>
      <Notice>{t.noAccessNote}</Notice>
      {draft.length === 0 ? <p>{t.editor.empty}</p> : (
        <ul aria-label={t.editor.selected}>
          {draft.map((d, i) => (
            <li key={d.userId} data-testid={`member-${d.userId}`}>
              {nameText(names.get(d.userId), d.userId)}
              <Select label={t.editor.roleLabel} name={`role-${d.userId}`} value={d.role}
                onChange={(e) => { const role = e.target.value as CommitteeRole; setDraft(draft.map((x, j) => (j === i ? { ...x, role } : x))); setNote(null); }}
                options={[{ value: "chair", label: t.roles.chair }, { value: "member", label: t.roles.member }]} />
              <Button type="button" tone="secondary" onClick={() => { setDraft(draft.filter((_, j) => j !== i)); setNote(null); }}>{t.editor.remove}</Button>
            </li>
          ))}
        </ul>
      )}
      {candidates === "unavailable" ? <p role="alert">{t.errors.candidates}</p> : null}
      {Array.isArray(candidates) && !full ? (
        free.length === 0 ? <p>{t.editor.noCandidates}</p> : (
          <Select label={t.editor.addLabel} name="add" value="" placeholder={t.editor.addPlaceholder}
            onChange={(e) => { if (e.target.value !== "") { setDraft([...draft, { userId: e.target.value, role: "member" }]); setNote(null); } }}
            options={free.map((c) => ({ value: c.personId, label: nameText(c.name, c.personId) }))} />
        )
      ) : null}
      {problem !== null ? <p role="alert">{t.problems[problem]}</p> : null}
      <Button type="submit" busy={busy}>{busy ? t.editor.saving : t.editor.save}</Button>
      {note !== null ? <p data-testid="note" role={note.tone === "alert" ? "alert" : "status"}>{note.text}</p> : null}
    </form>
  );
}
