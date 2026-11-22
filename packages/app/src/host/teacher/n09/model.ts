import type { EvidenceSourceV2 } from "@/domain/forensics/evidence-segment-v2";
import { sourceLabel } from "@/components/replay/replay-view";
import { n09Messages as m } from "./messages.hr";

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

/** Milliseconds between two changes while playing (prototype: 900 / speed). */
export const stepDelay = (speed: Speed): number => 900 / speed;

export const parseSpeed = (value: string): Speed => SPEEDS.find((s) => String(s) === value) ?? 1;

/** The source as the prototype names it; sources it has no word for keep the app's own wording. */
export function sourceTag(source: EvidenceSourceV2): { text: string; typed: boolean } {
  if (source === "editor") return { text: m.sourceTyped, typed: true };
  if (source === "paste") return { text: m.sourcePasted, typed: false };
  return { text: sourceLabel(source), typed: false };
}

/** Steps a reader moves through: change numbers from 1 (the prototype has no empty start). */
export const playable = (steps: readonly number[]): number[] => steps.filter((s) => s >= 1);

/** The change after `at` among `steps`, or null at the end. */
export const followingStep = (steps: readonly number[], at: number): number | null => steps.find((s) => s > at) ?? null;

/** The change before `at`, or null at the start. */
export const precedingStep = (steps: readonly number[], at: number): number | null => [...steps].reverse().find((s) => s < at) ?? null;
