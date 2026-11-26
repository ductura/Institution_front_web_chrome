"use client";

import { memo, useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { pluralHr } from "../../lib/i18n/hr";
import { messagesHr } from "../../lib/i18n/messages.hr";

import {
  BulletListIcon,
  CaretDownIcon,
  CheckIcon,
  ClearFormattingIcon,
  ClockIcon,
  CopyIcon,
  DocumentIcon,
  FootnoteIcon,
  LockIcon,
  NumberedListIcon,
  PasteIcon,
  PathIcon,
  PencilIcon,
  QuoteIcon,
  RedoIcon,
  SendIcon,
  SheetThemeIcon,
  UndoIcon,
} from "./icons";
import styles from "./Preview.module.css";

const t = messagesHr.landing.preview;

type Forms = { one: string; few: string; many: string };
const form = (n: number, f: Forms) => pluralHr(n, f.one, f.few, f.many);
const fill = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
const num = (x: number) => x.toLocaleString("hr-HR");
const countWords = (s: string) => {
  const x = s.trim();
  return x ? x.split(/\s+/).length : 0;
};

const GOAL = 150;
const VERSIONS = 9;
const OPENING_WORDS = countWords([t.essay.title, t.essay.byline, t.essay.chapter, t.essay.opening].join(" "));
const SESSION_HEIGHTS = [0.77, 1, 0.89, 0.44];
const TIMELINE = [0, 0.25, 0.75, 1];
const BLOCK_TYPES = ["p", "h2", "h3", "h4", "blockquote"] as const;
const TICK = "M3.5 8.5 6.5 11.5 12.5 4.5";
const CROSS = "M4.5 4.5l7 7M11.5 4.5l-7 7";

function Tool({
  k,
  tip,
  kbd,
  label = tip,
  pressed,
  className,
  children,
}: {
  k: string;
  tip: string;
  kbd?: string;
  label?: string;
  pressed?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className ? `${styles.tool} ${className}` : styles.tool}
      data-k={k}
      data-tip={tip}
      data-kbd={kbd}
      aria-label={label}
      aria-pressed={pressed ? false : undefined}
    >
      {children}
    </button>
  );
}

/**
 * The live preview of the product (#prikaz): a student writes, pastes and
 * submits; the teacher sees the same text with the recorded facts. Nothing is
 * saved or sent. The markup is static, so the student view reads without
 * script; the controller below works on the DOM directly, which is why the
 * component never re-renders (memo, no props, no state). It plays on its own
 * once in view, unless reduced motion is asked for, and stops at the first
 * touch.
 */
