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

export type KeyAction = "toggle" | "previous" | "next" | "first" | "last";

/**
 * The reader's shortcuts inside the player: Space starts and stops, the arrows move one change, Home and End the first and the last.
 * A field that uses the key itself (the slider, the selects) and a button (Space clicks it) keep it; a key with a modifier is never taken.
 */
export function keyAction(key: string, target: { tagName: string }, mods: { ctrl?: boolean; alt?: boolean; meta?: boolean; shift?: boolean } = {}): KeyAction | null {
  if (mods.ctrl === true || mods.alt === true || mods.meta === true || mods.shift === true) return null;
  const tag = target.tagName.toUpperCase();
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return null;
  if ((key === " " || key === "Spacebar") && tag !== "BUTTON") return "toggle";
  if (tag === "BUTTON" && key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End") return null;
  if (key === "ArrowLeft") return "previous";
  if (key === "ArrowRight") return "next";
  if (key === "Home") return "first";
  if (key === "End") return "last";
  return null;
}
