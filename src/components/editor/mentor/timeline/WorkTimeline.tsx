"use client";

import { Button, Dialog } from "@ductura/ui";
import { useEffect, useState } from "react";
import { readConsultationVersions, type VersionsPage } from "../../../../client/consultation-records";
import { mentorWorkHr as t } from "../work-state/messages.hr";
import { readMilestones, readSlots, timelineEvents, type Milestone, type Slot, type TimelineEvent } from "./work-timeline";

const date = new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zagreb" });

export function MentorTime({ at }: { at: string }) {
  return <time dateTime={at}>{date.format(new Date(at))}</time>;
}

function eventLabel(event: TimelineEvent) {
  if ("title" in event) return `${t.event[event.kind]} · ${event.title}`;
  if ("revision" in event) return `${t.event[event.kind]} · ${event.revision}`;
  return t.event[event.kind];
}

export function WorkTimeline({ documentId, milestones, firstPage, onClose }: {
  documentId: string;
  milestones: Milestone[] | null | undefined;
  firstPage: VersionsPage | null | undefined;
  onClose: () => void;
}) {
  const [slots, setSlots] = useState<Slot[] | null>();
  const [pages, setPages] = useState<VersionsPage[]>([]);
  const [pageRead, setPageRead] = useState<"idle" | "loading" | "error">("idle");
  const [cursorToLoad, setCursorToLoad] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    void readSlots(documentId).then((result) => { if (live) setSlots(result); });
    return () => { live = false; };
  }, [documentId]);

  useEffect(() => {
    if (cursorToLoad === null) return;
    let live = true;
    void readConsultationVersions(documentId, cursorToLoad).then((page) => {
      if (!live) return;
      if (page) setPages((previous) => [...previous, page]);
      setPageRead(page ? "idle" : "error");
      setCursorToLoad(null);
    });
    return () => { live = false; };
  }, [documentId, cursorToLoad]);

  const cursor = (pages.at(-1) ?? firstPage)?.nextBeforeRevision;
  const versions = [ ...(firstPage?.versions ?? []), ...pages.flatMap((page) => page.versions) ];
  const events = timelineEvents(milestones ?? [], slots ?? [], versions);
  const loading = milestones === undefined || slots === undefined || firstPage === undefined;
  const unavailable = [milestones, slots, firstPage].includes(null) || pageRead === "error";
  return (
    <Dialog open title={t.timelineTitle} onClose={onClose} actions={<Button tone="quiet" onClick={onClose}>{t.close}</Button>}>
      {(loading || pageRead === "loading") && <p role="status">{t.timelineLoading}</p>}
      {unavailable && <p role="alert">{t.timelineUnavailable}</p>}
      {!loading && !unavailable && events.length === 0 && <p role="status">{t.timelineEmpty}</p>}
      {events.length > 0 && <ol>
        {events.map((event) => <li key={event.key}><MentorTime at={event.at} /> · {eventLabel(event)}</li>)}
      </ol>}
      {cursor != null && <Button tone="quiet" disabled={pageRead === "loading"} onClick={() => {
        setPageRead("loading");
        setCursorToLoad(cursor);
      }}>{t.older}</Button>}
    </Dialog>
  );
}