export const Preview = memo(function Preview() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => (root.current ? start(root.current) : undefined), []);

  return (
    <div className={styles.preview} id="prikaz" ref={root}>
      <div className={styles.top}>
        <div className={styles.toggle} role="group" aria-label={t.views} data-x="toggle">
          <span className={styles.thumb} aria-hidden="true" data-x="thumb" />
          <button type="button" className={`${styles.option} ${styles.active}`} data-p="student" aria-pressed="true">
            {t.student}
          </button>
          <button type="button" className={styles.option} data-p="teacher" aria-pressed="false">
            {t.teacher}
          </button>
        </div>
        <span className={styles.local}>{t.local}</span>
      </div>

      <div className={styles.window}>
        <div className={styles.space}>
          <div className={`${styles.view} ${styles.student}`} data-x="student">
            <div className={styles.bar}>
              <nav className={styles.path} aria-label={t.path}>
                <DocumentIcon className={styles.icon} />
                <span className={styles.course}>{t.course}</span>
                <span className={styles.slash}>/</span>
                <b>{t.work}</b>
              </nav>
              <button type="button" className={styles.submit} data-x="submit">
                <SendIcon className={styles.icon} />
                <span>{t.submit}</span>
              </button>
            </div>
            <div className={styles.toolRow}>
              <div className={styles.tools} role="toolbar" aria-label={t.toolbar} aria-controls="prikaz-pisanje">
                <Tool k="undo" tip={t.tools.undo} kbd="Ctrl+Z">
                  <UndoIcon className={styles.icon} />
                </Tool>
                <Tool k="redo" tip={t.tools.redo} kbd="Ctrl+Y">
                  <RedoIcon className={styles.icon} />
                </Tool>
                <i className={styles.sep} aria-hidden="true" />
                <button
                  type="button"
                  className={styles.style}
                  data-menu="types"
                  aria-haspopup="menu"
                  aria-expanded="false"
                  aria-label={t.tools.blockType}
                  data-tip={t.tools.blockType}
                >
                  <span data-x="type-name">{t.blockTypes.p}</span>
                  <CaretDownIcon className={styles.icon} />
                </button>
                <i className={styles.sep} aria-hidden="true" />
                <Tool k="bold" tip={t.tools.bold} kbd="Ctrl+B" pressed>
                  {t.marks.bold}
                </Tool>
                <Tool k="italic" tip={t.tools.italic} kbd="Ctrl+I" pressed className={styles.italic}>
                  {t.marks.italic}
                </Tool>
                <Tool k="underline" tip={t.tools.underline} kbd="Ctrl+U" pressed className={styles.underline}>
                  {t.marks.underline}
                </Tool>
                <Tool k="strikeThrough" tip={t.tools.strike} pressed className={styles.strike}>
                  {t.marks.strike}
                </Tool>
                <i className={styles.sep} aria-hidden="true" />
                <Tool k="insertUnorderedList" tip={t.tools.bullets} pressed>
                  <BulletListIcon className={styles.icon} />
                </Tool>
                <Tool k="insertOrderedList" tip={t.tools.numbers} pressed>
                  <NumberedListIcon className={styles.icon} />
                </Tool>
                <Tool k="navod" tip={t.tools.quote}>
                  <QuoteIcon className={styles.icon} />
                </Tool>
                <i className={styles.sep} aria-hidden="true" />
                <Tool k="fusnota" tip={t.tools.footnote} label={t.tools.footnoteLabel}>
                  <FootnoteIcon className={styles.icon} />
                </Tool>
                <button
                  type="button"
                  className={`${styles.tool} ${styles.special}`}
                  data-menu="specials"
                  aria-haspopup="menu"
                  aria-expanded="false"
                  aria-label={t.tools.special}
                  data-tip={t.tools.special}
                >
                  <span className={styles.omega} aria-hidden="true">
                    Ω
                  </span>
                  <CaretDownIcon className={styles.icon} />
                </button>
                <Tool k="removeFormat" tip={t.tools.clear}>
                  <ClearFormattingIcon className={styles.icon} />
                </Tool>
                <i className={styles.sep} aria-hidden="true" />
                <Tool k="list" tip={t.tools.darkSheet} pressed>
                  <SheetThemeIcon className={styles.icon} />
                </Tool>
                <Tool k="kopiraj" tip={t.tools.copy}>
                  <CopyIcon className={styles.icon} />
                </Tool>
              </div>
            </div>
            <div className={styles.body}>
              <div className={styles.desk}>
                <div
                  className={`${styles.sheet} ${styles.writing}`}
                  id="prikaz-pisanje"
                  data-x="writing"
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-label={t.editorLabel}
                  spellCheck={false}
                >
                  <h2>{t.essay.title}</h2>
                  <p className={styles.byline}>{t.essay.byline}</p>
                  <h3>{t.essay.chapter}</h3>
                  <p>{t.essay.opening}</p>
                </div>
              </div>
            </div>
            <div className={styles.status}>
              <span className={styles.saved} data-x="saved">
                <svg aria-hidden="true" viewBox="0 0 16 16">
                  <path d={TICK} />
                </svg>
                <span data-x="state" role="status">
                  {t.saved}
                </span>
              </span>
              <span>
                {t.version} <b data-x="ver">{VERSIONS}</b>
              </span>
              <span className={styles.goal} title={t.goalTitle}>
                <span>
                  <b data-x="words">{num(OPENING_WORDS)}</b> <span className={styles.mobileHide}>/ </span>
                  <span className={styles.mobileHide}>{GOAL}</span> {t.words}
                </span>
                <i className={styles.goalBar} aria-hidden="true">
                  <i data-x="goal" style={{ width: `${Math.min(100, (OPENING_WORDS / GOAL) * 100)}%` }} />
                </i>
              </span>
              <span className={`${styles.session} ${styles.mobileHide}`}>
                <i className={styles.pulse} aria-hidden="true" />
                {t.session} <b data-x="clock">00:42</b>
              </span>
              <span className={styles.right}>
                <button type="button" className={styles.paste} data-k="umetni" title={t.pasteTitle}>
                  <PasteIcon className={styles.icon} />
                  <span>{t.paste}</span>
                </button>
              </span>
            </div>
          </div>

          <div className={`${styles.view} ${styles.teacher}`} data-x="teacher" hidden>
            <div className={styles.bar}>
              <nav className={styles.path} aria-label={t.path}>
                <DocumentIcon className={styles.icon} />
                <span className={styles.course}>{t.submitted}</span>
                <span className={styles.slash}>/</span>
                <b>{t.author}</b>
              </nav>
              <button type="button" className={styles.stamp} data-x="stamp" data-s="ok" aria-live="polite">
                <i aria-hidden="true" />
                <svg className={`${styles.stampMark} ${styles.yes}`} aria-hidden="true" viewBox="0 0 16 16">
                  <path d={TICK} />
                </svg>
                <svg className={`${styles.stampMark} ${styles.no}`} aria-hidden="true" viewBox="0 0 16 16">
                  <path d={CROSS} />
                </svg>
                <b>{t.same}</b>
                <small>{fill(t.versionN, { n: VERSIONS })}</small>
              </button>
            </div>
            <div className={`${styles.body} ${styles.teacherBody}`}>
              <div className={styles.desk}>
                <div className={styles.sheetFrame}>
                  <span className={styles.seal} aria-hidden="true">
                    <LockIcon className={styles.icon} />
                    {t.readOnly}
                  </span>
                  <div className={`${styles.sheet} ${styles.reading}`} data-x="reading" aria-label={t.readerLabel} />
                </div>
              </div>
              <aside className={styles.side} aria-label={t.facts}>
                <section>
                  <h4>
                    <span className={styles.heading}>
                      <PencilIcon className={styles.icon} />
                      {t.origin}
                    </span>
                  </h4>
                  <div className={styles.big}>
                    <b data-x="percent">100 %</b>
                    <span>{t.typedIn}</span>
                  </div>
                  <div className={styles.ratio} aria-hidden="true">
                    <i data-x="ratio-typed" />
                    <i data-x="ratio-pasted" />
                  </div>
                  <dl className={styles.legend}>
                    <div>
                      <dt>
                        <i />
                        {t.typedLabel}
                      </dt>
                      <dd data-x="typed">{fill(t.chars, { n: 0 })}</dd>
                    </div>
                    <div>
                      <dt>
                        <i className={styles.pasted} />
                        {t.pastedLabel}
                      </dt>
                      <dd data-x="pasted">{fill(t.chars, { n: 0 })}</dd>
                    </div>
                    <div>
                      <dt>
                        <i className={styles.versions} />
                        {t.versions}
                      </dt>
                      <dd data-x="versions">{VERSIONS}</dd>
                    </div>
                  </dl>
                </section>
                <section>
                  <h4>
                    <span className={styles.heading}>
                      <PathIcon className={styles.icon} />
                      {t.pathTitle}
                    </span>
                    <span data-x="pt-count">
                      {VERSIONS} {form(VERSIONS, t.versionWord)}
                    </span>
                  </h4>
                  <div className={styles.ptRow}>
                    <b data-x="pt-ver">{fill(t.versionN, { n: VERSIONS })}</b>
                    <span data-x="pt-when">{t.times[t.times.length - 1]}</span>
                  </div>
                  <div className={styles.ptControls}>
                    <button
                      type="button"
                      className={styles.play}
                      data-x="play"
                      aria-pressed="false"
                      aria-label={t.play}
                      title={t.play}
                    >
                      <svg className={styles.playIcon} viewBox="0 0 10 10" aria-hidden="true">
                        <path d="M2.5 1.5v7l6-3.5z" />
                      </svg>
                      <svg className={styles.pauseIcon} viewBox="0 0 10 10" aria-hidden="true">
                        <path d="M2.25 1.75h2v6.5h-2zM5.75 1.75h2v6.5h-2z" />
                      </svg>
                    </button>
                    <input
                      type="range"
                      className={styles.slider}
                      data-x="slider"
                      min={1}
                      max={VERSIONS}
                      step={1}
                      defaultValue={VERSIONS}
                      aria-label={t.sliderLabel}
                    />
                  </div>
                  <div className={styles.days} data-x="days" aria-hidden="true" />
                  <p className={styles.ptHint} data-x="pt-hint">
                    {t.pathHint}
                  </p>
                  <div className={styles.verify} data-x="verify" data-s="ok" aria-live="polite">
                    <svg className={styles.yes} viewBox="0 0 16 16" aria-hidden="true">
                      <path d={TICK} />
                    </svg>
                    <svg className={styles.no} viewBox="0 0 16 16" aria-hidden="true">
                      <path d={CROSS} />
                    </svg>
                    <svg className={styles.wait} viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M4 8h8" />
                    </svg>
                    <p data-x="verify-text">{fill(t.exact, { n: VERSIONS })}</p>
                  </div>
                  <div className={styles.links}>
                    <button type="button" className={styles.link} data-x="show-place" hidden>
                      {t.showPlace}
                    </button>
                    <button type="button" className={styles.link} data-x="try-edit">
                      {t.tryEdit}
                    </button>
                  </div>
                </section>
                <section>
                  <h4>
                    <span className={styles.heading}>
                      <ClockIcon className={styles.icon} />
                      {t.sessions}
                    </span>{" "}
                    <span>{t.sessionsTotal}</span>
                  </h4>
                  <div className={styles.sessions} data-x="sessions" aria-label={t.sessionsLabel}>
                    {t.days.map((d, i) => (
                      <div
                        key={d.day}
                        className={d.day === t.today ? styles.today : undefined}
                        style={{ "--v": SESSION_HEIGHTS[i], "--n": i } as CSSProperties}
                        data-day={d.day}
                        role="button"
                        tabIndex={0}
                        title={fill(t.sessionTitle, d)}
                      >
                        <small>{d.minutes}</small>
                        <i />
                        {d.day}
                      </div>
                    ))}
                  </div>
                </section>
                <section>
                  <h4>
                    <span className={styles.heading}>
                      <SendIcon className={styles.icon} />
                      {t.submission}
                    </span>
                  </h4>
                  <div className={styles.timeline} data-x="timeline" aria-hidden="true">
                    <i className={styles.flow} />
                    {TIMELINE.map((x, i) => (
                      <i
                        key={x}
                        className={i === TIMELINE.length - 1 ? `${styles.dot} ${styles.end}` : styles.dot}
                        style={{ "--x": x } as CSSProperties}
                        title={t.timeline[i]}
                      />
                    ))}
                    <small className={styles.first}>{t.timelineStart}</small>
                    <small className={styles.last}>{t.timelineEnd}</small>
                  </div>
                  <dl className={`${styles.legend} ${styles.plain}`}>
                    <div>
                      <dt>{t.submittedAt}</dt>
                      <dd>{t.submittedWhen}</dd>
                    </div>
                    <div>
                      <dt>{t.firstEdit}</dt>
                      <dd>{t.firstEditWhen}</dd>
                    </div>
                    <div>
                      <dt>{t.lastEdit}</dt>
                      <dd>{t.lastEditWhen}</dd>
                    </div>
                    <div>
                      <dt>{t.largestPaste}</dt>
                      <dd data-x="largest">{fill(t.chars, { n: num(t.essay.pasted.length) })}</dd>
                    </div>
                    <div>
                      <dt>{t.deletions}</dt>
                      <dd>{t.deletionsCount}</dd>
                    </div>
                  </dl>
                </section>
                <section>
                  <h4>
                    <span className={styles.heading}>
                      <PasteIcon className={styles.icon} />
                      {t.inserts}
                    </span>{" "}
                    <span data-x="insert-count">0</span>
                  </h4>
                  <ul className={styles.inserts} data-x="inserts" />
                </section>
              </aside>
            </div>
            <div className={styles.status}>
              <span>{t.statusSubmitted}</span>
              <span>
                {t.version} <b data-x="t-ver">{VERSIONS}</b>
              </span>
              <span>
                <b data-x="t-words">{num(OPENING_WORDS)}</b> {t.words}
              </span>
              <span className={styles.mobileHide}>{t.statusSessions}</span>
              <span className={styles.right}>{t.readOnly}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar menus and the tooltip are fixed, so the window's edge does not clip them. */}
      <div className={styles.menu} data-x="menu-types" role="menu" aria-label={t.tools.blockType} hidden>
        {BLOCK_TYPES.map((v) => (
          <button
            key={v}
            type="button"
            className={styles.blockType}
            role="menuitemradio"
            data-v={v}
            aria-checked={v === "p"}
          >
            <span className={styles.sample}>{t.blockTypes[v]}</span>
            <CheckIcon className={`${styles.icon} ${styles.check}`} />
          </button>
        ))}
      </div>
      <div className={styles.menu} data-x="menu-specials" role="menu" aria-label={t.tools.special} hidden>
        <div className={styles.menuTitle}>{t.specialTitle}</div>
        <div className={styles.specials}>
          {t.specials.map((s) => (
            <button key={s.mark} type="button" role="menuitem" data-z={s.mark} aria-label={s.label}>
              <b>{s.mark}</b>
              <small>{s.short}</small>
            </button>
          ))}
        </div>
      </div>
      <div className={styles.tip} data-x="tip" aria-hidden="true" />
    </div>
  );
});

