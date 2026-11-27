// DIZ S-02/S-04/S-05 (Z7, R8, KU4): 403 on a student read is not a read error. The heading and the way back
// to the student's own space, nothing else; the texts are the shell's (shell.deniedTitle, shell.backToOwn).
import { createElement as h } from "react";

import { appHref } from "../../../../../../src/components/index.ts";
import { messagesHr } from "../../../../../../locales/hr.ts";
import { DeniedState } from "../../states/States";

export function StudentDenied({ base }: { base: string }) {
  return h(DeniedState, { title: messagesHr.access.deniedTitle, backLabel: messagesHr.access.backToOwn, backHref: appHref(base, "/zadaci") });
}
