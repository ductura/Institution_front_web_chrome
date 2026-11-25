"use client";

import { Button, Card, RouteLoading } from "@ductura/ui";

import { workTeamText as t } from "./messages.hr";
import { byName, categoriesInOrder, countOf, fullName, isReady } from "./model";
import type { ContributionRead } from "./read";

/**
 * WEB-V19-GRUPA: what the server recorded for the parts of a team, the same card for the student and the
 * teacher (the body is the same for both). Members are in alphabetical order, categories in the contract's
 * order, numbers are counts of characters; there is no share, no order by amount, no colour, no threshold and
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
      <table data-testid="contribution-table">
        <caption>{t.contribution.title}</caption>
        <thead>
          <tr>
            <th scope="col">{t.contribution.memberColumn}</th>
            {categoriesInOrder([]).map((c) => <th scope="col" key={c.category}>{t.contribution.categories[c.category]}</th>)}
            <th scope="col">{t.contribution.total}</th>
          </tr>
        </thead>
        <tbody>
          {byName(view.members).map((member, i) => (
            <tr key={`${fullName(member)}-${i}`} data-testid="contribution-member">
              <th scope="row">{fullName(member)}</th>
              {categoriesInOrder(member.categories).map((c) => <td key={c.category}>{countOf(c.codePoints)}</td>)}
              <td>{countOf(member.totalCodePoints)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
