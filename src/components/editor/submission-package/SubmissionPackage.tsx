/**
 * Predajni paket (E§3.3 `paket`): ✓/! rows, the confirmation code and the way
 * on to submission. Pure: the rows come in. A yellow row never blocks; the
 * code text never claims where the work came from.
 */

import { confirmationCode, packageBlocked, type PackageRow } from "./package-rows";
import { submissionPackageMessages as t } from "./messages.hr";

export type SubmissionPackageProps = {
  readonly rows: readonly PackageRow[];
  /** The digest of the signed receipt, or null before submission. */
  readonly artifactSha256: string | null;
  readonly submitHref: string;
};

export function SubmissionPackage({ rows, artifactSha256, submitHref }: SubmissionPackageProps) {
  const code = confirmationCode(artifactSha256);
  const blocked = packageBlocked(rows);
  return (
    <section aria-labelledby="submission-package-title">
      <h2 id="submission-package-title">{t.title}</h2>
      <p>{t.lead}</p>
      <ul>
        {rows.map((row) => (
          <li key={row.id} data-status={row.status}>
            <span aria-label={row.status === "ok" ? t.ok : t.warn}>{row.status === "ok" ? "✓" : "!"}</span>
            {" "}<strong>{t.rows[row.id]}</strong>{row.detail !== "" && <>{" · "}{row.detail}</>}
          </li>
        ))}
      </ul>
      <h3>{t.code}</h3>
      {code !== null ? <p><code>{code}</code></p> : null}
      <p>{code !== null ? t.codeNote : t.codeNever}</p>
      <p>{t.yellowNote}</p>
      {blocked
        ? <p><span aria-disabled="true">{t.next}</span></p>
        : <p><a href={submitHref}>{t.next}</a></p>}
    </section>
  );
}
