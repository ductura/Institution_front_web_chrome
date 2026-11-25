"use client";

// WEB-V16-KOSTUR: the shared "Završni rad" panel of a work in a mentorship, for the student (Mentor card) and
// the mentor (mentorships page). Each registered section reads for itself and shows loading, error and empty
// as three separate states. Data only through the section's own read; the frame touches no API.
import { useCallback, useEffect, useState } from "react";

import { Button, Card } from "@ductura/ui";

import { thesisHr } from "./messages.hr";
import { orderSections, panelVisible, readSafely, type SectionState, type ThesisRole, type ThesisSectionDef } from "./model";
import { registeredSections } from "./sections";

function Section({ section, documentId, role, onState }: {
  section: ThesisSectionDef<never>; documentId: string; role: ThesisRole; onState: (id: string, s: SectionState) => void;
}) {
  const [state, setState] = useState<SectionState<never>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    setState({ kind: "loading" });
    onState(section.id, { kind: "loading" });
    void readSafely(() => section.read(documentId, role)).then((next) => {
      if (!live) return;
      setState(next);
      onState(section.id, next);
    });
    return () => { live = false; };
  }, [section, documentId, role, attempt, onState]);

  if (state.kind === "notFound") return null;
  if (state.kind === "loading") return <Card title={section.title} busy />;
  if (state.kind === "unavailable") {
    // Card's `error` replaces its children, so the message and the retry are children together.
    return (
      <Card title={section.title}>
        <p role="alert">{thesisHr.unavailable}</p>
        <Button tone="secondary" onClick={reload}>{thesisHr.retry}</Button>
      </Card>
    );
  }
  if (state.kind === "empty") return <Card title={section.title} empty={thesisHr.empty} />;
  const View = section.View;
  return <Card title={section.title}><View documentId={documentId} role={role} value={state.value} reload={reload} /></Card>;
}

export function ThesisPanel({ documentId, role, inMentorship = true, sections = registeredSections }: {
  documentId: string;
  role: ThesisRole;
  /** False hides the panel; the student's mount cannot tell, so there the server's 404 on every section hides it. */
  inMentorship?: boolean;
  /** The sections to show; the registry by default. */
  sections?: readonly ThesisSectionDef<never>[];
}) {
  const [states, setStates] = useState<Readonly<Record<string, SectionState>>>({});
  const onState = useCallback((id: string, s: SectionState) => setStates((all) => ({ ...all, [id]: s })), []);
  // A section that has not reported yet counts as loading, so the panel is shown while reads are pending.
  const ordered = orderSections(sections);
  const all = ordered.map((s) => states[s.id] ?? ({ kind: "loading" } as const));
  if (!panelVisible(inMentorship, all)) return null;
  return (
    <section aria-label={thesisHr.title} data-testid="thesis-panel">
      {ordered.map((s) => <Section key={s.id} section={s} documentId={documentId} role={role} onState={onState} />)}
    </section>
  );
}
