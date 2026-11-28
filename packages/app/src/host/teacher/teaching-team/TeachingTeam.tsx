"use client";

import { Button, Checkbox, DataTable, Select, TextField, type DataTableColumn } from "@ductura/ui";
import { useEffect, useId, useRef, useState } from "react";

import { goToSignIn } from "../../../../../../src/client/api";
import { createTeachingTeam, groupName, MAX_GROUP_NAME, type TeachingTeamPort, type TeachingTeamView } from "../../../../../../src/client/teaching-team";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { teachingTeamHr as text } from "./messages.hr";
import styles from "./TeachingTeam.module.css";

type HolderView = Extract<TeachingTeamView, { role: "holder" }>;
type Person = HolderView["assistants"][number];
type Action = () => ReturnType<TeachingTeamPort["saveAssistants"]>;
type Save = (action: Action, success: string) => Promise<void>;

const assistantColumn: DataTableColumn<Person> = { id: "name", header: text.assistant, rowHeader: true, cell: (row) => row.name };
const studentColumn: DataTableColumn<Person> = { ...assistantColumn, header: text.student };
const rowKey = (row: Person) => row.id;

function MembershipTable({ caption, column, rows, memberLabel, selected, onChange, empty, busy }: {
  caption: string; column: DataTableColumn<Person>; rows: Person[]; memberLabel: string; selected: string[];
  onChange: (next: string[]) => void; empty: string; busy: boolean;
}) {
  const membership: DataTableColumn<Person> = {
    id: "member", header: memberLabel,
    cell: (row) => <Checkbox label={row.name} checked={selected.includes(row.id)} disabled={busy}
      onChange={(event) => onChange(event.currentTarget.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))} />,
  };
  return <DataTable caption={caption} columns={[column, membership]} rows={rows} rowKey={rowKey} empty={empty} />;
}

function sameMembers(a: string[], b: string[]) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** institution.course-groups.post: the holder and a collaborator may add a seminar group. */
function NewGroup({ port, save, busy }: { port: TeachingTeamPort; save: Save; busy: boolean }) {
  const [name, setName] = useState("");
  return (
    <div className={styles.actions}>
      <TextField label={text.newGroupName} hint={text.newGroupHint} maxLength={MAX_GROUP_NAME} value={name} disabled={busy}
        onChange={(event) => setName(event.currentTarget.value)} />
      <Button type="button" disabled={busy || groupName(name) === null}
        onClick={() => void save(async () => { const result = await port.createGroup(name); if (result.kind === "saved") setName(""); return result; }, text.groupCreated)}>{text.createGroup}</Button>
    </div>
  );
}

/** institution.course-group-teachers.post: the holder puts a teacher who is not yet in the group into it. */
function GroupTeacher({ port, save, busy, groupId, taken, teachers }: {
  port: TeachingTeamPort; save: Save; busy: boolean; groupId: string; taken: string[]; teachers: Person[];
}) {
  const options = teachers.filter(({ id }) => !taken.includes(id));
  const [teacherId, setTeacherId] = useState("");
  const chosen = options.some(({ id }) => id === teacherId) ? teacherId : (options[0]?.id ?? "");
  if (options.length === 0) return <p>{text.noTeacherToAdd}</p>;
  return (
    <div className={styles.actions}>
      <Select label={text.groupTeacher} value={chosen} disabled={busy}
        options={options.map(({ id, name }) => ({ value: id, label: name }))}
        onChange={(event) => setTeacherId(event.currentTarget.value)} />
      <Button type="button" disabled={busy || chosen === ""}
        onClick={() => void save(() => port.assignGroupTeacher(groupId, chosen), text.groupTeacherAdded)}>{text.addGroupTeacher}</Button>
    </div>
  );
}

export function TeachingTeamContent({ view, port, save, busy, groupId, setGroupId }: {
  view: TeachingTeamView; port: TeachingTeamPort; save: Save; busy: boolean;
  groupId: string; setGroupId: (id: string) => void;
}) {
  if (view.role === "assistant") {
    return <>
      {view.groups.length === 0 ? <p>{text.noAssignedGroups}</p> : view.groups.map((group) => (
        <DataTable key={group.id} caption={text.groupStudents(group.name)} columns={[studentColumn]}
          rows={group.students} rowKey={rowKey} empty={text.noStudents} />
      ))}
      <NewGroup port={port} save={save} busy={busy} />
    </>;
  }
  return <HolderEditor view={view} port={port} save={save} busy={busy} groupId={groupId} setGroupId={setGroupId} />;
}

