"use client";

import { useEffect, useState } from "react";
import { Button, Card, RouteLoading, Select } from "@ductura/ui";

import type { createApi } from "@/client/api";
import { ContributionCard } from "../../student/work-team/ContributionCard";
import { fullName, plural } from "../../student/work-team/model";
import { teacherTeamText as t } from "./messages.hr";
import { hasRoom, membersByName, peopleByName } from "./model";
import {
  createTeam, memberAction, readTeamContribution, readTeams,
  type ContributionRead, type Read, type Setting, type TeamsView, type Write,
} from "./read";

type Api = ReturnType<typeof createApi>;

const FAILURE: Readonly<Record<Exclude<Write["kind"], "done" | "signedOut">, string>> = {
  conflict: t.teams.conflict, notFound: t.teams.notFound, invalid: t.teams.invalid, unknown: t.teams.unknown,
};

/**
 * WEB-V19-GRUPA: the teams of one assignment (teacher.work-teams.get/post, teacher.work-team-member.post) and
 * what the server recorded for each team (teacher.work-team-contribution.get). Teams are numbered in the
 * server's order; members and students without a team are by name; a member's state is a fact ("dio predan"),
 * not a mark. Add and remove are two writes of the server and the lists are read again after any answer.
 * A standalone component, mounted by TeamsPage. `setting` is what the setting panel last read: null while it
 * is unknown, and then the teams are shown without the buttons that need it.
 */
export function TeamsPanel({ assignmentId, call, setting, version, onSignedOut }: {
  assignmentId: string; call: () => Api; setting: Setting | null; version: number; onSignedOut: () => void;
}) {
  const [read, setRead] = useState<Read<TeamsView> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [note, setNote] = useState<{ tone: "status" | "alert"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [shown, setShown] = useState<string | null>(null);
  const [contribution, setContribution] = useState<ContributionRead | null>(null);

  useEffect(() => {
    let live = true;
    void readTeams(call(), assignmentId).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") onSignedOut();
      setRead(result);
    });
    return () => { live = false; };
    // `call` and `onSignedOut` are stable per visit; the attempt and the setting's version ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, assignmentId, version]);

  useEffect(() => {
    if (shown === null) return;
    let live = true;
    setContribution(null);
    void readTeamContribution(call(), assignmentId, shown).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") onSignedOut();
      setContribution(result);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, assignmentId, attempt]);

  const reload = () => setAttempt((n) => n + 1);

  async function run(key: string, work: () => Promise<Write<unknown>>, done: string) {
    if (busy !== null) return;
    setNote(null);
    setBusy(key);
    const outcome = await work();
    setBusy(null);
    if (outcome.kind === "signedOut") { onSignedOut(); return; }
    setNote(outcome.kind === "done" ? { tone: "status", text: done } : { tone: "alert", text: FAILURE[outcome.kind] });
    reload();
  }

  if (read === null || read.kind === "signedOut") return <Card level={2} title={t.teams.title}><RouteLoading label={t.loading} /></Card>;
  if (read.kind !== "ok") {
    return (
      <Card level={2} title={t.teams.title}>
        <p role="alert">{read.kind === "notFound" ? t.gone : t.unavailable}</p>
        {read.kind === "unavailable" && <p><Button tone="quiet" onClick={() => { setRead(null); reload(); }}>{t.retry}</Button></p>}
      </Card>
    );
  }
  const { teams, unassigned } = read.value;
  const off = setting !== null && !setting.enabled;
  const open = setting === null ? teams : teams.filter((team) => hasRoom(team, setting));
  return (
    <>
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
      <Card level={2} title={t.teams.title}>
        {off && <p data-testid="teams-off">{t.teams.disabled}</p>}
        <p>
          <Button disabled={busy !== null || off} busy={busy === "create"}
            onClick={() => void run("create", () => createTeam(call(), assignmentId), t.teams.created)}>
            {busy === "create" ? t.teams.creating : t.teams.create}
          </Button>
        </p>
        {teams.length === 0 ? <p>{t.teams.none}</p> : teams.map((team, index) => {
          const n = String(index + 1);
          return (
            <section key={team.teamId} aria-label={t.teams.teamLabel.replace("{n}", n)} data-testid="team">
              <h3>{t.teams.teamLabel.replace("{n}", n)}</h3>
              <p>{plural(team.members.length, t.teams.memberCount)}</p>
              {team.members.length === 0 ? <p>{t.teams.emptyTeam}</p> : (
                <ul>
                  {membersByName(team.members).map((m) => (
                    <li key={m.studentId} data-testid="team-member">
                      {fullName(m)} <span>({t.teams.state[m.workState]})</span>{" "}
                      <Button tone="quiet" disabled={busy !== null} busy={busy === `remove-${m.studentId}`}
                        aria-label={t.teams.removeAria.replace("{name}", fullName(m)).replace("{n}", n)}
                        onClick={() => void run(`remove-${m.studentId}`, () => memberAction(call(), assignmentId, team.teamId, { studentId: m.studentId, action: "remove" }), t.teams.removed)}>
                        {busy === `remove-${m.studentId}` ? t.teams.removing : t.teams.remove}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <p>
                {shown === team.teamId ? (
                  <Button tone="quiet" onClick={() => setShown(null)}>{t.teams.hideContribution}</Button>
                ) : (
                  <Button tone="quiet" aria-label={t.teams.showContributionAria.replace("{n}", n)} onClick={() => setShown(team.teamId)}>{t.teams.showContribution}</Button>
                )}
              </p>
              {shown === team.teamId && <ContributionCard read={contribution} retry={reload} />}
            </section>
          );
        })}
      </Card>
      <Card level={2} title={t.unassigned.title}>
        {unassigned.length === 0 ? <p>{t.unassigned.none}</p> : (
          <>
            {open.length === 0 && <p>{t.unassigned.noTeams}</p>}
            <ul>
              {peopleByName(unassigned).map((s) => {
                const chosen = pick[s.studentId] ?? "";
                return (
                  <li key={s.studentId} data-testid="unassigned">
                    <strong>{fullName(s)}</strong>
                    {open.length > 0 && (
                      <>
                        <Select label={t.unassigned.pick.replace("{name}", fullName(s))} placeholder={t.unassigned.pickPlaceholder} disabled={busy !== null} value={chosen}
                          options={open.map((team) => ({ value: team.teamId, label: t.teams.teamLabel.replace("{n}", String(teams.indexOf(team) + 1)) }))}
                          onChange={(e) => setPick({ ...pick, [s.studentId]: e.target.value })} />
                        <Button tone="quiet" disabled={busy !== null || chosen === "" || off} busy={busy === `add-${s.studentId}`} aria-label={t.unassigned.addAria.replace("{name}", fullName(s))}
                          onClick={() => void run(`add-${s.studentId}`, () => memberAction(call(), assignmentId, chosen, { studentId: s.studentId, action: "add" }), t.teams.added)}>
                          {busy === `add-${s.studentId}` ? t.unassigned.adding : t.unassigned.add}
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
