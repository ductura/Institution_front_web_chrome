"use client";

import { formatDate } from "@ductura/ui";

import { appHref } from "../../../../../src/components/index.ts";

import { useLocale } from "../../../src/i18n";
import { useHost } from "../../../src/host/context";
import { COMPLIANCE, ENFORCEMENT_BODY, STATEMENT_PREPARED, statementEn, statementHr } from "./statement";
import styles from "./statement.module.css";

/**
 * "Izjava o pristupačnosti" (WEB-1805, M11.6, F-03): public, outside the
 * shell, in the interface language. Every heading is a real heading, so a
 * screen reader can move by sections; the contact of the enforcement body is
 * a description list.
 */
export default function AccessibilityStatement() {
  const { base } = useHost();
  const { locale } = useLocale();
  const t = locale === "en" ? statementEn : statementHr;
  const body = ENFORCEMENT_BODY;
  const [before = "", after = ""] = t.preparation.prepared.split("{date}");
  return (
    <main id="sadrzaj" tabIndex={-1} className={`page ${styles.statement}`}>
      <header className={styles.header}>
        <a href={appHref(base, "/")}>{t.home}</a>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
        <p>{t.scope}</p>
      </header>

      <section aria-labelledby="izjava-status">
        <h2 id="izjava-status">{t.status.heading}</h2>
        <p>{t.status[COMPLIANCE]}</p>
      </section>

      <section aria-labelledby="izjava-provjereno">
        <h2 id="izjava-provjereno">{t.checked.heading}</h2>
        <ul>{t.checked.items.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <section aria-labelledby="izjava-nepristupacno">
        <h2 id="izjava-nepristupacno">{t.inaccessible.heading}</h2>
        <p>{t.inaccessible.lead}</p>
        <h3>{t.inaccessible.nonCompliance.heading}</h3>
        <ul>{t.inaccessible.nonCompliance.items.map((item) => <li key={item}>{item}</li>)}</ul>
        <h3>{t.inaccessible.burden.heading}</h3>
        <p>{t.inaccessible.burden.text}</p>
        <h3>{t.inaccessible.outOfScope.heading}</h3>
        <p>{t.inaccessible.outOfScope.text}</p>
      </section>

      <section aria-labelledby="izjava-priprema">
        <h2 id="izjava-priprema">{t.preparation.heading}</h2>
        <p>
          {before}
          <time dateTime={STATEMENT_PREPARED.slice(0, 10)}>{formatDate(STATEMENT_PREPARED, locale)}</time>
          {after}
        </p>
        <p>{t.preparation.method}</p>
      </section>

      <section aria-labelledby="izjava-kontakt">
        <h2 id="izjava-kontakt">{t.feedback.heading}</h2>
        <p>{t.feedback.text}</p>
      </section>

      <section aria-labelledby="izjava-nadzor">
        <h2 id="izjava-nadzor">{t.enforcement.heading}</h2>
        <p>{t.enforcement.text}</p>
        <p className={styles.body}>{body.name}</p>
        <dl className={styles.contact}>
          <dt>{t.enforcement.address}</dt>
          <dd>{body.address}</dd>
          <dt>{t.enforcement.phone}</dt>
          <dd><a href={`tel:${body.phone.replace(/\s/g, "")}`}>{body.phone}</a></dd>
          <dt>{t.enforcement.email}</dt>
          <dd><a href={`mailto:${body.email}`}>{body.email}</a></dd>
          <dt>{t.enforcement.web}</dt>
          <dd><a href={body.web}>{body.web.replace(/^https:\/\//, "")}</a></dd>
        </dl>
      </section>
    </main>
  );
}
