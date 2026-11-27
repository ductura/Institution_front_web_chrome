"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@ductura/ui";

import { createApi, goToSignIn } from "@/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import type { NumbersView, WorkNumbers } from "./model";
import { readMyNumbers } from "./read";
import { myNumbersText as t } from "./messages.hr";

function daysLeftText(n: number): string {
  return n < 0 ? t.duePassed : n === 0 ? t.dueToday : t.daysLeftValue(n);
}

function Figure({ label, value }: { label: string; value: string }) {
  return <><dt>{label}</dt><dd>{value}</dd></>;
}

function Numbers({ n }: { n: WorkNumbers }) {
  return (
    <Card title={n.work.title}>
      <p>{n.work.courseName}</p>
      <dl>
        <Figure label={t.versions} value={n.versions === null ? t.notAvailable : n.versions.more ? t.versionsMore(n.versions.count) : String(n.versions.count)} />
        <Figure label={t.days} value={n.days === null ? t.notAvailable : n.days.more ? t.daysMore(n.days.count) : String(n.days.count)} />
        {n.work.state === "submitted"
          ? <Figure label={t.submitted} value={t.stateSubmitted} />
          : <Figure label={t.daysLeft} value={n.daysLeft === null ? t.notAvailable : daysLeftText(n.daysLeft)} />}
        {n.milestones === null ? null : <Figure label={t.milestones} value={t.milestonesValue(n.milestones.done, n.milestones.total)} />}
      </dl>
    </Card>
  );
}

/**
 * "Moj rad u brojkama" (F4-PM2-R20; M7.13, A-10), mounted on "Moji radovi". `here` is the path of the page: after sign-in the student comes back there.
 * Own works only (student-work.works.get); the figures of a work come from its saved versions and milestones; no rhythm, no comparison.
 */
export default function MyNumbers({ here }: { here: string }) {
  const { base } = useHost();
  const [view, setView] = useState<NumbersView | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setView(null);
    void readMyNumbers(createApi(), new Date()).then((next) => { if (active) setView(next); });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    if (view?.kind === "signedOut") goToSignIn(appHref(base, here));
  }, [view, base, here]);

  return (
    <section aria-labelledby="my-numbers-title">
      <h2 id="my-numbers-title">{t.title}</h2>
      <p>{t.lead}</p>
      {view === null ? <p role="status">{t.loading}</p> : null}
      {view?.kind === "empty" ? <p>{t.empty}</p> : null}
      {view?.kind === "signedOut" ? <p role="alert">{t.signedOut}</p> : null}
      {view?.kind === "unavailable" ? <><p role="alert">{t.unavailable}</p><Button onClick={() => setAttempt((x) => x + 1)}>{t.retry}</Button></> : null}
      {view?.kind === "ready" ? <ul>{view.items.map((n) => <li key={n.work.workId}><Numbers n={n} /></li>)}</ul> : null}
    </section>
  );
}
