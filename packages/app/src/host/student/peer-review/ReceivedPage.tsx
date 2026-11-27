"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@ductura/ui";

import { createApi, goToSignIn } from "@/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { Denied, Lines, Marks, notAnswer } from "./Frame";
import { peerReviewText as t } from "./messages.hr";
import { dayLabel, inSentOrder } from "./model";
import { readReceived, type Read, type ReceivedView } from "./read";

type Api = ReturnType<typeof createApi>;
const defaultCall = (): Api => createApi();

/**
 * Student: "Primljene recenzije" of one assignment (WEB-V19-RECENZIJA-STUDENT, over student.peer-reviews-received.get).
 * The reviews of the own work, as the server gives them: by rubric and a general comment, never with who wrote
 * them and never with a number, a mark or an order of quality; they come in the order they were sent. A withdrawn
 * review is not in the answer. `call` is for tests.
 */
export default function ReceivedPage({ assignmentId, call = defaultCall }: { assignmentId: string; call?: () => Api }) {
  const { base } = useHost();
  const here = appHref(base, `/zadatak/${encodeURIComponent(assignmentId)}/recenzija/primljene`);
  const [read, setRead] = useState<Read<ReceivedView> | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void readReceived(call(), assignmentId).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") goToSignIn(here);
      setRead(result);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, assignmentId]);
  const retry = useCallback(() => { setRead(null); setAttempt((n) => n + 1); }, []);

  const back = <p><a href={appHref(base, `/zadatak/${encodeURIComponent(assignmentId)}/recenzija`)}><span aria-hidden="true">← </span>{t.received.linkToList}</a></p>;
  const head = <header><h1>{t.received.title}</h1><p>{t.received.lead}</p></header>;
  if (read?.kind === "denied") return <Denied />;
  const pending = notAnswer(read, t.received.title, retry);
  if (pending !== null || read === null || read.kind !== "ok") return <div className="page">{back}{head}{pending}</div>;
  const reviews = inSentOrder(read.view.reviews);

  return (
    <div className="page">
      {back}{head}
      <Marks anonymous={false} />
      {reviews.length === 0 && <Card level={2} title={t.received.title}><p data-testid="received-none">{t.received.none}</p></Card>}
      {reviews.map((review) => (
        <Card key={review.reviewId} level={2} title={t.received.review}>
          <p>{t.received.submittedAt.replace("{date}", dayLabel(review.submittedAt))}</p>
          <div data-testid="received-review">
            {review.byRubric.map((rubric) => (
              <section key={rubric.key}>
                <h3>{rubric.label}</h3>
                <Lines text={rubric.text} />
              </section>
            ))}
            {review.general !== null && (
              <section>
                <h3>{t.received.general}</h3>
                <Lines text={review.general} />
              </section>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
