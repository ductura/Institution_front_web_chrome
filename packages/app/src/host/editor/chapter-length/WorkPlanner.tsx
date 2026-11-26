import { chapterLengthHr as t } from "./messages.hr";
import { planWork, type PlanChapter } from "./work-plan";
import styles from "./ChapterLength.module.css";

/** The planner card: words a day to the deadline, then what each chapter still lacks. */
export function WorkPlanner({ chapters, daysLeft }: { chapters: readonly PlanChapter[]; daysLeft: number | null }) {
  const plan = planWork(chapters, daysLeft);
  const summary = plan.state === "noGoals" ? t.planner.noGoals
    : plan.state === "done" ? t.planner.done
    : plan.state === "noDeadline" ? t.planner.noDeadline(plan.remaining)
    : plan.state === "late" ? t.planner.late(plan.remaining, plan.daysLate)
    : t.planner.plan(plan.remaining, plan.days, plan.perDay);
  return (
    <section aria-label={t.planner.title} data-work-planner={plan.state}>
      <h3>{t.planner.title}</h3>
      <p>{summary}</p>
      {plan.state !== "noGoals" && (
        <ul className={styles.length}>
          {plan.rows.map((r) => (
            <li key={r.id}>{r.over ? t.planner.chapterOver(r.label) : r.remaining > 0 ? t.planner.chapter(r.label, r.remaining) : t.planner.chapterMet(r.label)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
