"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Dialog, RouteLoading } from "@ductura/ui";

import { createApi, goToSignIn } from "@/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { editorPath } from "../enrol/model";
import { ContributionCard } from "./ContributionCard";
import { workTeamText as t } from "./messages.hr";
import { byName, countOf, fullName, mayFormTeam, plural } from "./model";
import {
  readContribution, readTeam, teamAction,
  type ActionOutcome, type ContributionRead, type TeamAction, type TeamRead,
} from "./read";

type Api = ReturnType<typeof createApi>;
const defaultCall = (): Api => createApi();

const FAILURE: Readonly<Record<Exclude<ActionOutcome["kind"], "done" | "signedOut">, string>> = {
  conflict: t.outcome.conflict, notFound: t.outcome.notFound, invalid: t.outcome.invalid, unknown: t.outcome.unknown,
};
const DONE: Readonly<Record<TeamAction["action"], string>> = { create: t.outcome.created, join: t.outcome.joined, leave: t.outcome.left };

/**
 * Student: "Moj tim" (WEB-V19-GRUPA, over student.work-team.*). The team of the student on one assignment:
 * to found or join one (when the students form the teams), the names of the members of the own team only,
 * leaving it after a confirmation, a link to the own work, and what the server recorded for the parts of the
 * team (the same card the teacher sees). A note of success follows only the server's answer (B-6); after any
 * answer, also a refusal, the state is read again, since the server may know something the page did not.
 * `call` is for tests.
 */
export default function TeamPage({ assignmentId, call = defaultCall }: { assignmentId: string; call?: () => Api }) {
  const { base } = useHost();
  const here = appHref(base, `/zadatak/${encodeURIComponent(assignmentId)}/tim`);
  const [team, setTeam] = useState<TeamRead | null>(null);
  const [contribution, setContribution] = useState<ContributionRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [note, setNote] = useState<{ tone: "status" | "alert"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let live = true;
    void readTeam(call(), assignmentId).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") goToSignIn(here);
      setTeam(result);
    });
    void readContribution(call(), assignmentId).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") goToSignIn(here);
      setContribution(result);
    });
    return () => { live = false; };
    // `call` and `here` are stable per visit; the attempt is what asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, assignmentId]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const retry = useCallback(() => { setTeam(null); setContribution(null); setAttempt((n) => n + 1); }, []);

  async function act(body: TeamAction) {
    if (busy !== null) return;
    setNote(null);
    setBusy("teamId" in body ? `join-${body.teamId}` : body.action);
    const outcome = await teamAction(call(), assignmentId, body);
    setBusy(null);
    setConfirming(false);
    if (outcome.kind === "signedOut") { goToSignIn(here); return; }
    setNote(outcome.kind === "done" ? { tone: "status", text: DONE[body.action] } : { tone: "alert", text: FAILURE[outcome.kind] });
    reload();
  }

  const back = <p><a href={appHref(base, `/zadatak/${encodeURIComponent(assignmentId)}`)}><span aria-hidden="true">← </span>{t.back}</a></p>;
  const head = <header><h1>{t.title}</h1><p>{t.lead}</p></header>;

  if (team === null || team.kind === "signedOut") return <div className="page">{back}{head}<RouteLoading label={t.loading} /></div>;
  if (team.kind === "notFound") return <div className="page">{back}{head}<Card level={2} title={t.title}><p role="alert">{t.gone}</p></Card></div>;
  if (team.kind === "unavailable") {
    return (
      <div className="page">{back}{head}
        <Card level={2} title={t.title}>
          <p role="alert">{t.unavailable}</p>
          <p><Button tone="quiet" onClick={retry}>{t.retry}</Button></p>
        </Card>
      </div>
    );
  }
  const view = team.view;
  return (
    <div className="page">
      {back}{head}
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
      {view.state === "disabled" && <Card level={2} title={t.title}><p data-testid="team-disabled">{t.disabled}</p></Card>}
      {view.state === "none" && (
        <Card level={2} title={t.none.title}>
          <p>{mayFormTeam(view) ? t.none.choice : t.none.assigned}</p>
          {mayFormTeam(view) && (
            <>
              <p><Button busy={busy === "create"} disabled={busy !== null} onClick={() => void act({ action: "create" })}>{busy === "create" ? t.creating : t.create}</Button></p>
              <h3>{t.openTeamsTitle}</h3>
              {view.openTeams.length === 0 ? <p>{t.noOpenTeams}</p> : (
                <ul>
                  {view.openTeams.map((open) => (
                    <li key={open.teamId} data-testid="open-team">
                      {t.openTeamLine.replace("{n}", countOf(open.memberCount))}{" "}
                      <Button tone="quiet" busy={busy === `join-${open.teamId}`} disabled={busy !== null}
                        aria-label={t.joinAria.replace("{n}", countOf(open.memberCount))} onClick={() => void act({ action: "join", teamId: open.teamId })}>
                        {busy === `join-${open.teamId}` ? t.joining : t.join}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Card>
      )}
      {view.state === "member" && (
        <Card level={2} title={t.member.title}>
          <p>{plural(view.team.members.length, t.member.memberCount)}</p>
          <ul>{byName(view.team.members).map((m, i) => <li key={`${fullName(m)}-${i}`} data-testid="team-member">{fullName(m)}</li>)}</ul>
          <p>
            <a className="btn" href={appHref(base, editorPath(assignmentId))}>{t.openWork}</a>{" "}
            <Button tone="quiet" disabled={busy !== null} onClick={() => setConfirming(true)}>{t.member.leave}</Button>
          </p>
          <p>{t.member.leaveHint}</p>
          <Dialog open={confirming} title={t.confirmLeave.title} onClose={() => { if (busy === null) setConfirming(false); }} dismissible={busy === null}
            actions={(
              <>
                <Button tone="quiet" disabled={busy !== null} onClick={() => setConfirming(false)}>{t.confirmLeave.no}</Button>
                <Button busy={busy === "leave"} disabled={busy !== null} onClick={() => void act({ action: "leave" })}>{busy === "leave" ? t.member.leaving : t.confirmLeave.yes}</Button>
              </>
            )}>
            <p>{t.confirmLeave.body}</p>
          </Dialog>
        </Card>
      )}
      {view.state !== "disabled" && <ContributionCard read={contribution} retry={reload} />}
    </div>
  );
}
