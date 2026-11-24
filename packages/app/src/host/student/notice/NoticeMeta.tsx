// WEB-2113: the student host's own copy of NoticeMeta from
// src/components/student/AssignmentNotice.tsx, on the host's copy of its styles.
import styles from "./Notice.module.css";

// The decorative line icons of S03_upute.png, in the text colour.
const ICON = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6,
  strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: false } as const;

/** S03-a: "{work type} · {range}" | "Rok: {date} u {time}" under the title. */
export function NoticeMeta({ kind, due }: { kind: string; due: string }) {
  return (
    <p className={styles.meta}>
      {kind ? (
        <span className={styles.metaItem}>
          <svg {...ICON}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>
          {kind}
        </span>
      ) : null}
      <span className={styles.metaItem}>
        <svg {...ICON}><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M16 3v4M8 3v4M4 11h16" /></svg>
        {due}
      </span>
    </p>
  );
}
