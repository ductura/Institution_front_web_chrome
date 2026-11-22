import type { FormEvent, ReactNode } from "react";

import { stepLabels } from "../steps/messages.hr";
import styles from "./submission-step.module.css";
import { submissionStepText as text } from "./messages.hr";

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

export type StepFrameProps = {
  /** Where "Natrag na rad" leads. */
  backHref: string;
  onBack?: () => void;
  course: string;
  title: string;
  /** The step's name after the title ("Predaja", "Potvrda"), as the prototype's path shows it. */
  label?: string;
  /** Two columns from 1050 px (E-8: the checks and the process summary). */
  wide?: boolean;
  children: ReactNode;
};

/** The frame of steps 2 to 5: the sticky bar with the path, and the page (prototype `.sb-wrap`). */
export function StepFrame({ backHref, onBack, course, title, label, wide = false, children }: StepFrameProps) {
  return (
    <div className={styles.wrap}>
      <header className={styles.bar}>
        <a className="btn ghost" href={backHref}
          onClick={onBack ? (event) => { event.preventDefault(); onBack(); } : undefined}>{text.backToWork}</a>
        <p className={styles.crumb} aria-label={text.pathLabel}>
          {course !== "" && <><b>{course}</b>{text.separator}</>}{title}{label ? `${text.separator}${label}` : ""}
        </p>
      </header>
      <div className={cx(styles.page, wide && styles.two)} id="sadrzaj" tabIndex={-1}>{children}</div>
    </div>
  );
}

/** The five steps as a plain list; the current one is underlined (prototype `.sb-steps`). */
export function StepNav({ current }: { current: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <ol className={styles.steps} aria-label={text.stepsLabel}>
      {stepLabels.map((label, index) => (
        <li key={label} aria-current={index + 1 === current ? "step" : undefined}>{`${index + 1} ${label}`}</li>
      ))}
    </ol>
  );
}

export type StepPanelProps = {
  id?: string;
  title: ReactNode;
  /** The small tag beside the title (kind of work, "Bez veze", "nije započet"). */
  tag?: ReactNode;
  busy?: boolean;
  /** Sticks under the bar beside a long right column (E-8). */
  sticky?: boolean;
  /** The heading level; h1 for the step's own panel, h2 for the summary beside it. */
  level?: 1 | 2;
  children?: ReactNode;
};

/** A panel of a step: heading with a tag, then the body (prototype `panel()`). */
export function StepPanel({ id = "sb-h", title, tag, busy = false, sticky = false, level = 1, children }: StepPanelProps) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <section className={cx("panel", styles.panel, sticky && styles.stick)} aria-labelledby={id} aria-busy={busy || undefined}>
      <div className={styles.top}>
        <Heading id={id}>{title}</Heading>
        {tag ? <span className="tag">{tag}</span> : null}
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

/** The loading body: a message and three skeleton lines (prototype `loadingBody()`). */
export function StepLoading({ message }: { message: string }) {
  return (
    <>
      <p className="note" role="status">{message}</p>
      <div className="skel w80" /><div className="skel w60" /><div className="skel w40" />
    </>
  );
}

/** One line of the checks list: a bold label and what it says (prototype `.sb-state`). */
export function StepSection({ id, label, heading = false, tag, children }: { id?: string; label: ReactNode; heading?: boolean; tag?: ReactNode; children?: ReactNode }) {
  return (
    <section className={styles.state} id={id}>
      {tag ? <div className={styles.ev}>{heading ? <h3>{label}</h3> : <span className={styles.label}>{label}</span>}{tag}</div>
        : heading ? <h3>{label}</h3> : <span className={styles.label}>{label}</span>}
      {children}
    </section>
  );
}

/** A label and its value, side by side (below 640 px one under the other). */
export function StepKv({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className={styles.kv}><span>{label}</span><b>{children}</b></div>;
}

/** A block of the declaration: "Zabilježeno u Ducturi" (solid) or "Vaša izjava" (dashed, `own`). */
export function StepDecl({ title, tag, own = false, onSubmit, children }: {
  title?: ReactNode; tag?: ReactNode; own?: boolean; children?: ReactNode;
  /** Given, the block is a form (PD-4 "Napomena uz rad"). */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const heading = title ? <h3>{title}{tag}</h3> : null;
  return onSubmit
    ? <form className={cx(styles.decl, own && styles.own)} onSubmit={onSubmit} noValidate>{heading}{children}</form>
    : <div className={cx(styles.decl, own && styles.own)}>{heading}{children}</div>;
}

/** One recorded item with a quiet second line (who, where). */
export function StepEntry({ who, children }: { who: ReactNode; children?: ReactNode }) {
  return <div className={styles.entry}><span className={styles.who}>{who}</span>{children ? <span>{children}</span> : null}</div>;
}

/** A row of buttons. */
export function StepActions({ children }: { children: ReactNode }) {
  return <div className={styles.acts}>{children}</div>;
}

/** A sub-heading inside a panel (prototype `h3.sb-sub`). */
export function StepSub({ children }: { children: ReactNode }) {
  return <h3 className={styles.sub}>{children}</h3>;
}

/** A hexadecimal or ISO value in the monospace face. */
export function StepMono({ children }: { children: ReactNode }) {
  return <p className={styles.mono}>{children}</p>;
}

/** A list of places in the text, as links (prototype `ul.sb-places`). */
export function StepPlaces({ children }: { children: ReactNode }) {
  return <ul className={styles.places}>{children}</ul>;
}

/** A confirmation box with the label beside it (prototype `.sb-check`). */
export function StepCheck({ id, checked, onChange, children, describedBy }: {
  id: string; checked: boolean; onChange: (checked: boolean) => void; children: ReactNode; describedBy?: string;
}) {
  return (
    <label className={styles.check}>
      <input type="checkbox" id={id} checked={checked} aria-describedby={describedBy} onChange={(event) => onChange(event.currentTarget.checked)} /> {children}
    </label>
  );
}

/** A small spinner for "Predaja u tijeku…". */
export function StepSpinner() {
  return <span className={styles.spin} aria-hidden="true" />;
}

/** The sample QR pattern with its meta text; carries no content. */
export function StepQr({ children, label }: { children: ReactNode; label?: string }) {
  const cells = Array.from({ length: 21 * 21 }, (_, i) => i).filter((i) => {
    const x = i % 21, y = Math.floor(i / 21);
    if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) return false;
    return ((i * 7 + (i >> 3)) % 3 !== 0) !== ((x * y + x) % 3 === 0);
  });
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <path d={`M${x} ${y}h7v7h-7z M${x + 1} ${y + 1}v5h5v-5z`} fillRule="evenodd" />
      <rect x={x + 2} y={y + 2} width="3" height="3" />
    </g>
  );
  return (
    <div className={styles.qr}>
      <svg viewBox="0 0 21 21" aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}
        focusable="false" fill="currentColor" shapeRendering="crispEdges">
        {finder(0, 0)}{finder(14, 0)}{finder(0, 14)}
        <path d={cells.map((i) => `M${i % 21} ${Math.floor(i / 21)}h1v1h-1z`).join("")} />
      </svg>
      <p className="meta">{children}</p>
    </div>
  );
}

/** A line with a tag at its end ("opaženo", "izjavljeno"), wrapping on a narrow screen (prototype `.sb-ev`). */
export function StepLine({ children, tag }: { children: ReactNode; tag?: ReactNode }) {
  return <div className={styles.ev}><span>{children}</span>{tag}</div>;
}
