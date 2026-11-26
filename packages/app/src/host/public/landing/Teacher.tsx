"use client";

import { useEffect, useRef } from "react";

import { DEFAULT_INTERFACE_LOCALE, messagesFor, type InterfaceLocale } from "../../../../../../src/lib/i18n/locale";

import { CommentIcon, ConversationIcon, OriginMapIcon, ProcessSummaryIcon } from "./icons";
import l from "./Landing.module.css";
import s from "./Teacher.module.css";

const ORDER = ["map", "summary", "comment", "conversation"] as const;
type Tool = (typeof ORDER)[number];
const ICONS = { map: OriginMapIcon, summary: ProcessSummaryIcon, comment: CommentIcon, conversation: ConversationIcon };
const TAKT = 4600;

/**
 * "Za nastavnike" of koncepti/naslovnica (DAN-1520): four tools around one
 * submitted work and the student's access log. Without JS the origin map is
 * chosen and every note is shown.
 */
export function Teacher({ locale = DEFAULT_INTERFACE_LOCALE }: { locale?: InterfaceLocale }) {
  const root = useRef<HTMLElement>(null);
  const t = messagesFor(locale).landing.teacher;

  useEffect(() => (root.current ? start(root.current) : undefined), []);

  const seen = (text: string) => (
    <div className={s.seen}>
      <span>{t.studentSees}</span>
      {text}
    </div>
  );
  const heading = (k: Tool, title: string) => {
    const Icon = ICONS[k];
    return (
      <h4>
        <Icon />
        {title}
      </h4>
    );
  };

  return (
    <section className={`${l.section} ${s.teacher}`} id="nastavnik" aria-labelledby="h-nas" ref={root}>
      <div className={l.head}>
        <div className={l.eyebrow}>{t.eyebrow}</div>
        <h2 id="h-nas">
          {t.titleStart}
          <br />
          {t.titleEnd}
        </h2>
        <p>
          {t.introStart}
          <b>{t.introBold}</b>
        </p>
      </div>
      <div className={s.table} data-tool="map" data-x="table">
        {ORDER.map((k) => {
          const Icon = ICONS[k];
          return (
            <button
              key={k}
              type="button"
              className={s.tool}
              data-tool={k}
              aria-pressed={k === "map"}
              aria-controls="n-rad"
            >
              <Icon />
              <b>{t.tools[k].name}</b>
              <small>{t.tools[k].hint}</small>
            </button>
          );
        })}
        <article className={s.work} id="n-rad" aria-labelledby="h-nas-r" aria-live="polite">
          <span className={s.role}>{t.sheetRole}</span>
          <h3 id="h-nas-r">{t.workTitle}</h3>
          <p className={s.sub}>{t.workSub}</p>
          <div className={s.text}>
            <p>
              <span className={s.commented}>{t.commented}</span> <span className={s.pasted}>{t.pasted}</span>{" "}
              {t.firstEnd}
            </p>
            <p className={s.second}>
              {t.secondStart} <span className={s.imported}>{t.imported}</span>{" "}
              <span className={s.assistant}>{t.assistant}</span>
            </p>
          </div>
          <div className={s.margin}>
            <section className={s.note} data-for="map">
              {heading("map", t.map.title)}
              <ul className={s.legend}>
                <li>
                  <i />
                  {t.map.legend[0]}
                </li>
                <li>
                  <i className={s.lineAssistant} />
                  {t.map.legend[1]}
                </li>
                <li>
                  <i className={s.lineImported} />
                  {t.map.legend[2]}
                </li>
              </ul>
              <p>{t.map.note}</p>
            </section>
            <section className={s.note} data-for="summary">
              {heading("summary", t.summary.title)}
              <dl className={s.figures}>
                {t.summary.figures.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
              <p>{t.summary.note}</p>
              {seen(t.summary.seen)}
            </section>
            <section className={s.note} data-for="comment">
              {heading("comment", t.comment.title)}
              <div className={s.comment}>
                <small>{t.comment.on}</small>
                <span>{t.comment.body}</span>
              </div>
              <p>{t.comment.note}</p>
              {seen(t.comment.seen)}
            </section>
            <section className={s.note} data-for="conversation">
              {heading("conversation", t.conversation.title)}
              <ol className={s.steps}>
                {t.conversation.steps.map((step, i) => (
                  <li key={step} className={i === 2 ? s.here : undefined}>
                    {step}
                  </li>
                ))}
              </ol>
              <p>{t.conversation.note}</p>
              {seen(t.conversation.seen)}
            </section>
          </div>
        </article>
        <div className={s.log}>
          <span className={s.role}>{t.log.title}</span>
          <ol>
            {t.log.entries.map((e, i) => (
              <li key={e.when} data-log={i + 1}>
                <b>{e.what}</b>
                <time>{e.when}</time>
                <span>{e.who}</span>
              </li>
            ))}
          </ol>
          <small>{t.log.note}</small>
        </div>
      </div>
      <small className={s.example}>{t.example}</small>
    </section>
  );
}

/*
 * Once the table is a third in view the tools take turns (map, summary,
 * comment, conversation) and repeat. A click or the keyboard takes a tool and
 * stops the turns. Opening the text and the summary is entered in the student's
 * log. Leaving the view resets everything. With reduced motion the map stays.
 */
function start(root: HTMLElement): () => void {
  const table = root.querySelector<HTMLElement>("[data-x=table]")!;
  const tools = [...table.querySelectorAll<HTMLButtonElement>("button[data-tool]")];
  const log = (n: number) => table.querySelector(`[data-log="${n}"]`)!;
  let timer = 0;
  let k = 0;

  const take = (a: Tool, runs: boolean) => {
    table.dataset.tool = a;
    tools.forEach((b) => {
      const on = b.dataset.tool === a;
      b.setAttribute("aria-pressed", String(on));
      b.classList.remove(s.runs!);
      if (on && runs) {
        void b.offsetWidth;
        b.classList.add(s.runs!);
      }
    });
    if (a === "summary") log(2).classList.add(s.in!);
  };
  const next = () => {
    take(ORDER[k]!, true);
    k = (k + 1) % ORDER.length;
    timer = window.setTimeout(next, TAKT);
  };
  const stop = () => {
    clearTimeout(timer);
    tools.forEach((b) => b.classList.remove(s.runs!));
  };
  const clear = () => {
    table.dataset.tool = "";
    tools.forEach((b) => b.setAttribute("aria-pressed", "false"));
  };
  const onClick = (e: MouseEvent) => {
    stop();
    take((e.currentTarget as HTMLElement).dataset.tool as Tool, false);
  };
  tools.forEach((b) => b.addEventListener("click", onClick));

  root.dataset.js = "";
  let io: IntersectionObserver | undefined;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    take("map", false);
    log(1).classList.add(s.in!);
  } else {
    clear();
    let inView = false;
    io = new IntersectionObserver(
      (entries) => {
        // A jump into view can arrive as two entries at once; the last is current.
        const e = entries[entries.length - 1]!;
        if (e.intersectionRatio >= 0.3 && !inView) {
          inView = true;
          k = 0;
          log(1).classList.add(s.in!);
          timer = window.setTimeout(next, 500);
        } else if (!e.isIntersecting && inView) {
          inView = false;
          stop();
          clear();
          log(1).classList.remove(s.in!);
          log(2).classList.remove(s.in!);
        }
      },
      { threshold: [0, 0.1, 0.2, 0.3, 0.5, 0.75, 1] },
    );
    io.observe(table);
  }

  return () => {
    stop();
    io?.disconnect();
    tools.forEach((b) => b.removeEventListener("click", onClick));
    delete root.dataset.js;
    table.dataset.tool = "map";
    tools.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === "map")));
    log(1).classList.remove(s.in!);
    log(2).classList.remove(s.in!);
  };
}
