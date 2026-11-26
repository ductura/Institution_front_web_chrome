"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./PanelTabs.module.css";

export type PanelTab = {
  /** Stable key, also part of the element ids. */
  id: string;
  label: string;
  content: ReactNode;
  /**
   * A number next to the name (prototype `.cnt`, e.g. open comments), shown only
   * when above zero; `label` is the whole phrase for assistive technology
   * ("3 otvorena komentara"), the digit itself is hidden from it.
   */
  count?: { value: number; label: string };
};

export type PanelTabsProps = {
  /** Name of the tab list for assistive technology. */
  label: string;
  tabs: readonly PanelTab[];
  /** The tab open on first render; the first tab when absent or unknown. */
  initial?: string;
  /** Told the id of every tab that opens (click or keys); the page may keep it, e.g. in the address. */
  onChange?: (id: string) => void;
  /**
   * The tab the page asks for (ED-45: "Poveži u Literaturi" opens Literatura); every change opens it, and
   * the person's own clicks still work. With `onChange` keeping it, the page and the tabs always agree.
   */
  selected?: string;
};

/** The number beside a tab or panel button: the digit for the eye, the phrase for a screen reader. */
export function TabCount({ value, label }: { value: number; label: string }) {
  return (
    <>
      <span className={`panel-tabs__count ${styles.count}`} aria-hidden="true">{value}</span>
      {/* In parentheses: a hidden span is read as its own block, so a leading comma would get a space before it. */}
      <span className="visually-hidden">({label})</span>
    </>
  );
}

/**
 * The tabs of the right panel (design editor-v11 §5.1; moved from the web's shell, WEB-06): a sticky strip of
 * text tabs, the open one underlined in the primary colour and set in bold, so
 * the choice never rests on colour alone.
 *
 * Every panel stays mounted and the closed ones are `hidden`: a panel may own
 * work that must not stop when another tab is open (the comment panel marks
 * its anchors in the text and watches the session).
 *
 * Keyboard (WAI-ARIA tabs pattern, automatic activation): the list is one Tab
 * stop; Left/Right move and open, Home/End go to the ends.
 */
export function PanelTabs({ label, tabs, initial, onChange, selected }: PanelTabsProps) {
  const base = useId();
  const known = (id: string | undefined) => id !== undefined && tabs.some((tab) => tab.id === id);
  const first = known(selected) ? selected : known(initial) ? initial : tabs[0]?.id;
  const [open, setShown] = useState(first);
  const [asked, setAsked] = useState(selected);
  if (selected !== asked) {
    setAsked(selected);
    if (known(selected)) setShown(selected);
  }
  const setOpen = (id: string) => { setShown(id); onChange?.(id); };
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === open);
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    const id = next === null ? undefined : tabs[next]?.id;
    if (id === undefined) return;
    event.preventDefault();
    setOpen(id);
    buttons.current.get(id)?.focus();
  };

  return (
    <div className="panel-tabs">
      <div role="tablist" aria-label={label} className="panel-tabs__list" onKeyDown={move}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(element) => {
              if (element) buttons.current.set(tab.id, element);
              else buttons.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${tab.id}`}
            aria-selected={tab.id === open}
            aria-controls={`${base}-panel-${tab.id}`}
            tabIndex={tab.id === open ? 0 : -1}
            className="panel-tabs__tab"
            onClick={() => setOpen(tab.id)}
          >
            {tab.label}
            {tab.count && tab.count.value > 0 ? <TabCount {...tab.count} /> : null}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${base}-panel-${tab.id}`}
          aria-labelledby={`${base}-tab-${tab.id}`}
          className="panel-tabs__panel"
          hidden={tab.id !== open}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
