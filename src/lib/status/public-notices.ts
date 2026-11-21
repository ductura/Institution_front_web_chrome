// WEB-1905 (P-D5): planned maintenance and past outages on the public status
// page. A closed shape with no person, work, host or address: only an instant,
// a part of the service and a short fixed word for the kind of event.

import { COMPONENTS, type ComponentName } from "./public-status";

export const OUTAGE_KINDS = ["prekid", "djelomicno"] as const;
export type OutageKind = (typeof OUTAGE_KINDS)[number];

export type PlannedMaintenance = { id: string; startsAt: string; endsAt: string; parts: readonly ComponentName[] };
export type PastOutage = { id: string; startedAt: string; endedAt: string; parts: readonly ComponentName[]; kind: OutageKind };
export type StatusNotices = { maintenance: readonly PlannedMaintenance[]; outages: readonly PastOutage[] };

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const isInstant = (v: unknown): v is string => typeof v === "string" && INSTANT.test(v) && Number.isFinite(Date.parse(v));
const isParts = (v: unknown): v is ComponentName[] =>
  Array.isArray(v) && v.length > 0 && v.every((p) => (COMPONENTS as readonly string[]).includes(p));

/** The checked list, or null for any shape that is not exactly this one (an event that ends before it starts is rejected too). */
export function parseStatusNotices(input: unknown): StatusNotices | null {
  if (typeof input !== "object" || input === null) return null;
  const { maintenance, outages } = input as Record<string, unknown>;
  if (!Array.isArray(maintenance) || !Array.isArray(outages)) return null;
  const m: PlannedMaintenance[] = [];
  for (const e of maintenance) {
    if (typeof e !== "object" || e === null) return null;
    const { id, startsAt, endsAt, parts } = e as Record<string, unknown>;
    if (typeof id !== "string" || !isInstant(startsAt) || !isInstant(endsAt) || !isParts(parts)) return null;
    if (Date.parse(endsAt) < Date.parse(startsAt)) return null;
    m.push({ id, startsAt, endsAt, parts });
  }
  const o: PastOutage[] = [];
  for (const e of outages) {
    if (typeof e !== "object" || e === null) return null;
    const { id, startedAt, endedAt, parts, kind } = e as Record<string, unknown>;
    if (typeof id !== "string" || !isInstant(startedAt) || !isInstant(endedAt) || !isParts(parts)) return null;
    if (!(OUTAGE_KINDS as readonly string[]).includes(kind as string) || Date.parse(endedAt) < Date.parse(startedAt)) return null;
    o.push({ id, startedAt, endedAt, parts, kind: kind as OutageKind });
  }
  return { maintenance: m, outages: o };
}

/** Maintenance still to come or running at `now`, soonest first; outages newest first. */
export function arrangeNotices(n: StatusNotices, now: number): StatusNotices {
  return {
    maintenance: n.maintenance.filter((e) => Date.parse(e.endsAt) >= now).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
    outages: [...n.outages].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)),
  };
}

/** Verified events only; empty until the first real one (a demo list lives in the tests). */
export const STATUS_NOTICES: StatusNotices = { maintenance: [], outages: [] };
