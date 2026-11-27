"use client";

import { useEffect, useState } from "react";

import { Card, RouteLoading } from "@ductura/ui";
import { createApi, goToSignIn } from "@/client/api";

import { LoadAlert } from "../../states/States";

import { rubricText as t } from "./messages.hr";
import { readRubric, type RubricRead } from "./read";

/** The card over a finished read (`null` while it loads). Levels are listed in the order of the contract, with no mark of the student's work. */
export function RubricView({ read, retry }: { read: RubricRead | null; retry: () => void }) {
  if (read === null || read.kind === "signedOut") {
    return <Card level={2} title={t.title}><RouteLoading label={t.loading} /></Card>;
  }
  if (read.kind === "unavailable") {
    return (
      <Card level={2} title={t.title}>
        <div data-testid="rubric-state"><LoadAlert body={t.unavailable} retry={{ label: t.retry, onRetry: retry }} /></div>
      </Card>
    );
  }
  if (read.kind === "notFound" || read.kind === "empty") {
    return (
      <Card level={2} title={t.title}>
        <p role="status" data-testid="rubric-state">{read.kind === "notFound" ? t.gone : t.empty}</p>
      </Card>
    );
  }
  return (
    <Card level={2} title={t.title}>
      <p>{t.lead}</p>
      <ol data-testid="rubric-criteria">
        {read.criteria.map((c) => (
          <li key={c.id} data-testid="rubric-criterion">
            <strong>{c.title}</strong>
            <ul>
              {c.levels.map((l, i) => (
                <li key={i}>
                  <span>{t.level.replace("{n}", String(i + 1))}: <b>{l.label}</b></span>{" "}
                  <span>{l.descriptor === "" ? t.noDescriptor : l.descriptor}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** The card of one assignment's board: reads the rubric, signs in again when the session is gone. */
export function RubricCard({ assignmentId, here }: { assignmentId: string; here: string }) {
  const [read, setRead] = useState<RubricRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setRead(null);
    void readRubric(createApi(), assignmentId).then((r) => {
      if (!live) return;
      if (r.kind === "signedOut") return goToSignIn(here);
      setRead(r);
    });
    return () => { live = false; };
  }, [assignmentId, here, attempt]);
  return <RubricView read={read} retry={() => setAttempt((n) => n + 1)} />;
}
