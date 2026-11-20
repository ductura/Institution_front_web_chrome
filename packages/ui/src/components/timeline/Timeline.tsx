"use client";

import { useEffect, useEffectEvent, useState } from "react";

import { Button } from "../Button";
import { Select } from "../Select";
import { timelineMessages as t } from "./messages.hr";
import styles from "./Timeline.module.css";

export type TimelineProps = {
  /** Number of recorded changes. Position 0 is the starting state. */
  total: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

const speedOptions = [1, 2, 4].map((speed) => ({ value: String(speed), label: `${speed}×` }));

export function Timeline({ total, value, onChange, disabled = false }: TimelineProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState("1");
  const current = Math.max(0, Math.min(value, total));
  const active = playing && !disabled && current < total;
  const advance = useEffectEvent(() => {
    if (!active) return;
    const next = current + 1;
    if (next >= total) setPlaying(false);
    onChange(next);
  });

  useEffect(() => {
    if (!active) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(advance, 900 / Number(speed));
    return () => clearTimeout(timer);
  }, [active, current, speed, total]);

  function seek(next: number) {
    setPlaying(false);
    onChange(next);
  }

  function togglePlayback() {
    if (!active && current === total) onChange(0);
    setPlaying(!active);
  }

  if (total === 0) return <p role="status">{t.empty}</p>;

  return (
    <div className={styles.timeline} role="group" aria-label={t.label}>
      <input
        type="range"
        aria-label={t.slider}
        aria-valuetext={t.step(current, total)}
        min={0}
        max={total}
        value={current}
        disabled={disabled}
        onChange={(event) => seek(event.currentTarget.valueAsNumber)}
      />
      <div className={styles.controls}>
        <Button tone="quiet" disabled={disabled || current === 0} onClick={() => seek(current - 1)}>{t.previous}</Button>
        <Button disabled={disabled} onClick={togglePlayback}>{active ? t.pause : t.play}</Button>
        <Button tone="quiet" disabled={disabled || current === total} onClick={() => seek(current + 1)}>{t.next}</Button>
        <span>{t.step(current, total)}</span>
      </div>
      <Select label={t.speed} options={speedOptions} value={speed} disabled={disabled}
        onChange={(event) => setSpeed(event.currentTarget.value)} />
    </div>
  );
}
