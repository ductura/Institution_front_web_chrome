"use client";

import type { ReactNode } from "react";

import styles from "./MobileReview.module.css";
import { mobileReviewMessages as text } from "./messages.hr";

/**
 * The teacher's live view of one work on a phone (WEB-1705; plan M6.8, DAN-422). It changes no
 * data and no behaviour: it only holds the text of the work and the comments in one region whose
 * rules (see the stylesheet) keep a 360 px screen free of sideways scrolling and every touch
 * target at least 24 by 24 px. The text stays read-only; comments are the only thing typed.
 */
export default function MobileReview({ children }: { children: ReactNode }) {
  return <section className={styles.review} aria-label={text.region}>{children}</section>;
}