/** The controller of koncepti/naslovnica, scoped to the preview; returns its cleanup. */
function start(root: HTMLElement): () => void {
  const ac = new AbortController();
  const on = { signal: ac.signal };
  const timeouts = new Set<number>();
  let frame = 0;
  let dead = false;
  const after = (f: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timeouts.delete(id);
      f();
    }, ms);
    timeouts.add(id);
    return id;
  };
  const wait = (ms: number) => new Promise<void>((r) => after(r, ms));
  const $ = <T extends HTMLElement = HTMLElement>(k: string) => root.querySelector<T>(`[data-x="${k}"]`)!;
  const all = <T extends HTMLElement = HTMLElement>(s: string, from: ParentNode = root) => [
    ...from.querySelectorAll<T>(s),
  ];
  const cls = (c: string) => `.${CSS.escape(c)}`;
  const selection = () => window.getSelection()!;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  const pis = $("writing");
  const cit = $("reading");
  const stateEl = $("state");
  const savedEl = $("saved");
  const stamp = $("stamp");
  const verifyEl = $("verify");
  const slider = $<HTMLInputElement>("slider");
  const playBtn = $("play");
  const tryEdit = $("try-edit");
  const showPlace = $("show-place");
  const byline = cls(styles.byline!);

  let versions = VERSIONS;
  let lastVersion = 0;
  let touched = false;
  let recorded = "";
  let edited = false;
  let checkId = 0;
  let submittedText = "";
  let submittedBlocks: string[] = [];
  let saveTimer = 0;
  const began = Date.now();
  const words = () => countWords(pis.innerText || pis.textContent || "");

  /* Student / Teacher: a click, or dragging the thumb left and right. */
  const toggle = $("toggle");
  const thumb = $("thumb");
  const options = all<HTMLButtonElement>("[data-p]", toggle);
  let current = "student";
  let drag: { x0: number; k0: number; id: number } | null = null;
  let dragged = false;
  function place(el: HTMLElement) {
    thumb.style.setProperty("--x", `${el.offsetLeft}px`);
    thumb.style.setProperty("--w", `${el.offsetWidth}px`);
    options.forEach((o) => o.classList.toggle(styles.active!, o === el));
  }
  function show(p: string) {
    current = p;
    options.forEach((o) => o.setAttribute("aria-pressed", String(o.dataset.p === p)));
    place(options.find((o) => o.dataset.p === p)!);
    $("student").hidden = p !== "student";
    $("teacher").hidden = p !== "teacher";
    if (p === "teacher") void teacher(true);
  }
  options.forEach((o) =>
    o.addEventListener(
      "click",
      () => {
        stop();
        show(o.dataset.p!);
      },
      on,
    ),
  );
  const nearest = (x: number) =>
    options.reduce((a, o) =>
      Math.abs(o.offsetLeft + o.offsetWidth / 2 - x) < Math.abs(a.offsetLeft + a.offsetWidth / 2 - x) ? o : a,
    );
  toggle.addEventListener(
    "pointerdown",
    (e) => {
      drag = { x0: e.clientX, k0: parseFloat(thumb.style.getPropertyValue("--x")) || 4, id: e.pointerId };
      dragged = false;
    },
    on,
  );
  toggle.addEventListener(
    "pointermove",
    (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x0;
      if (!dragged && Math.abs(dx) < 5) return;
      if (!dragged) {
        dragged = true;
        stop();
        toggle.classList.add(styles.dragging!);
        toggle.setPointerCapture(drag.id);
      }
      const x = Math.min(Math.max(drag.k0 + dx, 4), toggle.clientWidth - thumb.offsetWidth - 4);
      thumb.style.setProperty("--x", `${x}px`);
      const b = nearest(x + thumb.offsetWidth / 2);
      options.forEach((o) => o.classList.toggle(styles.active!, o === b));
    },
    on,
  );
  const release = () => {
    if (!drag) return;
    drag = null;
    if (!dragged) return;
    toggle.classList.remove(styles.dragging!);
    show(nearest(parseFloat(thumb.style.getPropertyValue("--x")) + thumb.offsetWidth / 2).dataset.p!);
  };
  toggle.addEventListener("pointerup", release, on);
  toggle.addEventListener("pointercancel", release, on);
  const settle = () => place(options.find((o) => o.dataset.p === current)!);
  settle();
  void document.fonts?.ready.then(() => {
    if (!dead) settle();
  });
  window.addEventListener("resize", settle, on);

  /* The editor: the toolbar works on the sheet. */
  const BLOCKS = ["P", "H2", "H3", "H4", "BLOCKQUOTE"];
  function block() {
    let c = selection().anchorNode;
    while (c && c !== pis && !(c.nodeType === 1 && BLOCKS.includes(c.nodeName))) c = c.parentNode;
    return c && c !== pis ? c.nodeName : "P";
  }
  const inSheet = () => pis.contains(selection().anchorNode);
  function toEnd() {
    pis.focus();
    const r = document.createRange();
    r.selectNodeContents(pis.lastElementChild!);
    r.collapse(false);
    const s = selection();
    s.removeAllRanges();
    s.addRange(r);
  }
  const STATES = ["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList"];
  function saved() {
    stateEl.textContent = t.saved;
    savedEl.classList.remove(styles.saving!, styles.redraw!);
    void savedEl.offsetWidth;
    savedEl.classList.add(styles.redraw!);
  }
  function notice(text: string) {
    stateEl.textContent = text;
    clearTimeout(saveTimer);
    saveTimer = after(saved, 1600);
  }
  function toolState() {
    if (!inSheet()) return;
    STATES.forEach((k) =>
      root.querySelector(`[data-k="${k}"]`)!.setAttribute("aria-pressed", String(document.queryCommandState(k))),
    );
    setType(block().toLowerCase());
  }
  document.addEventListener("selectionchange", toolState, on);
  all("[data-k]").forEach((b) => {
    b.addEventListener("mousedown", (e) => e.preventDefault(), on);
    b.addEventListener(
      "click",
      () => {
        stop();
        if (!inSheet()) toEnd();
        const k = b.dataset.k!;
        if (k === "umetni") {
          insert(t.essay.pasted);
          return;
        }
        if (k === "list") {
          const dark = pis.classList.toggle(styles.dark!);
          b.setAttribute("aria-pressed", String(dark));
          b.dataset.tip = dark ? t.tools.lightSheet : t.tools.darkSheet;
          b.setAttribute("aria-label", b.dataset.tip);
          return;
        }
        if (k === "kopiraj") {
          if (navigator.clipboard)
            navigator.clipboard.writeText(pis.innerText).then(
              () => notice(t.copied),
              () => notice(t.copyDenied),
            );
          return;
        }
        if (k === "fusnota") {
          const sup = document.createElement("sup");
          sup.className = "fn";
          sup.textContent = String(pis.querySelectorAll("sup.fn").length + 1);
          sup.title = fill(t.footnoteN, { n: sup.textContent });
          const sel = selection();
          const r = sel.getRangeAt(0);
          const behind = document.createTextNode("​");
          r.collapse(false);
          r.insertNode(behind);
          r.insertNode(sup);
          r.setStart(behind, 1);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
          change();
          return;
        }
        if (k === "navod") document.execCommand("formatBlock", false, block() === "BLOCKQUOTE" ? "<p>" : "<blockquote>");
        else document.execCommand(k);
        toolState();
        change();
      },
      on,
    );
  });

  /* Toolbar menus: block type and special characters; a click does not take the caret off the sheet. */
  function setType(v: string) {
    $("type-name").textContent = t.blockTypes[v as keyof typeof t.blockTypes] ?? t.blockTypes.p;
    all("[data-v]", $("menu-types")).forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v === v)));
  }
  let lastRange: Range | null = null;
  pis.addEventListener(
    "blur",
    () => {
      const s = selection();
      if (s.rangeCount && inSheet()) lastRange = s.getRangeAt(0).cloneRange();
    },
    on,
  );
  function restoreCaret() {
    if (inSheet() && document.activeElement === pis) return;
    if (!lastRange) {
      toEnd();
      return;
    }
    pis.focus();
    const s = selection();
    s.removeAllRanges();
    s.addRange(lastRange);
  }
  let open: { button: HTMLElement; menu: HTMLElement } | null = null;
  function close() {
    if (!open) return;
    open.menu.hidden = true;
    open.button.setAttribute("aria-expanded", "false");
    open = null;
  }
  function openMenu(button: HTMLElement) {
    if (open && open.button === button) {
      close();
      return;
    }
    close();
    hideTip();
    stop();
    if (!inSheet()) toEnd();
    const menu = $(`menu-${button.dataset.menu}`);
    const r = button.getBoundingClientRect();
    menu.hidden = false;
    const w = menu.offsetWidth;
    const x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
    menu.style.left = `${x}px`;
    menu.style.top = `${r.bottom + 8}px`;
    menu.style.setProperty("--izvor", `${r.left + r.width / 2 - x}px 0`);
    button.setAttribute("aria-expanded", "true");
    open = { button, menu };
  }
  all("[data-menu]").forEach((g) => {
    g.addEventListener("mousedown", (e) => e.preventDefault(), on);
    g.addEventListener("click", () => openMenu(g), on);
    g.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "ArrowDown") return;
        e.preventDefault();
        if (!open) openMenu(g);
        open?.menu.querySelector("button")?.focus();
      },
      on,
    );
  });
  [$("menu-types"), $("menu-specials")].forEach((m) => {
    m.addEventListener("mousedown", (e) => e.preventDefault(), on);
    m.addEventListener(
      "keydown",
      (e) => {
        const items = all<HTMLButtonElement>("button", m);
        const i = items.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === "Escape") {
          const g = open?.button;
          close();
          g?.focus();
        } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          items[(i + 1) % items.length]!.focus();
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          items[(i - 1 + items.length) % items.length]!.focus();
        }
      },
      on,
    );
  });
  $("menu-types").addEventListener(
    "click",
    (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-v]");
      if (!b) return;
      close();
      restoreCaret();
      document.execCommand("formatBlock", false, `<${b.dataset.v}>`);
      toolState();
      change();
    },
    on,
  );
  $("menu-specials").addEventListener(
    "click",
    (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-z]");
      if (!b) return;
      close();
      restoreCaret();
      document.execCommand("insertText", false, b.dataset.z);
      change();
    },
    on,
  );
  document.addEventListener(
    "pointerdown",
    (e) => {
      const target = e.target as Node;
      if (open && !open.menu.contains(target) && !open.button.contains(target)) close();
    },
    on,
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") close();
    },
    on,
  );
  window.addEventListener("resize", close, on);
  window.addEventListener(
    "scroll",
    (e) => {
      if (open && !open.menu.contains(e.target as Node)) close();
    },
    { capture: true, signal: ac.signal },
  );

  /* Tooltip: the tool's name and shortcut; after the first, neighbours show at once. */
  const tip = $("tip");
  let tipTimer = 0;
  let tipLast = 0;
  function showTip(g: HTMLElement) {
    if (open) return;
    tip.textContent = g.dataset.tip ?? "";
    if (g.dataset.kbd) {
      const k = document.createElement("kbd");
      k.textContent = g.dataset.kbd;
      tip.append(k);
    }
    const r = g.getBoundingClientRect();
    const w = tip.offsetWidth;
    tip.style.left = `${Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8)}px`;
    tip.style.top = `${r.bottom + 8}px`;
    tip.classList.add(styles.shown!);
  }
  function hideTip() {
    clearTimeout(tipTimer);
    if (tip.classList.contains(styles.shown!)) tipLast = Date.now();
    tip.classList.remove(styles.shown!);
  }
  all("[data-tip]").forEach((g) => {
    g.addEventListener(
      "pointerenter",
      (e) => {
        if (e.pointerType === "touch") return;
        clearTimeout(tipTimer);
        tipTimer = after(() => showTip(g), Date.now() - tipLast < 500 ? 0 : 450);
      },
      on,
    );
    g.addEventListener("pointerleave", hideTip, on);
    g.addEventListener(
      "focus",
      () => {
        if (g.matches(":focus-visible")) showTip(g);
      },
      on,
    );
    g.addEventListener("blur", hideTip, on);
    g.addEventListener("click", hideTip, on);
  });
  $("submit").addEventListener(
    "click",
    () => {
      stop();
      show("teacher");
    },
    on,
  );

  function insert(text: string) {
    const sel = selection();
    let r = sel.rangeCount && inSheet() ? sel.getRangeAt(0) : null;
    if (!r) {
      r = document.createRange();
      r.selectNodeContents(pis.lastElementChild!);
      r.collapse(false);
    }
    r.deleteContents();
    const sp = document.createElement("span");
    sp.className = "u";
    sp.textContent = text;
    const behind = document.createTextNode(" ");
    r.insertNode(behind);
    r.insertNode(sp);
    r.setStartAfter(behind);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    change();
  }
  pis.addEventListener(
    "paste",
    (e) => {
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain").trim();
      if (text) insert(text);
    },
    on,
  );
  pis.addEventListener("input", change, on);

  function figures() {
    const count = words();
    const r = num(count);
    $("goal").style.width = `${Math.min(100, (count / GOAL) * 100)}%`;
    $("words").textContent = r;
    $("ver").textContent = String(versions);
    $("t-words").textContent = r;
    $("t-ver").textContent = String(versions);
    if (stamp.dataset.s !== "radi") stamp.querySelector("small")!.textContent = fill(t.versionN, { n: versions });
  }
  function change() {
    stateEl.textContent = t.saving;
    savedEl.classList.add(styles.saving!);
    clearTimeout(saveTimer);
    saveTimer = after(() => {
      saved();
      if (Date.now() - lastVersion > 4000) {
        versions++;
        lastVersion = Date.now();
      }
      figures();
    }, 700);
    figures();
  }

  /* Teacher: the same text with numbered pastes, the facts on the right, the stamp as the state. */
  async function sha(text: string) {
    if (!window.crypto?.subtle) return "";
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  function mark(u: HTMLElement) {
    const desk = cit.closest<HTMLElement>(cls(styles.desk!))!;
    const y = u.getBoundingClientRect().top - desk.getBoundingClientRect().top + desk.scrollTop;
    desk.scrollTo({ top: Math.max(0, y - desk.clientHeight / 3), behavior: "smooth" });
    u.classList.add(styles.glow!);
    after(() => u.classList.remove(styles.glow!), 1600);
  }
  /* On opening the view the bars rise, the line is drawn and the figure counts up; reduced motion shows the end at once. */
  function again(el: HTMLElement, c: string) {
    el.classList.remove(c);
    void el.offsetWidth;
    el.classList.add(c);
  }
  function countUp(el: HTMLElement, target: number) {
    cancelAnimationFrame(frame);
    if (reduced()) {
      el.textContent = `${target} %`;
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / 900);
      el.textContent = `${Math.round(target * (1 - Math.pow(1 - u, 3)))} %`;
      if (u < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }
  async function teacher(animate = false) {
    halt();
    edited = false;
    tryEdit.textContent = t.tryEdit;
    cit.innerHTML = pis.innerHTML;
    const pastes = all(".u", cit).filter((u) => u.textContent!.length);
    pastes.forEach((u, i) => (u.dataset.i = String(i + 1)));
    const pastedChars = pastes.reduce((a, u) => a + u.textContent!.length, 0);
    const total = pis.textContent!.length;
    const typed = Math.max(0, total - pastedChars);
    const percent = total ? Math.round((typed / total) * 100) : 100;
    if (animate) countUp($("percent"), percent);
    else {
      cancelAnimationFrame(frame);
      $("percent").textContent = `${percent} %`;
    }
    $("typed").textContent = fill(t.chars, { n: num(typed) });
    $("pasted").textContent = fill(t.chars, { n: num(pastedChars) });
    $("versions").textContent = String(versions);
    $("insert-count").textContent = String(pastes.length);
    $("largest").textContent = pastes.length
      ? fill(t.chars, { n: num(Math.max(...pastes.map((u) => u.textContent!.length))) })
      : t.none;
    const widths = () => {
      $("ratio-typed").style.width = `${total ? (typed / total) * 100 : 100}%`;
      $("ratio-pasted").style.width = `${total ? (pastedChars / total) * 100 : 0}%`;
    };
    if (animate && !reduced()) {
      $("ratio-typed").style.width = "0%";
      $("ratio-pasted").style.width = "0%";
      void $("ratio-typed").offsetWidth;
      frame = requestAnimationFrame(() => (frame = requestAnimationFrame(widths)));
    } else widths();
    if (animate) {
      again($("sessions"), styles.rise!);
      again($("timeline"), styles.drawn!);
    }
    const list = $("inserts");
    list.textContent = "";
    if (!pastes.length) {
      const li = document.createElement("li");
      li.className = styles.none!;
      li.textContent = t.noInserts;
      list.append(li);
    }
    pastes.forEach((u, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.title = t.showInText;
      const nr = document.createElement("span");
      nr.className = styles.num!;
      nr.textContent = String(i + 1);
      const excerpt = document.createElement("span");
      excerpt.className = styles.excerpt!;
      excerpt.textContent = `„${u.textContent!.split(/\s+/).slice(0, 4).join(" ")}…”`;
      const chars = document.createElement("span");
      chars.className = styles.chars!;
      chars.textContent = fill(t.chars, { n: num(u.textContent!.length) });
      b.append(nr, excerpt, chars);
      b.addEventListener("click", () => {
        stop();
        mark(u);
      });
      /* the pointer links the item on the right and the paste on the sheet */
      b.addEventListener("mouseenter", () => u.classList.add(styles.glow!));
      b.addEventListener("mouseleave", () => u.classList.remove(styles.glow!));
      b.addEventListener("focus", () => u.classList.add(styles.glow!));
      b.addEventListener("blur", () => u.classList.remove(styles.glow!));
      u.title = fill(t.insertN, { n: i + 1 });
      u.addEventListener("mouseenter", () => b.classList.add(styles.hot!));
      u.addEventListener("mouseleave", () => b.classList.remove(styles.hot!));
      li.append(b);
      list.append(li);
    });
    submittedText = pis.textContent!;
    submittedBlocks = [...cit.children].map((b) => b.textContent!);
    split();
    recorded = await sha(submittedText);
    if (dead) return;
    void verify();
  }

  /* Path of the text: the sheet goes back through versions 1 to the last. The text is split into sentences and
     pastes; each piece gets a version by how much text comes before it (a synthetic spread over four days). */
  const when = (v: number) => t.times[versions <= 1 ? 8 : Math.round(((v - 1) * 8) / (versions - 1))]!;
  let pieces: HTMLElement[] = [];
  function split() {
    pieces = [];
    const parts: [HTMLElement, Element][] = [];
    [...cit.children].forEach((blk) => {
      [...blk.childNodes].forEach((c) => {
        if (c.nodeType === 3) {
          const data = (c as Text).data;
          const sentences = data.match(/[^,;:.!?…]+[,;:.!?…]*\s*|\s+/g) ?? [];
          if (sentences.length < 2) {
            if (data.trim()) {
              const s = document.createElement("span");
              s.className = styles.piece!;
              c.replaceWith(s);
              s.append(c);
              parts.push([s, blk]);
            }
            return;
          }
          const frag = document.createDocumentFragment();
          sentences.forEach((r) => {
            const s = document.createElement("span");
            s.className = styles.piece!;
            s.textContent = r;
            frag.append(s);
            parts.push([s, blk]);
          });
          c.replaceWith(frag);
        } else if (c instanceof HTMLElement) {
          c.classList.add(styles.piece!);
          parts.push([c, blk]);
        }
      });
    });
    const head = (b: Element) => b.matches(`h2, ${byline}`);
    /* each version gets at least one piece when there are enough, otherwise they are spread by length */
    const body = parts.filter(([k, b]) => !head(b) && k.textContent!.trim());
    const sum = body.reduce((a, [k]) => a + k.textContent!.length, 0) || 1;
    let before = 0;
    let j = 0;
    parts.forEach(([k, b]) => {
      let v = 1;
      if (!head(b)) {
        v =
          body.length >= versions
            ? 1 + Math.floor((j * versions) / body.length)
            : 1 + Math.floor((before / sum) * versions);
        v = Math.min(versions, v);
        if (k.textContent!.trim()) {
          j++;
          before += k.textContent!.length;
        }
      }
      k.dataset.v = String(v);
      pieces.push(k);
    });
    slider.max = String(versions);
    slider.value = String(versions);
    $("pt-count").textContent = `${versions} ${form(versions, t.versionWord)}`;
    const days = $("days");
    days.textContent = "";
    let lastDay = "";
    for (let v = 1; v <= versions; v++) {
      const d = when(v).split(" ")[0]!;
      if (d === lastDay) continue;
      lastDay = d;
      const x = String(versions > 1 ? (v - 1) / (versions - 1) : 1);
      const tick = document.createElement("i");
      tick.style.setProperty("--x", x);
      const s = document.createElement("small");
      s.textContent = d;
      s.style.setProperty("--x", x);
      if (v === 1) s.className = styles.firstDay!;
      else if (d === t.today) s.className = styles.lastDay!;
      days.append(tick, s);
    }
    showVersion(versions);
  }
  function showVersion(v: number) {
    slider.value = String(v);
    slider.style.setProperty("--p", `${versions > 1 ? ((v - 1) / (versions - 1)) * 100 : 100}%`);
    slider.setAttribute("aria-valuetext", fill(t.sliderValue, { n: v, when: when(v) }));
    const early = v < versions;
    let fresh = 0;
    pieces.forEach((k) => {
      const kv = Number(k.dataset.v);
      k.classList.toggle(styles.gone!, kv > v);
      const is = early && kv === v;
      k.classList.toggle(styles.fresh!, is);
      if (is) fresh += (k.textContent!.trim().match(/\S+/g) ?? []).length;
    });
    const own = `:scope > ${cls(styles.piece!)}`;
    [...cit.children].forEach((b) => {
      const k = [...b.querySelectorAll(own)];
      b.classList.toggle(styles.gone!, early && (!k.length || k.every((x) => x.classList.contains(styles.gone!))));
    });
    $("pt-ver").textContent = fill(t.versionN, { n: v });
    $("pt-when").textContent = when(v);
    const hint = $("pt-hint");
    if (!early) hint.textContent = t.pathHint;
    else if (!fresh) hint.textContent = fill(t.onlyEdits, { n: v });
    else {
      hint.textContent = "";
      const i = document.createElement("i");
      i.setAttribute("aria-hidden", "true");
      hint.append(i, fill(t.newIn, { n: v, count: fresh, words: form(fresh, t.wordWord) }));
    }
    if (early) {
      const first = cit.querySelector(`${cls(styles.piece!)}${cls(styles.fresh!)}`);
      if (first) {
        const desk = cit.closest<HTMLElement>(cls(styles.desk!))!;
        const r = first.getBoundingClientRect();
        const s = desk.getBoundingClientRect();
        if (r.top < s.top + 24 || r.bottom > s.bottom - 24)
          desk.scrollTo({
            top: Math.max(0, desk.scrollTop + r.top - s.top - desk.clientHeight / 3),
            behavior: reduced() ? "auto" : "smooth",
          });
      }
    }
  }
  let playing = 0;
  function halt() {
    clearTimeout(playing);
    playing = 0;
    playBtn.setAttribute("aria-pressed", "false");
  }
  function play() {
    if (playing) {
      halt();
      return;
    }
    if (edited) void teacher();
    playBtn.setAttribute("aria-pressed", "true");
    let v = 1;
    const step = () => {
      showVersion(v);
      if (v < versions) {
        v++;
        playing = after(step, reduced() ? 1100 : 750);
      } else halt();
    };
    step();
  }
  playBtn.addEventListener(
    "click",
    () => {
      stop();
      play();
    },
    on,
  );
  slider.addEventListener(
    "input",
    () => {
      stop();
      halt();
      showVersion(Number(slider.value));
    },
    on,
  );
  /* a session bar goes to the last version of that day */
  all("[data-day]", $("sessions")).forEach((d) => {
    const go = () => {
      stop();
      halt();
      if (edited) return;
      let z = 0;
      for (let v = 1; v <= versions; v++) if (when(v).startsWith(d.dataset.day!)) z = v;
      if (z) showVersion(z);
    };
    d.addEventListener("click", go, on);
    d.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      },
      on,
    );
  });

  /* Is the text shown the submitted one: SHA-256 underneath, one sentence and the place of the difference for people. */
  let diffBlock: Element | null = null;
  function difference() {
    const now = [...cit.children].map((b) => b.textContent!);
    let chars = 0;
    let first = -1;
    now.forEach((s, i) => {
      const a = submittedBlocks[i] ?? "";
      if (s === a) return;
      let p = 0;
      while (p < s.length && p < a.length && s[p] === a[p]) p++;
      let k = 0;
      while (k < s.length - p && k < a.length - p && s[s.length - 1 - k] === a[a.length - 1 - k]) k++;
      chars += Math.max(s.length - p - k, a.length - p - k);
      if (first < 0) first = i;
    });
    if (first < 0) return null;
    const b = cit.children[first]!;
    let where = t.where.text;
    if (b.matches("h2")) where = t.where.title;
    else if (b.matches("h3, h4")) where = t.where.chapter;
    else if (b.matches("blockquote")) where = t.where.quote;
    else if (b.matches(`p:not(${byline})`))
      where = fill(t.where.paragraph, { n: all(`:scope > p:not(${byline})`, cit).indexOf(b as HTMLElement) + 1 });
    return {
      block: b,
      text: fill(t.diffDetail, {
        changed: form(chars, t.changed),
        n: chars,
        chars: form(chars, t.charWord),
        where,
      }),
    };
  }
  async function verify() {
    const id = ++checkId;
    stamp.dataset.s = "radi";
    stamp.querySelector("b")!.textContent = t.checking;
    stamp.querySelector("small")!.textContent = "";
    verifyEl.dataset.s = "radi";
    $("verify-text").textContent = t.comparing;
    showPlace.hidden = true;
    const text = cit.textContent!;
    const h = await sha(text);
    await wait(reduced() ? 0 : 500);
    if (dead || id !== checkId) return;
    const ok = h && recorded ? h === recorded : text === submittedText;
    stamp.dataset.s = verifyEl.dataset.s = ok ? "ok" : "ne";
    stamp.querySelector("b")!.textContent = ok ? t.same : t.differs;
    stamp.querySelector("small")!.textContent = fill(t.versionN, { n: versions });
    stamp.title = t.recheck;
    verifyEl.title = fill(t.hashTitle, {
      n: versions,
      submitted: recorded || t.unavailable,
      shown: h || t.unavailable,
    });
    const r = ok ? null : difference();
    $("verify-text").textContent = ok
      ? fill(t.exact, { n: versions })
      : fill(t.differsFrom, { n: versions, detail: r ? `: ${r.text}` : "" });
    showPlace.hidden = ok || !r;
    diffBlock = r?.block ?? null;
  }
  stamp.addEventListener(
    "click",
    () => {
      stop();
      void verify();
    },
    on,
  );
  showPlace.addEventListener(
    "click",
    () => {
      stop();
      const m = cit.querySelector<HTMLElement>(cls(styles.changed!)) ?? (diffBlock as HTMLElement | null);
      if (m) mark(m);
    },
    on,
  );

  /* The experiment: one changed letter; the sentence turns red and says where, restoring brings back the submitted text. */
  function changeLetter() {
    halt();
    showVersion(versions);
    const w = document.createTreeWalker(cit, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) {
      if (n.parentElement!.closest(`h2, h3, h4, .u, ${byline}`)) continue;
      const i = n.data.indexOf("a", 8);
      if (i < 0) continue;
      n.splitText(i).deleteData(0, 1);
      const s = document.createElement("span");
      s.className = styles.changed!;
      s.title = t.changedLetter;
      s.textContent = "e";
      n.after(s);
      break;
    }
    edited = true;
    tryEdit.textContent = t.restore;
    void verify();
  }
  tryEdit.addEventListener(
    "click",
    () => {
      stop();
      if (edited) void teacher();
      else changeLetter();
    },
    on,
  );

  /* The session in hours and minutes, from 00:42. */
  const clock = () => {
    const m = 42 + Math.floor((Date.now() - began) / 60000);
    $("clock").textContent = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  };
  const clockTimer = window.setInterval(clock, 15000);
  clock();
  figures();

  /* Autoplay: until the visitor touches the preview it writes, pastes a passage, submits, shows the path of the
     text and the check (same, differs, same). */
  const desk = pis.closest<HTMLElement>(cls(styles.desk!))!;
  function follow(el: Element) {
    const r = el.getBoundingClientRect();
    const s = desk.getBoundingClientRect();
    const over = r.bottom - (s.bottom - 48);
    if (over > 0) desk.scrollTop += over;
  }
  const initial = pis.innerHTML;
  const autoTimers: number[] = [];
  const later = (f: () => void, ms: number) => autoTimers.push(after(f, ms));
  function stop() {
    if (touched) return;
    touched = true;
    autoTimers.forEach(clearTimeout);
  }
  root.addEventListener("pointerdown", stop, on);
  root.addEventListener("keydown", stop, on);
  function type(text: string, done: () => void) {
    const p = pis.lastElementChild!;
    let i = 0;
    const step = () => {
      if (touched) return;
      p.append(text[i++]!);
      change();
      follow(p);
      if (i < text.length) later(step, 34 + Math.random() * 62);
      else done();
    };
    step();
  }
  function round() {
    if (touched) return;
    pis.innerHTML = initial;
    desk.scrollTop = 0;
    show("student");
    figures();
    later(
      () =>
        type(t.essay.typed, () =>
          later(() => {
            const sp = document.createElement("span");
            sp.className = "u";
            sp.textContent = t.essay.pasted;
            pis.lastElementChild!.append(sp, " ");
            change();
            later(
              () =>
                type(t.essay.sentence, () =>
                  later(() => {
                    pis.append(document.createElement("h3"));
                    type(t.essay.nextChapter, () =>
                      later(() => {
                        pis.append(document.createElement("p"));
                        type(t.essay.next, () =>
                          later(() => {
                            show("teacher");
                            const played = 1800 + versions * 750;
                            later(play, 1800);
                            later(changeLetter, played + 1600);
                            later(() => void teacher(), played + 4800);
                            later(round, played + 8200);
                          }, 1400),
                        );
                      }, 600),
                    );
                  }, 900),
                ),
              900,
            );
          }, 700),
        ),
      1200,
    );
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      if (!reduced()) round();
    },
    { threshold: 0.2 },
  );
  io.observe(root);

  return () => {
    dead = true;
    ac.abort();
    io.disconnect();
    timeouts.forEach(clearTimeout);
    clearInterval(clockTimer);
    cancelAnimationFrame(frame);
  };
}
