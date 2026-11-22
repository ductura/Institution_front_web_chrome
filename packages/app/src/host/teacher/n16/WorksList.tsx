"use client";

// N-16 (VIZ-N3): the list of mentored works as `.list` of `.item` rows in docs/prototip/Ductura_nastavnik.html:
// student, then the title and type of the work and its state in words, then "Otvori rad" for a started work.
import { messagesHr } from "../../../../../../locales/hr";
import type { MentoredWork } from "../../../../../../src/components/teacher/mentored-works-read";
import { byFamilyName, liveHref, stateText, studentName, workTypeText } from "../../../../../../src/components/teacher/mentored-works-view";
import { appHref } from "../../../../../../src/components/shell/nav";

const mw = messagesHr.mentoredWorks;

/** The state sentence of the prototype: "Seminarski rad „Naslov”. U pisanju." */
export function workLine(work: MentoredWork): string {
  const type = workTypeText(work);
  const state = stateText(work);
  return `${type === "" ? "" : `${type} `}„${work.title}”. ${state.endsWith(".") ? state : `${state}.`}`;
}

export function WorksList({ works, base }: { works: readonly MentoredWork[]; base: string }) {
  if (works.length === 0) {
    return (
      <section className="card center" aria-labelledby="bez-mentorstava">
        <h2 id="bez-mentorstava">{mw.empty}</h2>
        <p className="note">{mw.emptyHint}</p>
      </section>
    );
  }
  return (
    <ul className="list" aria-label={mw.listTitle}>
      {byFamilyName(works).map((work) => {
        const href = liveHref(work);
        return (
          <li key={work.mentorshipId} className="item" data-testid="mentored-work">
            <span className="title">{studentName(work)}</span>
            <span className="note">{workLine(work)}</span>
            {href === null ? null : <a className="rowlink" href={appHref(base, href)}>{mw.open}</a>}
          </li>
        );
      })}
    </ul>
  );
}
