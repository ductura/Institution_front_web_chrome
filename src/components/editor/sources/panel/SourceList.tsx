"use client";

/**
 * The list under the form of the "Literatura" tab (WEB-7C): search, "Citirano"
 * and "Nije citirano" groups, a tag for mandatory and recommended sources and
 * the "Pregled literature" summary. It writes nothing itself; `onCite` does.
 */

import { useId, useState, type ReactNode } from "react";

import { messagesHr } from "@/lib/i18n/messages.hr";

import styles from "./SourceList.module.css";
import { filterSources, splitByCitation, summarize, type ListedSource } from "./source-list";

const t = messagesHr.workspace.sources.list;

type Props<T extends ListedSource> = {
  items: readonly T[];
  editable: boolean;
  onCite: (item: T) => void;
  /** The host's own actions after "Citiraj" in a row (WEB-2123: "Uredi", "Ukloni"); none by default. */
  rowActions?: (item: T) => ReactNode;
};

export default function SourceList<T extends ListedSource>({ items, editable, onCite, rowActions }: Props<T>) {
  const id = useId();
  const [query, setQuery] = useState("");
  const shown = filterSources(items, query);
  const { cited, uncited } = splitByCitation(shown);
  const total = summarize(items);

  const group = (key: string, title: string, rows: readonly T[]) => (
    <section aria-labelledby={`${id}-${key}`}>
      <h3 id={`${id}-${key}`} className={styles.group}>{title.replace("{n}", String(rows.length))}</h3>
      <ul className={styles.list}>
        {rows.map((item) => (
          <li key={item.entry}>
            <p>{item.entry}</p>
            {item.tag ? <span className={styles.tag}>{t.tags[item.tag]}</span> : null}
            <button
              type="button"
              className={styles.cite}
              aria-label={`${messagesHr.workspace.sources.cite}: ${item.entry}`}
              aria-disabled={editable ? undefined : "true"}
              // A script's click writes nothing (contract on #866).
              onClick={(event) => { if (event.isTrusted) onCite(item); }}
            >
              {messagesHr.workspace.sources.cite}
            </button>
            {rowActions?.(item)}
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className={styles.root}>
      <label className={styles.search}>
        <span>{t.search.replace("{n}", String(items.length))}</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {shown.length === 0 ? <p className="rail-empty">{t.noMatch}</p> : (
        <>
          {cited.length > 0 ? group("cited", t.cited, cited) : null}
          {uncited.length > 0 ? group("uncited", t.uncited, uncited) : null}
        </>
      )}
      <details className={styles.review}>
        <summary>{t.review}</summary>
        <p>{t.summary.replace("{total}", String(total.total)).replace("{cited}", String(total.cited)).replace("{uncited}", String(total.uncited))}</p>
        {total.mandatory + total.recommended > 0 ? (
          <p>{t.origin.replace("{mandatory}", String(total.mandatory)).replace("{recommended}", String(total.recommended))}</p>
        ) : null}
      </details>
    </div>
  );
}
