"use client";

import { Button, Card, RouteLoading } from "@ductura/ui";

import { workTeamText as t } from "./messages.hr";
import { byName, categoriesInOrder, countOf, fullName, isReady } from "./model";
import type { ContributionRead } from "./read";

/**
 * WEB-V19-GRUPA: what the server recorded for the parts of a team, the same card for the student and the
 * teacher (the body is the same for both). Members are in alphabetical order, categories in the contract's
 * order (a list per member, so it reflows on a phone), numbers are counts of characters; there is no share, no order by amount, no colour, no threshold and
 * no "high" or "low". "Nije dokaz autorstva" is always on the card. Loading, error, "not ready" and "failed"
 * are different things, and none of them is an empty table. `read` is null while it loads.
 */
export function ContributionCard({ read, retry }: { read: ContributionRead | null; retry: () => void }) {
  if (read === null || read.kind === "signedOut") {
    return <Card level={2} title={t.contribution.title}><RouteLoading label={t.contribution.loading} /></Card>;
  }
  if (read.kind === "unavailable" || read.kind === "notFound") {
    return (
      <Card level={2} title={t.contribution.title}>
        <p role="alert">{read.kind === "notFound" ? t.gone : t.contribution.unavailable}</p>
        {read.kind === "unavailable" && <p><Button tone="quiet" onClick={retry}>{t.retry}</Button></p>}
      </Card>
    );
  }
  const view = read.view;
  if (!isReady(view)) {
    return (
      <Card level={2} title={t.contribution.title}>
        <p role={view.state === "failed" ? "alert" : "status"} data-testid="contribution-state">{t.contribution[view.state]}</p>
        {view.state === "failed" && <p><Button tone="quiet" onClick={retry}>{t.retry}</Button></p>}
      </Card>
    );
  }
  return (
    <Card level={2} title={t.contribution.title}>
      <p>{t.contribution.lead}</p>
      <p role="note" data-testid="contribution-notice">{t.contribution.notice}</p>
      <ul data-testid="contribution-table">
        {byName(view.members).map((member, i) => (
          <li key={`${fullName(member)}-${i}`} data-testid="contribution-member">
            <strong>{fullName(member)}</strong>
            <dl>
              {categoriesInOrder(member.categories).map((c) => (
                <div key={c.category}><dt>{t.contribution.categories[c.category]}</dt><dd>{countOf(c.codePoints)}</dd></div>
              ))}
              <div><dt>{t.contribution.total}</dt><dd>{countOf(member.totalCodePoints)}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </Card>
  );
}
