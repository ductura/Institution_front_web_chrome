"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToastRegion, type ToastItem, type ToastTone } from "@ductura/ui";

import { dropToast, pushToast, teacherToastTimeout } from "./outcome-toast";
import { teacherToastHr as t } from "./messages.hr";

/** The teacher's toasts: `show` adds one; call it only after the server confirmed (B-6). */
export function useTeacherToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => dropToast(list, id));
  }, []);

  const show = useCallback((text: string, tone: ToastTone = "neutral") => {
    const id = nextId.current++;
    setToasts((list) => pushToast(list, id, text, tone));
    const wait = teacherToastTimeout(tone);
    if (wait !== null) timers.current.set(id, setTimeout(() => dismiss(id), wait));
    return id;
  }, [dismiss]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return { toasts, show, dismiss };
}

/** The region of the teacher's toasts, in Croatian. */
export function TeacherToastRegion({ toasts, onDismiss }: { toasts: readonly ToastItem[]; onDismiss: (id: number) => void }) {
  return <ToastRegion toasts={toasts} onDismiss={onDismiss} label={t.region} closeLabel={t.close} />;
}