function HolderEditor({ view, port, save, busy, groupId, setGroupId }: {
  view: HolderView; port: TeachingTeamPort; save: Save; busy: boolean;
  groupId: string; setGroupId: (id: string) => void;
}) {
  const [assistants, setAssistants] = useState(view.assistantIds);
  const group = view.groups.find((item) => item.id === groupId) ?? view.groups[0];
  const currentMembers = {
    assistants: group?.assistantIds ?? [],
    students: view.students.filter((row) => row.groupId === group?.id).map(rowKey),
  };
  const [groupDraft, setGroupDraft] = useState<typeof currentMembers | null>(null);
  const members = groupDraft ?? currentMembers;
  const teamChanged = !sameMembers(assistants, view.assistantIds);
  const groupChanged = !sameMembers(members.assistants, currentMembers.assistants) ||
    !sameMembers(members.students, currentMembers.students);
  return (
    <div className={styles.editor}>
      <MembershipTable caption={text.assistants} column={assistantColumn} rows={view.assistants} memberLabel={text.inTeam}
        selected={assistants} onChange={setAssistants} empty={text.noAssistants} busy={busy || groupChanged} />
      <div className={styles.actions}>
        <Button type="button" disabled={busy || !teamChanged}
          onClick={() => void save(() => port.saveAssistants(assistants), text.teamSaved)}>{text.saveTeam}</Button>
        {teamChanged && <Button type="button" tone="quiet" disabled={busy}
          onClick={() => setAssistants(view.assistantIds)}>{text.discard}</Button>}
      </div>
      <NewGroup port={port} save={save} busy={busy || teamChanged || groupChanged} />
      {group ? <>
        <GroupTeacher key={group.id} port={port} save={save} busy={busy || teamChanged || groupChanged} groupId={group.id}
          taken={group.assistantIds} teachers={view.assistants} />
        <Select label={text.group} value={group.id} disabled={busy || groupChanged}
          options={view.groups.map(({ id, name }) => ({ value: id, label: name }))}
          onChange={(event) => { setGroupDraft(null); setGroupId(event.currentTarget.value); }} />
        <MembershipTable caption={text.groupAssistants(group.name)} column={assistantColumn}
          rows={view.assistants.filter((row) => view.assistantIds.includes(row.id))} memberLabel={text.inGroup}
          selected={members.assistants} onChange={(next) => setGroupDraft({ ...members, assistants: next })}
          empty={text.noAssistants} busy={busy || teamChanged} />
        <MembershipTable caption={text.groupStudents(group.name)} column={studentColumn}
          rows={view.students.filter((row) => row.groupId === null || row.groupId === group.id)} memberLabel={text.inGroup}
          selected={members.students} onChange={(next) => setGroupDraft({ ...members, students: next })}
          empty={text.noStudents} busy={busy || teamChanged} />
        <p>{text.groupHint}</p>
        <div className={styles.actions}>
          <Button type="button" disabled={busy || !groupChanged}
            onClick={() => void save(() => port.saveGroup(group.id, members.assistants, members.students), text.groupSaved)}>{text.saveGroup}</Button>
          {groupChanged && <Button type="button" tone="quiet" disabled={busy}
            onClick={() => setGroupDraft(null)}>{text.discard}</Button>}
        </div>
      </> : <p>{text.noGroups}</p>}
    </div>
  );
}

/** NZ-14: the three roles with what each may do, the caller's own, and the way to the mentored works. */
export function TeamRoles({ role, mentorHref }: { role: TeachingTeamView["role"]; mentorHref: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h3 id={id}>{text.rolesTitle}</h3>
      <p>{text.yourRole(role === "holder" ? text.roleHolder : text.roleCollaborator)}</p>
      <ul>
        {text.roles.map((item) => (
          <li key={item.id}><strong>{item.name}</strong>: {item.can}{item.id === "mentor" && <> <a href={mentorHref}>{text.mentorLink}</a></>}</li>
        ))}
      </ul>
      {role === "holder" && <p>{text.adminNote}</p>}
    </section>
  );
}

function Panel({ courseId, busy, setBusy }: { courseId: string; busy: boolean; setBusy: (busy: boolean) => void }) {
  const { base } = useHost();
  const [port] = useState(() => createTeachingTeam(courseId));
  const [read, setRead] = useState<Awaited<ReturnType<TeachingTeamPort["read"]>> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [revision, setRevision] = useState(0);
  const [groupId, setGroupId] = useState("");
  const [feedback, setFeedback] = useState<{ error: boolean; label: string } | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    void port.read().then((result) => { if (active) setRead(result); });
    return () => { active = false; };
  }, [port, attempt]);

  useEffect(() => {
    if (read?.kind === "signedOut") goToSignIn(appHref(base, "/nastavnik"));
  }, [base, read]);

  async function save(action: Action, success: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await action();
      if (result.kind === "invalid") {
        setFeedback({ error: true, label: text.error.invalid });
        return;
      }
      const refreshed = result.kind === "signedOut" || result.kind === "forbidden" ? result : await port.read();
      setRead(refreshed);
      setRevision((value) => value + 1);
      if (result.kind === "saved") {
        setFeedback({ error: refreshed.kind !== "ready", label: refreshed.kind === "ready" ? success : text.savedUnreadable });
      } else if (result.kind !== "signedOut" && result.kind !== "forbidden") {
        setFeedback({ error: true, label: result.kind === "unavailable" ? text.saveUnavailable : text.error[result.kind] });
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className={styles.panel}>
      {busy && <p role="status">{text.saving}</p>}
      {feedback && <p role={feedback.error ? "alert" : "status"}>{feedback.label}</p>}
      {read === null ? <p role="status">{text.loading}</p>
        : read.kind === "ready" ? <><TeamRoles role={read.view.role} mentorHref={appHref(base, "/nastavnik/mentorstva")} /><TeachingTeamContent key={revision} view={read.view} port={port} save={save}
          busy={busy} groupId={groupId} setGroupId={setGroupId} /></>
        : <>
          <p role="alert">{text.error[read.kind]}</p>
          {read.kind !== "signedOut" && <div><Button type="button" onClick={() => {
            setRead(null);
            setFeedback(null);
            setAttempt((value) => value + 1);
          }}>{text.retry}</Button></div>}
        </>}
    </div>
  );
}

export function CourseTeachingTeam({ courseId, courseName }: { courseId: string; courseName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const panelId = useId();
  return (
    <div>
      <Button type="button" tone="quiet" disabled={busy} aria-label={`${text.title}, ${courseName}`}
        aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>{text.title}</Button>
      <div id={panelId} hidden={!open}>{open && <Panel courseId={courseId} busy={busy} setBusy={setBusy} />}</div>
    </div>
  );
}
