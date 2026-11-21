import { messagesHr as t } from "@/lib/i18n/messages.hr";

/** WEB-08 (A-5): signed in through AAI@EduHr without a role; the way on is the faculty's administrator. */
export default function NoRoleCard() {
  return (
    <section className="page" aria-labelledby="bez-uloge-naslov">
      <h1 id="bez-uloge-naslov">{t.signInState.noRoleTitle}</h1>
      <p>{t.signInState.noRoleBody}</p>
      <p>{t.signInState.noRoleNext}</p>
    </section>
  );
}
