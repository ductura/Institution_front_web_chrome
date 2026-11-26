/**
 * DEMO-1: the address of the demo, set at build time (NEXT_PUBLIC_DEMO_URL).
 * Only an absolute http(s) address counts; anything else, or nothing, hides
 * the button, so a build without a demo never shows a dead link.
 */
export function demoHref(value: string | undefined): string | null {
  const raw = value?.trim() ?? "";
  if (raw === "") return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** The screenshots of the page, served from public/web/o-aplikaciji (invented data only). */
export const SHOTS = ["studentTasks", "studentWriting", "teacherCourses", "teacherWork"] as const;
export type Shot = (typeof SHOTS)[number];

export const shotSrc = (shot: Shot) => `/app/web/o-aplikaciji/${shot}.png`;
