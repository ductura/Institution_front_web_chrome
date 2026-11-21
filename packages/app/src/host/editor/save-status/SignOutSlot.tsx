"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import styles from "../../SignOut.module.css";

export const SignOutSlot = createContext<{
  target: HTMLDivElement | null;
  setTarget: (target: HTMLDivElement | null) => void;
} | null>(null);

export function EditorSignOutSlot({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return <SignOutSlot value={{ target, setTarget }}>{children}</SignOutSlot>;
}

export function EditorSignOutOutlet({ children }: { children: ReactNode }) {
  const slot = useContext(SignOutSlot);
  return (
    <div>
      <div ref={slot?.setTarget} className={styles.editorSignOut} />
      <div className={styles.defaultSignOut}>{children}</div>
    </div>
  );
}
