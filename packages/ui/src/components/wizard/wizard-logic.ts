import type { ReactNode } from "react";

/** Field name to message. An empty object means the step is valid. */
export type WizardErrors = Readonly<Record<string, string>>;

export interface WizardStepContext<V> {
  values: V;
  errors: WizardErrors;
  set: <K extends keyof V>(key: K, value: V[K]) => void;
}

export interface WizardStep<V> {
  id: string;
  label: string;
  /** Pure check of this step's own fields; the wizard never moves on while it reports errors. */
  validate: (values: V) => WizardErrors;
  render: (context: WizardStepContext<V>) => ReactNode;
}

export interface WizardState<V> {
  index: number;
  /** Furthest step the user has legitimately reached; only steps up to it can be jumped to. */
  reached: number;
  values: V;
  errors: WizardErrors;
}

export function startState<V>(values: V): WizardState<V> {
  return { index: 0, reached: 0, values, errors: {} };
}

export function setValue<V, K extends keyof V>(state: WizardState<V>, key: K, value: V[K]): WizardState<V> {
  const { [key as string]: _cleared, ...errors } = state.errors;
  return { ...state, values: { ...state.values, [key]: value }, errors };
}

/** The first step in `from..to-1` that fails its own check, with its errors; null when all pass. */
function firstFailure<V>(steps: readonly WizardStep<V>[], values: V, from: number, to: number): { index: number; errors: WizardErrors } | null {
  for (let index = from; index < to; index += 1) {
    const errors = steps[index]!.validate(values);
    if (Object.keys(errors).length > 0) return { index, errors };
  }
  return null;
}

/** Next never skips: a step with errors keeps the user on it, values untouched. */
export function advance<V>(steps: readonly WizardStep<V>[], state: WizardState<V>): WizardState<V> {
  const errors = steps[state.index]!.validate(state.values);
  if (Object.keys(errors).length > 0) return { ...state, errors };
  const index = Math.min(state.index + 1, steps.length - 1);
  return { ...state, index, reached: Math.max(state.reached, index), errors: {} };
}

/** Back keeps every value the user entered. */
export function retreat<V>(state: WizardState<V>): WizardState<V> {
  return { ...state, index: Math.max(0, state.index - 1), errors: {} };
}

/**
 * A jump back is always allowed. A jump forward is allowed only to an already reached step,
 * and only when every step before it still passes; otherwise the user lands on the failing one.
 */
export function jumpTo<V>(steps: readonly WizardStep<V>[], state: WizardState<V>, target: number): WizardState<V> {
  if (target < 0 || target >= steps.length || target > state.reached || target === state.index) return state;
  if (target < state.index) return { ...state, index: target, errors: {} };
  const failure = firstFailure(steps, state.values, state.index, target);
  return failure ? { ...state, index: failure.index, errors: failure.errors } : { ...state, index: target, errors: {} };
}

/** Finishing re-checks every step, so a step cannot be skipped by going back and editing later. */
export function finishCheck<V>(steps: readonly WizardStep<V>[], state: WizardState<V>): { ok: true } | { ok: false; state: WizardState<V> } {
  const failure = firstFailure(steps, state.values, 0, steps.length);
  return failure ? { ok: false, state: { ...state, index: failure.index, errors: failure.errors } } : { ok: true };
}
