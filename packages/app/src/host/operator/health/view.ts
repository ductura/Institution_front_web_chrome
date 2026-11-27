import { healthMessages as t } from "./messages.hr";
import type { SystemHealth } from "./read";

export type HealthRow = { readonly id: string; readonly label: string; readonly value: string };

/** One row per fact the server reports; a fact it does not report says so, it is never filled in. */
export function healthRows(data: SystemHealth): HealthRow[] {
  const { health, ready } = data;
  const rows: HealthRow[] = [
    { id: "alive", label: t.alive, value: t.states.ok },
    { id: "database", label: t.database, value: health.state === undefined ? t.notReported : t.states[health.state] },
    { id: "apiVersion", label: t.apiVersion, value: health.apiVersion ?? t.notReported },
    { id: "serverVersion", label: t.serverVersion, value: health.serverVersion ?? t.notReported },
    { id: "minClientVersion", label: t.minClientVersion, value: health.minClientVersion ?? t.notReported },
  ];
  for (const key of ["database", "storage", "signing", "queue"] as const) {
    const state = ready?.capabilities[key];
    rows.push({ id: `ready-${key}`, label: t.capabilities[key], value: state === undefined ? t.notReported : t.states[state] });
  }
  return rows;
}

/** True when any reported part is not "ok", so the page can lead with the problem. */
export function isDegraded(data: SystemHealth): boolean {
  if (data.notReady !== null || data.health.state === "degraded") return true;
  return Object.values(data.ready?.capabilities ?? {}).some((state) => state !== "ok");
}
