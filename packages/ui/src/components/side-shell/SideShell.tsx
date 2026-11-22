"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { toggleTheme } from "../../theme/theme";
import styles from "./SideShell.module.css";

export type SideShellItem = { href: string; label: string };

export type SideShellProps = {
  /** "student", "teacher" or "admin"; the teacher's page frame and error mark differ (prototype.css). */
  role?: string | null;
  /** The app's name beside the mark below 800 px ("Ductura"). */
  name: string;
  /** The one-letter mark of the 64 px rail ("D"). */
  mark?: string;
  /** Where the mark leads and its name for assistive technology ("Ductura, studentska početna"). */
  homeHref: string;
  homeLabel: string;
  /** Name of the side bar (aside) and of the navigation inside it. */
  sideLabel: string;
  navLabel: string;
  items: readonly SideShellItem[];
  /** The href of the item this page belongs to, if any. */
  current?: string;
  /** The visible word of the button that opens the navigation below 800 px ("Izbornik"). */
  menuLabel: string;
  /** Name of the theme button (◐), e.g. "Promijeni svijetlu ili tamnu temu". */
  themeLabel: string;
  /** Quiet links of the foot ("Kako Ductura radi", "Izjava o pristupačnosti"). */
  links?: readonly SideShellItem[];
  /** A help control in the foot; gets the class of the foot's quiet links. */
  help?: (linkClass: string) => ReactNode;
  /** Controls that keep their own look, above the theme button (e.g. the notification bell). */
  tools?: ReactNode;
  /** The account place at the end of the foot: "Odjava" (and the profile link), as outlined buttons. */
  account?: ReactNode;
  /** The prototype's .main.narrow (640 px; 680 px for the teacher). */
  narrow?: boolean;
  /** The page brings its own `<main id="sadrzaj">` (the workspace). */
  ownMain?: boolean;
  /** Id of the side bar that the menu button controls. */
  navId?: string;
  /**
   * The element of the page frame: "main" (the app) or "div" (the catalogue,
   * which has a main of its own, so it shows the same frame without a second landmark).
   */
  frame?: "main" | "div";
  children: ReactNode;
};

/** Flips the theme on `<html>` itself, so React never holds a copy that could disagree. */
function flipTheme() {
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    // Storage blocked: the theme still flips for this page.
  }
  toggleTheme(document.documentElement, storage);
}

/**
 * The prototypes' shell (VIZ-0; Ductura_student.html and Ductura_nastavnik.html
 * `.shell`, D-202): a 64 px side bar with the mark, the navigation in a
 * centred column and the foot (theme ◐, Odjava), and the page in
 * `<main id="sadrzaj">` at most 880 px wide (960 px for the teacher). There is
 * no top bar. Below 800 px the side bar becomes one row at the top with the
 * name and "Izbornik"; the button opens the navigation and the foot in place,
 * under that row. Esc and following a link close it again.
 */
export function SideShell({
  role = null, name, mark = "D", homeHref, homeLabel, sideLabel, navLabel, items, current, menuLabel, themeLabel,
  links = [], help, tools, account, narrow = false, ownMain = false, navId = "bocna-navigacija", frame = "main", children,
}: SideShellProps) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
      setOpen(false);
      menu.current?.focus();
    };
    const wide = window.matchMedia("(min-width: 800px)");
    const onWide = () => {
      if (wide.matches) setOpen(false);
    };
    onWide();
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  // Following a link of the side bar closes it (the page changes in place).
  const closeOnLink = (event: { target: EventTarget }) => {
    if (event.target instanceof Element && event.target.closest("a[href]") !== null) setOpen(false);
  };

  return (
    <div className={styles.shell} data-shell-role={role ?? undefined}>
      <aside className={styles.side} data-open={open} aria-label={sideLabel} id={navId} onClick={closeOnLink}>
        <a className={styles.brand} href={homeHref} aria-label={homeLabel}>
          <span className={styles.mark} aria-hidden="true">{mark}</span>
          <span className={styles.word} aria-hidden="true">{name}</span>
        </a>
        <button ref={menu} type="button" className={styles.menu} aria-expanded={open} aria-controls={navId}
          onClick={() => setOpen((was) => !was)}>
          {menuLabel}
        </button>
        {items.length > 0 ? (
          <nav aria-label={navLabel} className={styles.nav}>
            {items.map((item) => (
              <a key={item.href} href={item.href} aria-current={current === item.href ? "page" : undefined}>{item.label}</a>
            ))}
          </nav>
        ) : null}
        <div className={styles.foot}>
          {tools !== undefined ? <div className={styles.tools}>{tools}</div> : null}
          {links.map((link) => (
            <a key={link.href} className={styles.quiet} href={link.href}
              aria-current={current === link.href ? "page" : undefined}>{link.label}</a>
          ))}
          {help?.(styles.quiet ?? "")}
          <button type="button" className={styles.footButton} aria-label={themeLabel} onClick={flipTheme}>◐</button>
          {account !== undefined ? <div className={styles.account}>{account}</div> : null}
        </div>
      </aside>
      {ownMain ? (
        <div className={styles.own}>{children}</div>
      ) : frame === "div" ? (
        <div className={narrow ? `${styles.main} ${styles.narrow}` : styles.main}>{children}</div>
      ) : (
        <main id="sadrzaj" tabIndex={-1} className={narrow ? `${styles.main} ${styles.narrow}` : styles.main}>
          {children}
        </main>
      )}
    </div>
  );
}
