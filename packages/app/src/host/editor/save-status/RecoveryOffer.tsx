"use client";

import { useEffect, useState } from "react";
import { Button } from "@ductura/ui";

import { exportText } from "@/components/editor/EarlierDraft";
import { readJournalScope } from "@/components/editor/EditorPage.scope";
import SessionObserver from "@/components/shell/SessionObserver";
import { watchSessionEnd } from "@/client/session-end";
import { browserMarkStore, hasEnded, type SessionMark } from "@/client/session-marks";

import type { Base } from "../../../bases";
import { copyStorage, hasExitCopies, readExitCopies } from "./recovery";
import { exitCopyHr as t } from "./messages.hr";

type Offer = { session: SessionMark; copies: ReturnType<typeof readExitCopies> };

export function RecoveryOffer({ base }: { base: Base }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const store = copyStorage();
    if (!store || !hasExitCopies(store)) return;
    let live = true;
    let watch: ReturnType<typeof watchSessionEnd> | undefined;
    const startedAt = Date.now();
    void readJournalScope({ now: () => startedAt }).then((read) => {
      if (!live || read.kind !== "scope" || hasEnded(store, read.session)) return;
      watch = watchSessionEnd(read.session, () => setOffer(null));
      if (!watch.ended()) setOffer({ session: read.session, copies: readExitCopies(store, read.scope) });
    }).catch(() => {});
    return () => {
      live = false;
      watch?.close();
    };
  }, []);

  const shown = offer !== null && !hidden && offer.copies.length > 0;
  // NF2-P21: the status region exists before the offer does, so its text is announced when it comes.
  return (
    <>
      {offer !== null && <SessionObserver tag={offer.session.tag} at={offer.session.at} />}
      <div role="status" className={shown ? "editor-notice" : undefined} data-recovery-offer="">
        {shown && <>
          <p>{t.offer}</p>
          <ul>
            {offer.copies.map(({ key, copy: { assignmentId, at, text } }) => (
              <li key={key}>
                <time dateTime={new Date(at).toISOString()}>{new Date(at).toLocaleString("hr-HR")}</time>{" "}
                <a href={`${base}/rad/${encodeURIComponent(assignmentId)}`}>{t.resume}</a>
                {text !== null && <Button tone="quiet" onClick={() => {
                  if (!hasEnded(browserMarkStore(), offer.session)) exportText(text, "kopija-teksta.txt");
                }}>{t.download}</Button>}
              </li>
            ))}
          </ul>
          <Button tone="quiet" onClick={() => setHidden(true)}>{t.hide}</Button>
        </>}
      </div>
    </>
  );
}

