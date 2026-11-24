"use client";

import type { ReactNode } from "react";

import styles from "./MobileReview.module.css";
import { mobileReviewMessages as text } from "./messages.hr";

/**
 * The teacher's view of one work on a phone (WEB-1705; plan M6.8, DAN-422; NF-5 PG-12). It changes no data
 * and no behaviour: it only holds the text of the work and the comments, or the review of the work, in one
 * region whose rules (see the stylesheet) keep a 360 px screen free of sideways scrolling and every touch
 * target at least 24 by 24 px. With `touch="large"` (the review, PG-12) the controls are 44 px below 760 px,
 * and there a dialog (a request for revision, a comment) takes the whole screen.
 */
export default function MobileReview({ children, label = text.region, touch }: {
  children: ReactNode; label?: string; touch?: "large";
}) {
  return <section className={styles.review} aria-label={label} data-touch={touch}>{children}</section>;
}
