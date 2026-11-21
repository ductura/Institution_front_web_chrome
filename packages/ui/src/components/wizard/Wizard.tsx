"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "../Button";
import styles from "./Wizard.module.css";
import {
  advance, finishCheck, jumpTo, retreat, setValue, startState,
  type WizardState, type WizardStep, type WizardStepContext,
} from "./wizard-logic";

export interface WizardLabels {
  /** Accessible name of the step list. */
  steps: string;
  next: string;
  back: string;
  finish: string;
  /** Shown on the finish button while the finish call runs. */
  finishing: string;
}

/** What the finish call reports; the wizard shows `error` and stays on the last step. */
export type WizardOutcome = { ok: true } | { ok: false; error: string };

export interface WizardProps<V> {
  steps: readonly WizardStep<V>[];
  initialValues: V;
  labels: WizardLabels;
  /** Called once all steps pass; never called while any step has errors. */
  onFinish: (values: V) => Promise<WizardOutcome>;
  /** Shown instead of the form after a successful finish. */
  done?: ReactNode;
  /** Heading level of the step title, default 2. */
  headingLevel?: 2 | 3;
  /** Extra content under the current step's fields (e.g. a preview on the last step). */
  footer?: (values: V, stepIndex: number) => ReactNode;
}

export function Wizard<V>({ steps, initialValues, labels, onFinish, done, headingLevel = 2, footer }: WizardProps<V>) {
  const [state, setState] = useState<WizardState<V>>(() => startState(initialValues));
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const inFlight = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const step = steps[state.index]!;
  const last = state.index === steps.length - 1;
  const Heading = headingLevel === 2 ? "h2" : "h3";

  useEffect(() => {
    if (moved.current) (heading.current ?? doneRef.current)?.focus();
  }, [state.index, finished]);

  function go(next: WizardState<V>) {
    moved.current = true;
    setFailure(null);
    setState(next);
  }

  const context: WizardStepContext<V> = {
    values: state.values,
    errors: state.errors,
    set: (key, value) => { setFailure(null); setState((current) => setValue(current, key, value)); },
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || finished) return;
    if (!last) return go(advance(steps, state));
    const check = finishCheck(steps, state);
    if (!check.ok) return go(check.state);
    inFlight.current = true;
    setPending(true);
    setFailure(null);
    try {
      const outcome = await onFinish(state.values);
      if (outcome.ok) { moved.current = true; setFinished(true); } else setFailure(outcome.error);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  if (finished && done !== undefined) {
    return <section className={styles.wizard}><div ref={doneRef} tabIndex={-1} role="status" className={styles.title}>{done}</div></section>;
  }

  return (
    <section className={styles.wizard}>
      <ol className={styles.steps} role="list" aria-label={labels.steps}>
        {steps.map((item, index) => (
          <li key={item.id} className={styles.step} aria-current={index === state.index ? "step" : undefined}>
            <button type="button" className={styles.stepButton} disabled={pending || index > state.reached}
              onClick={() => go(jumpTo(steps, state, index))}>
              <span className={styles.number} aria-hidden="true">{index + 1}</span>
              {item.label}
            </button>
          </li>
        ))}
      </ol>
      <Heading ref={heading} tabIndex={-1} className={styles.title}>{step.label}</Heading>
      <form onSubmit={submit} noValidate>
        <fieldset className={styles.fields} disabled={pending}>
          {step.render(context)}
          {footer?.(state.values, state.index)}
          {failure && <p className={styles.notice} role="alert">{failure}</p>}
          <div className={styles.actions}>
            {state.index > 0 && <Button tone="quiet" onClick={() => go(retreat(state))}>{labels.back}</Button>}
            <Button type="submit" busy={pending}>{last ? (pending ? labels.finishing : labels.finish) : labels.next}</Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
