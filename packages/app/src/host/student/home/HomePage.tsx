"use client";

import { Button, PracticeBadge, Select, Tag } from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { appHref } from "../../../../../../src/components/index.ts";
import type { MyCourse } from "../../../../../../src/components/student/my-assignments-read.ts";
import { readMyWorks, type WorksRead } from "../../../../../../src/components/student/radovi/works-read.ts";
import { createApi, signInHref } from "../../../../../../src/client/api.ts";

import { nextPath, type Base } from "../../../bases";
import { useHost } from "../../context";
import { startWorkAction } from "../start-work/action";
import { CodeCard, CodeForm } from "./CodeForm";
import { protoDateTime, protoToday } from "./format";
import styles from "./Home.module.css";
import { homeText as t } from "./messages.hr";
import { continueRow, coursesWithoutTask, deadlineTag, flatRows, nearTag, ORDERS, rowAction, rowRoute, sections, type Order, type RowKind, type TaskRow } from "./model";

const dueText = protoDateTime;

function Row({ row, now, base, action }: { row: TaskRow; now: number; base: Base; action: ReturnType<typeof startWorkAction> }) {
  const { label, primary } = rowAction(row.kind);
  const near = row.kind === "predano" ? null : nearTag(row.dueAt, now);
  const deadline = deadlineTag(row, now);
  // E-2h: the row's link names the task and is described by the line with the deadline and its tags.
  const whenId = `po-rok-${row.id}`;
  return (
    <li className={styles.item}>
      <span>
        <span className={styles.eyebrow}>{row.course}</span>
        <span className={styles.title}>{row.title}</span>
        <span className={styles.when} id={whenId}>
          {row.kind === "predano" ? <span>{t.submitted}</span> : <span>{(row.extended ? t.extendedDue : t.due).replace("{due}", dueText(row.dueAt))}</span>}
          {near === null ? null : <Tag tone="warn">{near}</Tag>}
          {deadline === null ? null : <Tag tone={deadline.kind === "late" ? "warn" : "neutral"}>{deadline.text}</Tag>}
          {row.kind === "obavijest" ? <Tag tone="open">{t.noticeFirst}</Tag> : null}
          <PracticeBadge practice={row.practice} />
        </span>
      </span>
      <span className={styles.itemActions}>
        <a className={styles.open} data-tone={primary ? "primary" : "secondary"} aria-label={t.openFor.replace("{action}", label).replace("{title}", row.title)}
          aria-describedby={whenId} href={appHref(base, rowRoute(row))}>{label}</a>
        {action}
      </span>
    </li>
  );
}

function Hero() {
  // The date is the browser's moment in Zagreb time; empty until mounted, so server and client markup agree.
  const [today, setToday] = useState("");
  useEffect(() => setToday(protoToday(new Date())), []);
  return (
    <div className={styles.hero}>
      <span className={styles.meta}>{today}</span>
      <h1>{t.heading} <em>{t.headingEm}</em></h1>
      <p className={styles.lede}>{t.lede}</p>
    </div>
  );
}

function Empty() {
  return (
    <div className={`${styles.card} ${styles.center}`}>
      <h2>{t.emptyHeading}</h2>
      <p className={styles.note}>{t.emptyBody}</p>
      <h3>{t.emptyCode}</h3>
      <CodeForm />
      <h3>{t.emptyNext}</h3>
      <div className={styles.steps}>
        {t.steps.map((step) => (
          <div key={step.title} className={styles.step}><h3>{step.title}</h3><span className={styles.meta}>{step.body}</span></div>
        ))}
      </div>
    </div>
  );
}

/** P-12: every course without a task, each with its message, then the one code card. */
function CoursesWithoutTask({ courses }: { courses: readonly MyCourse[] }) {
  return (
    <>
      {courses.length > 1 ? <h2 className={styles.hidden}>{t.coursesWithoutTask}</h2> : null}
      {courses.map((course) => (
        <div className={styles.course} key={course.id}>
          <span className={styles.eyebrow}>{t.courseLabel}</span>
          <h2>{course.name}</h2>
          <p className={styles.note}>{t.noTask}</p>
        </div>
      ))}
      <CodeCard />
    </>
  );
}

