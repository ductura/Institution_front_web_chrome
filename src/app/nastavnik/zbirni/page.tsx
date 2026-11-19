import { messagesHr } from "../../../lib/i18n/messages.hr";

const t = messagesHr.teacherSummary;

export const metadata = { title: `${t.title} · ${messagesHr.app.name}` };

// WEB-17 (A-9, N-17): "Zbirni pregled" in the teacher's side bar. The summary
// read comes later; until then the page shows only its empty state, with no
// call and no number (D-242: at least five students, no names, no ranking).
export default function TeacherSummaryPage() {
  return (
    <div className="page">
      <h1>{t.title}</h1>
      <p>{t.lead}</p>
      <section aria-labelledby="zbirni-prazno">
        <h2 id="zbirni-prazno">{t.emptyTitle}</h2>
        <p role="status">{t.emptyBody}</p>
      </section>
    </div>
  );
}
