"use client";

// WEB-2112 (PD-7): the student's toasts. One region under the host, so a toast
// shown just before a navigation (e.g. after enrolment) is still on the next
// screen. Neutral ones are announced politely (role=status) and go after 3.2 s;
// errors are announced at once (role=alert) and stay until closed.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ToastRegion } from "@ductura/ui";

import { studentToastText } from "./messages.hr";
import { toastLifetime, withToast, withoutToast, type StudentToast, type StudentToastTone } from "./model";

type Show = (text: string, tone?: StudentToastTone) => void;

const ToastContext = createContext<Show | null>(null);

export function StudentToasts({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<StudentToast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => withoutToast(list, id));
  }, []);

  const show = useCallback<Show>((text, tone = "neutral") => {
    const id = nextId.current++;
    setToasts((list) => withToast(list, { id, text, tone }));
    const wait = toastLifetime(tone);
    if (wait !== null) timers.current.set(id, setTimeout(() => dismiss(id), wait));
  }, [dismiss]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const value = useMemo(() => show, [show]);
  return (
    <ToastContext value={value}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} label={studentToastText.region} closeLabel={studentToastText.close} />
    </ToastContext>
  );
}

/** Shows a toast; outside the provider it does nothing, so a screen also renders on its own. */
export function useStudentToast(): Show {
  return useContext(ToastContext) ?? (() => undefined);
}
