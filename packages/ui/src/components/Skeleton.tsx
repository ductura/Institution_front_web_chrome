import styles from "./Forms.module.css";

export type SkeletonProps = {
  /** Read out instead of the grey bars, e.g. "Učitavanje…". */
  label: string;
  lines?: number;
};

/** Grey bars where content is loading (WEB-05): one status for assistive technology, the bars hidden from it. */
export function Skeleton({ label, lines = 3 }: SkeletonProps) {
  return (
    <div role="status" aria-busy="true" className={styles.skeleton}>
      <span className={styles.hidden}>{label}</span>
      {Array.from({ length: Math.max(1, lines) }, (_, i) => <span key={i} aria-hidden="true" className={styles.bar} />)}
    </div>
  );
}
