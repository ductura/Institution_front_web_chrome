// WEB-2125: the target list of Umetni > Unakrsna referenca (INVENTAR §3.3
// insXref): Poglavlja and Prikazi, with the empty state. Pure: the targets
// come from crossReferenceTargets and the choice goes back to the caller.
import type { XrefTarget, XrefTargets } from "./academic-atoms";
import { academicAtomsHr as t } from "./messages.hr";

function Group({ name, targets, onPick }: { name: string; targets: readonly XrefTarget[]; onPick(id: string): void }) {
  if (targets.length === 0) return null;
  return (
    <section aria-label={name}>
      <h3>{name}</h3>
      <ul>
        {targets.map((x) => (
          <li key={x.id}>
            <button type="button" onClick={() => onPick(x.id)}>
              {x.title ? `${x.label} ${x.title}` : x.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CrossReferencePicker({ targets, onPick }: { targets: XrefTargets; onPick(id: string): void }) {
  const empty = targets.chapters.length === 0 && targets.exhibits.length === 0;
  return (
    <div role="group" aria-label={t.crossReference}>
      <p>{t.moves}</p>
      {empty ? (
        <p role="status">{t.noTargets}</p>
      ) : (
        <>
          <Group name={t.chapters} targets={targets.chapters} onPick={onPick} />
          <Group name={t.exhibits} targets={targets.exhibits} onPick={onPick} />
        </>
      )}
    </div>
  );
}
