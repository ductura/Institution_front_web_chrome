"use client";

// WEB-NF6-ETAPE (NF-6 MK-7, odluka 4: mentorstvo otvara nastavnik): the card "Novo mentorstvo" of N-16 with
// "Otvori mentorstvo" (prototype `om-h`). The server has no operation for a teacher to open a mentorship
// (SRV-MENTOR-7), so the button stays disabled and the card says why; nothing is sent.
import { Button, Card } from "@ductura/ui";

import { mentorPlanText as t } from "./messages.hr";

export function OpenMentorshipCard() {
  return (
    <Card level={2} title={t.open.title}>
      <p id="otvori-mentorstvo-nedostupno">{t.open.unavailable}</p>
      <p><Button tone="secondary" disabled aria-describedby="otvori-mentorstvo-nedostupno">{t.open.button}</Button></p>
    </Card>
  );
}
