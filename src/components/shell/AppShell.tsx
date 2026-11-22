"use client";

import { toggleTheme } from "@ductura/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { messagesHr, type Messages } from "../../../locales/hr.ts";

import styles from "./AppShell.module.css";
import { accountPlace, appHref, HOW_IT_WORKS_HREF, homeHref, navFor, type ShellRole } from "./nav";

// Ported from Ductus src/components/shell/AppShell.tsx at 078c780f (DAN-753,
// 2.c4-a1). Not here yet: the sign-out (ShellLogout) and the session mark
// (SessionObserver) come with 2.c3-b, "Prijavi problem" with its route
// (support/problem-report, PENDING). next/link is a plain <a>.

const ICONS = {
  menu: "M3 6h18M3 12h18M3 18h18",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1",
  moon: "M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z",
  chevron: "m9 5 7 7-7 7",
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

function Logo() {
  return (
    <svg className={styles.logo} viewBox="0 0 28 34" aria-hidden="true">
      <path d="M5 6c7 1 12-1 17-4v7c-5 4-10 5-17 4M5 15c7 1 12-1 17-4v7c-5 4-10 5-17 4M5 24c7 1 12-1 17-4v7c-5 4-10 5-17 4" />
    </svg>
  );
}

/** Flips the theme on `<html>` itself, so React never holds a copy that could disagree. */
function ThemeToggle({ label }: { label: string }) {
  const toggle = () => {
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      // Storage blocked: the theme changes on this page only.
    }
    toggleTheme(document.documentElement, storage);
  };
  return (
    <button type="button" className={styles.iconButton} aria-label={label} onClick={toggle}>
      <span className={styles.toLight}><Icon name="sun" /></span>
      <span className={styles.toDark}><Icon name="moon" /></span>
    </button>
  );
}

export type AppShellProps = {
  /** The role the server read for this page; null shows no navigation and no role label. */
  role: ShellRole | null;
  /**
   * Journal scope the sign-out reads before posting (D-118). A scope means a
   * signed-in person, so the sign-out shows with it, with or without a role;
   * null: no sign-out unless the page brings its own `account`.
   */
  scope: string | null;
  /** The href of the navigation item this page belongs to, if any. */
  current?: string;
  /** Breadcrumb, first to last; the last is the page itself. */
  crumbs: readonly string[];
  /**
   * The account control in place of the sign-out form, for a page whose
   * sign-out has more to do (the workspace's LocalLogout, D-118), or a way to
   * sign in again. Shown even without a role.
   */
  account?: ReactNode;
  /**
   * Id of the side bar that ☰ controls. Web (DAN-753): one per page, so the
   * catalogue gives each of its shells its own; the app keeps the default.
   */
  navId?: string;
  /** The page brings its own `<main id="sadrzaj">` (the workspace, FE-D1). */
  ownMain?: boolean;
  /**
   * The side bar is a drawer behind ☰ at every width, so the page takes the
   * whole width (the workspace, owner 1. 11. 2026.). Navigation and signing
   * out stay one press away.
   */
  drawer?: boolean;
  /**
   * The path the app is served under (/app/web or /app/chrome, #2028
   * c.6993786629 §1); every link of the shell starts with it. Empty by default.
   */
  base?: string;
  /** The institution's name from the session, in the top bar at every width; none when absent. */
  institution?: string | null;
  /** Catalogue of the interface language (D-70, WEB-1804); Croatian when absent. */
  messages?: Messages;
  /** A visible word for the drawer button below 800 px ("Izbornik"); the icon when absent. */
  menuText?: string;
  /** The help place of the side bar (WEB-1806): "Prijavi problem"; gets the class of the shell's own links. */
  help?: (linkClass: string) => ReactNode;
  children: ReactNode;
};

/**
 * The design v3 shell (#476 6314969336): side navigation, top bar and the
 * page in `<main id="sadrzaj">`. It shows only static labels and the role
 * (I2); signing out (the same POST as everywhere, without JavaScript, I5)
 * joins with 2.c3-b. Below 800 px the side bar is a drawer behind ☰.
 */
