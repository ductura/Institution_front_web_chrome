"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@ductura/ui";

import { createApi, goToSignIn } from "@/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { Marks, Denied, notAnswer } from "./Frame";
import { peerReviewText as t } from "./messages.hr";
import { dueLabel, mayWrite, taskStatus, workNumber } from "./model";
import { readTasks, type Read, type TasksView } from "./read";

type Api = ReturnType<typeof createApi>;
const defaultCall = (): Api => createApi();

/**
 * Student: "Recenzija radova" of one assignment (WEB-V19-RECENZIJA-STUDENT, over student.peer-review-tasks.get).
 * The works the teacher allocated, as "Rad 1, 2, …" with the deadline and whether the review was sent; a link to
 * write the review while the round is open, and a link to the reviews received. Loading and error are not "no
 * works". `call` is for tests.
 */
export default function TasksPage({ assignmentId, call = defaultCall }: { assignmentId: string; call?: () => Api }) {
  const { base } = useHost();
  const here = appHref(base, `/zadatak/${encodeURIComponent(assignmentId)}/recenzija`);
  const [read, setRead] = useState<Read<TasksView> | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void readTasks(call(), assignmentId).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") goToSignIn(here);
      setRead(result);
    });
    return () => { live = false; };
    // `call` and `here` are stable per visit; the attempt is what asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, assignmentId]);
  const retry = useCallback(() => { setRead(null); setAttempt((n) => n + 1); }, []);

  const back = <p><a href={appHref(base, `/zadatak/${encodeURIComponent(assignmentId)}`)}><span aria-hidden="true">← </span>{t.back}</a></p>;
  const head = <header><h1>{t.title}</h1><p>{t.lead}</p></header>;
  if (read?.kind === "denied") return <Denied />;
  const pending = notAnswer(read, t.list.title, retry);
  if (pending !== null || read === null || read.kind !== "ok") return <div className="page">{back}{head}{pending}</div>;
  const view = read.view;
  const received = <p><a href={appHref(base, `/zadatak/${encodeURIComponent(assignmentId)}/recenzija/primljene`)} data-testid="received-link">{t.list.receivedLink}</a></p>;

  return (
    <div className="page">
      {back}{head}
      <Marks />
      <Card level={2} title={t.list.title}>
        {view.state === "disabled" && <p data-testid="peer-review-disabled">{t.list.disabled}</p>}
        {view.state === "none" && <p data-testid="peer-review-none">{t.list.none}</p>}
        {view.state === "closed" && <p role="status" data-testid="peer-review-closed">{t.list.closed}</p>}
        {view.tasks.length > 0 && (
          <ul>
            {view.tasks.map((task, i) => (
              <li key={task.taskId} data-testid="peer-review-task" data-state={task.state}>
                <strong>{t.list.workLabel.replace("{n}", String(workNumber(i)))}</strong>{", "}
                {taskStatus(view, task)}{", "}
                {t.list.due.replace("{date}", dueLabel(task.dueAt))}{" "}
                {mayWrite(view, task) && (
                  <a className="btn" href={appHref(base, `/zadatak/${encodeURIComponent(assignmentId)}/recenzija/rad/${encodeURIComponent(task.taskId)}`)}
                    aria-label={t.list.writeAria.replace("{n}", String(workNumber(i)))}>{t.list.write}</a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {view.state !== "disabled" && received}
    </div>
  );
}
