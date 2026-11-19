import styles from "./steps.module.css";
import { stepLabels } from "./messages.hr";

export type StepNumber = 1 | 2 | 3 | 4 | 5;

export type StepsProps = { currentStep: StepNumber };

export function Steps({ currentStep }: StepsProps) {
  return (
    <ol className={styles.steps} role="list">
      {stepLabels.map((label, index) => (
        <li key={label} aria-current={index + 1 === currentStep ? "step" : undefined}>
          <span className={styles.number} aria-hidden="true">{index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