export default function AppShell({ role, scope, current, crumbs, account, navId = "bocna-navigacija", ownMain = false, drawer = false, base = "", institution = null, messages = messagesHr, menuText, help, children }: AppShellProps) {
  const t = messages;
  const [open, setOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const items = navFor(role, t);
  const home = appHref(base, homeHref(role));
  const place = accountPlace(scope, account !== undefined);

  useEffect(() => {
    if (!open) return;
    sidebar.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      // A modal dialog (the workspace's sign-out, D-118) takes its own Esc.
      if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
      setOpen(false);
      menuButton.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // From 800 px the side bar is no drawer, so an open one must not leave the
  // shade and an inert page behind.
  useEffect(() => {
    if (!open || drawer) return;
    const wide = window.matchMedia("(min-width: 800px)");
    const onChange = () => {
      if (wide.matches) setOpen(false);
    };
    onChange();
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [open, drawer]);

  const close = () => {
    setOpen(false);
    menuButton.current?.focus();
  };

  // Rendered once: in the side bar, or in the top bar where the side bar is a
  // closed drawer, so signing out stays one press away (D-118).
  // A link the page brings into the account place ("Postavke profila", WEB-1804)
  // closes the drawer as the navigation's own links do.
  const accountBlock = place === "own" ? (
    <div className={styles.account} onClick={(event) => {
      if (event.target instanceof Element && event.target.closest("a[href]") !== null) setOpen(false);
    }}>
      {role !== null ? <span className={styles.who}>{t.shell.role[role]}</span> : null}
      {account}
    </div>
  ) : place === "signOut" ? (
    // A signed-in person: the role label only with a role; the sign-out
    // itself joins this place with 2.c3-b (#802 part B).
    <div className={styles.account}>
      {role !== null ? <span className={styles.who}>{t.shell.role[role]}</span> : null}
    </div>
  ) : null;

  return (
    <div className={drawer ? `${styles.shell} ${styles.drawerShell}` : styles.shell}>
      {open ? <div className={styles.shade} onClick={close} aria-hidden="true" /> : null}
      <aside ref={sidebar} className={styles.sidebar} data-open={open} aria-label={t.shell.sideNav} id={navId}>
        <a className={styles.brand} href={home} aria-label={t.shell.home}>
          <Logo />
          <span className={styles.word}>{t.app.name}</span>
        </a>
        {role !== null ? (
          <>
            <p className={styles.space}>{t.shell.space[role]}</p>
            <nav aria-label={t.shell.workNav}>
              <ul className={styles.nav}>
                {items.map((item) => (
                  <li key={item.href}>
                    <a
                      className={styles.navItem}
                      href={appHref(base, item.href)}
                      aria-current={current === item.href ? "page" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </>
        ) : null}
        <div className={styles.bottom}>
          {/* "Kako Ductura radi" (DAN-431, J-02): for everyone, with or without a role. */}
          <a
            className={styles.infoLink}
            href={appHref(base, HOW_IT_WORKS_HREF)}
            aria-current={current === HOW_IT_WORKS_HREF ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {t.shell.howItWorks}
          </a>
          {/* "Izjava o pristupačnosti" (WEB-1805, F-03): for everyone, as the law asks it be reachable. */}
          <a className={styles.infoLink} href={appHref(base, "/pristupacnost")} onClick={() => setOpen(false)}>
            {t.shell.accessibilityStatement}
          </a>
          {help !== undefined ? help(styles.infoLink ?? "") : null}
          <p className={styles.note}>
            <strong>{t.shell.demoBadge}</strong>
            {t.shell.demoNote}
          </p>
          {drawer ? null : accountBlock}
        </div>
      </aside>
      <div className={styles.area}>
        <header className={styles.topbar}>
          <button
            ref={menuButton}
            type="button"
            className={`${styles.iconButton} ${styles.menuButton}${menuText === undefined ? "" : ` ${styles.menuText}`}`}
            aria-label={open ? t.shell.closeNav : t.shell.openNav}
            aria-expanded={open}
            aria-controls={navId}
            onClick={() => setOpen((was) => !was)}
          >
            {menuText === undefined ? <Icon name="menu" /> : menuText}
          </button>
          {/* "Početna" stays in the top bar at every width, also while the
              side bar is a closed drawer (#802 part B). */}
          <nav aria-label={t.shell.breadcrumb} className={styles.crumbs}>
            <a
              className={styles.homeCrumb}
              href={home}
              aria-current={crumbs.length === 0 ? "page" : undefined}
            >
              {t.shell.homeCrumb}
            </a>
            {crumbs.map((crumb, i) => (
              <span key={i} className={styles.crumb} aria-current={i === crumbs.length - 1 ? "page" : undefined}>
                <Icon name="chevron" />
                {crumb}
              </span>
            ))}
          </nav>
          <div className={styles.actions}>
            {institution !== null ? <span className={styles.institution}>{institution}</span> : null}
            <span className={styles.demo}>{t.shell.demoBadge}</span>
            <ThemeToggle label={t.shell.theme} />
            {drawer ? accountBlock : null}
          </div>
        </header>
        {ownMain ? (
          <div className={styles.content} inert={open}>{children}</div>
        ) : (
          <main id="sadrzaj" tabIndex={-1} className={styles.content} inert={open}>
            {children}
          </main>
        )}
      </div>
    </div>
  );
}