/**
 * E-2 "Početna" (WEB-2102, S-02): "nastavak rada", the flat "Moji zadaci" and the
 * code card, over student.assignments.get and student.assignment-work.get. A state
 * the work-state read did not give is not guessed: those rows are "zadatak" or
 * "obavijest". The error state asks again with a real re-read.
 */
export function HomePage() {
  const { base } = useHost();
  const router = useRouter();
  const [read, setRead] = useState<WorksRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [order, setOrder] = useState<Order>("rok");
  useEffect(() => {
    let live = true;
    setRead(null);
    void readMyWorks(createApi() as unknown as Parameters<typeof readMyWorks>[0]).then((result) => {
      if (live) setRead(result);
    });
    return () => {
      live = false;
    };
  }, [attempt]);
  const go = (route: string) => router.push(nextPath(base, route));

  let body;
  if (read === null) {
    body = (
      <div className={styles.course} aria-busy="true" role="status">
        <span className={styles.hidden}>{t.loading}</span>
        <div className={styles.skel} data-w="40" />
        <div className={styles.item}><div className={styles.skel} data-w="80" /><div className={styles.skel} data-w="60" /></div>
        <div className={styles.item}><div className={styles.skel} data-w="80" /><div className={styles.skel} data-w="40" /></div>
      </div>
    );
  }
  else if (read.kind === "signedOut") {
    body = (
      <div className={`${styles.card} ${styles.center}`}>
        <p role="status">{t.signedOut}</p>
        <p><a className="btn" href={signInHref(appHref(base, "/zadaci"))}>{t.signIn}</a></p>
      </div>
    );
  } else if (read.kind === "unavailable") {
    body = (
      <div className={styles.card} role="alert">
        <h2>{t.errorHeading}</h2>
        <p className={styles.note}>{t.errorBody}</p>
        <Button className={styles.start} onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>
      </div>
    );
  } else if (read.courses.length === 0) body = <Empty />;
  else {
    const rows = flatRows(read.courses, read.states);
    const now = Date.now();
    const current = continueRow(rows);
    body = rows.length === 0 ? <CoursesWithoutTask courses={coursesWithoutTask(read.courses)} /> : (
      <>
        {current === null ? null : (
          <section className={styles.continue} aria-labelledby="po-n">
            <span className={styles.eyebrow}>{current.typeLabel} · {current.course}</span>
            <b id="po-n">{current.title}</b>
            <span className={styles.meta}>{t.continueMeta.replace("{due}", dueText(current.dueAt))}</span>
            <Button aria-label={t.openFor.replace("{action}", t.openWork).replace("{title}", current.title)}
              onClick={() => go(rowRoute(current))}>{t.openWork}</Button>
          </section>
        )}
        <section className={styles.section} aria-labelledby="po-h">
          <h2 id="po-h">{t.tasksHeading}</h2>
          <Select label={t.orderLabel} value={order} onChange={(event) => setOrder(event.target.value as Order)}
            options={ORDERS.map((value) => ({ value, label: t.orders[value] }))} />
          {sections(rows, now, order).map((group) => (
            <div className={styles.group} key={group.key}>
              {order === "rok" ? <h3 className={styles.groupHeading}>{t.sections[group.key]}</h3> : null}
              <ul className={styles.list}>
                {group.rows.map((row) => (
                  <Row key={row.id} row={row} now={now} base={base}
                    action={row.kind === "predano" || row.kind === "obavijest" ? null : startWorkAction({ id: row.id, title: row.title, dueAt: row.dueAt, noticeFirst: false })} />
                ))}
              </ul>
            </div>
          ))}
        </section>
        <CodeCard />
      </>
    );
  }
  return (
    <div className={styles.wrap}>
      <Hero />
      {body}
    </div>
  );
}

export type { RowKind };
