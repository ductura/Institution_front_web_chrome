"use client";

import { Card, Notice } from "@ductura/ui";

import { myRightsMessages as t } from "./messages.hr";

/** NF-7 OA-5: "Moja prava", static help for any signed-in account; no read, no write. */
export default function MyRightsPage() {
  return (
    <section className="page">
      <h1>{t.title}</h1>
      <p>{t.lead}</p>
      <Notice tone="info">{t.pendingReview}</Notice>
      {t.sections.map((section) => (
        <Card key={section.id} level={2} title={section.heading}>
          <p>{section.text}</p>
        </Card>
      ))}
      <p>{t.contact}</p>
    </section>
  );
}
