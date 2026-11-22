import type { Messages } from "../../../../../../locales/hr.ts";
import type { ShellRole } from "../../../../../../src/components/index.ts";

import { teacherShellHr as text } from "./messages.hr";

/**
 * The shell's catalogue for a role: the teacher sees "Zbirni" for the summary
 * and "Izbornik" for the drawer button (accessible name in both states, the
 * state is `aria-expanded`); every other role keeps the shared catalogue.
 */
export function shellMessagesFor(t: Messages, role: ShellRole | null): Messages {
  if (role !== "teacher") return t;
  return { ...t, shell: { ...t.shell, openNav: text.menu, closeNav: text.menu, nav: { ...t.shell.nav, summary: text.navSummary } } };
}
