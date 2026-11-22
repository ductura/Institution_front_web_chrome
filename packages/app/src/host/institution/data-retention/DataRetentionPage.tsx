"use client";

import { LegalHolds, PanelTabs, RetentionClasses, formatDateTime, type LegalHoldSubjectType, type LegalHoldsState, type RetentionClassesState } from "@ductura/ui";
import { useCallback, useEffect, useState } from "react";

import { fetchLegalHolds, placeLegalHold, releaseLegalHold, type FailedKind, type LegalHoldActionOutcome } from "@/client/legal-holds";
import { fetchRetention, type RetentionClassRow } from "@/client/retention";

import { useHost } from "../../context";
import { retentionMessages as t } from "./messages.hr";

/** The catalogue text for an answer: the page never shows a raw server code. */
const say = (kind: FailedKind | "invalid" | "stale" | "missingSubject"): string =>
  ({
    signedOut: t.errors.unauthorized, denied: t.errors.forbidden, unavailable: t.errors.unavailable,
    invalid: t.errors.invalid, stale: t.errors.stale, missingSubject: t.errors.missingSubject,
  })[kind];

const classLabels = t.classes;
const holdLabels = t.holds;

/** A class as the table shows it: named from the catalogue by its key, never by the server's message key. */
const shown = (c: RetentionClassRow) => ({ classId: c.key, name: t.classNames[c.key], retentionDays: c.retentionDays, mode: c.mode });

function useClasses() {
  const [state, setState] = useState<RetentionClassesState>({ kind: "loading" });
  const load = useCallback(() => {
    setState({ kind: "loading" });
    void fetchRetention().then((out) => setState(out.kind === "ok" ? { kind: "ready", classes: out.classes.map(shown) } : { kind: "error", message: say(out.kind) }));
  }, []);
  useEffect(load, [load]);
  return [state, load] as const;
}

function useHolds() {
  const [state, setState] = useState<LegalHoldsState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const [note, setNote] = useState("");

  const read = useCallback(async () => {
    const out = await fetchLegalHolds();
    setState(out.kind === "ok"
      ? {
          kind: "ready",
          // The read names neither the placer nor whether the hold is the reader's own (LOK-SRV-1):
          // the row shows only the time, and a refused release of an own hold answers 403.
          holds: out.holds.map((h) => ({
            id: h.id, subject: `${holdLabels.subjectTypes[h.subjectType]}: ${h.subjectId}`,
            caseReference: h.caseReference, placedAt: formatDateTime(h.placedAt, "hr"), own: false,
          })),
        }
      : { kind: "error", message: say(out.kind) });
  }, []);
  const load = useCallback(() => {
    setState({ kind: "loading" });
    void read();
  }, [read]);
  useEffect(load, [load]);

  const act = async (call: () => Promise<LegalHoldActionOutcome>, done: string, denied: string = t.errors.forbidden) => {
    setBusy(true);
    setActionError(undefined);
    setNote("");
    const out = await call();
    if (out.kind === "ok") setNote(done);
    else setActionError(out.kind === "denied" ? denied : say(out.kind));
    // A stale answer means the list is out of date; an ok answer changed it. Read it again either way.
    if (out.kind === "ok" || out.kind === "stale") await read();
    setBusy(false);
  };
  return {
    state, busy, actionError, note, load,
    place: (input: { subjectType: LegalHoldSubjectType; subjectId: string; caseReference: string }) => void act(() => placeLegalHold(input), holdLabels.placed),
    release: (id: string, reason: string) => void act(() => releaseLegalHold(id, reason), holdLabels.released, t.errors.releaseForbidden),
  };
}

/**
 * A-05 /ustanova/cuvanje (M10.7): two cards for the institution administrator, the data classes
 * with their period and mode (read only) and the legal holds (place, release with a reason).
 * Reads and writes go only through src/client; the server decides who may do what (403 is shown
 * as the catalogue text).
 */
export default function DataRetentionPage() {
  const { page, role } = useHost();
  const [classes, reloadClasses] = useClasses();
  const holds = useHolds();
  return (
    <section className="page" data-role={role ?? undefined}>
      <h1>{page.label}</h1>
      <PanelTabs
        label={t.tabsLabel}
        tabs={[
          { id: "classes", label: t.tabClasses, content: <RetentionClasses labels={classLabels} state={classes} onRetry={reloadClasses} /> },
          {
            id: "holds",
            label: t.tabHolds,
            content: (
              <>
                <p role="status">{holds.note}</p>
                <LegalHolds labels={holdLabels} state={holds.state} busy={holds.busy} actionError={holds.actionError}
                  onPlace={holds.place} onRelease={holds.release} onRetry={holds.load} />
              </>
            ),
          },
        ]}
      />
    </section>
  );
}
