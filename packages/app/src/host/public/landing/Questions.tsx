"use client";

import { useEffect, useRef } from "react";
import { annotate, annotationGroup } from "rough-notation";

import { DEFAULT_INTERFACE_LOCALE, messagesFor, type InterfaceLocale } from "../../../../../../src/lib/i18n/locale";

import l from "./Landing.module.css";
import s from "./Questions.module.css";

/* The five questions of the sheet, in the concept's order. */
const ORDER = ["authorship", "beforeWriting", "ai", "signIn", "offline"] as const;

/**
 * "Pitanja" of koncepti/naslovnica (DAN-1520): short answers on one sheet. A
 * gold bracket is drawn by each answer in turn when the sheet enters the view
 * and wiped when it leaves; with reduced motion they are there at once.
 */
export function Questions({ locale = DEFAULT_INTERFACE_LOCALE }: { locale?: InterfaceLocale }) {
  const sheet = useRef<HTMLElement>(null);
  const m = messagesFor(locale).landing;
  const t = m.questions;

  useEffect(() => (sheet.current ? start(sheet.current) : undefined), []);

  return (
    <section className={`${l.section} ${s.questions}`} id="pitanja" aria-labelledby="h-pit">
      <div className={l.head}>
        <div className={l.eyebrow}>{t.eyebrow}</div>
        <h2 id="h-pit">
          {t.titleStart}
          <br />
          {t.titleEnd}
        </h2>
        <p>{t.intro}</p>
      </div>
      <article className={s.sheet} aria-labelledby="h-pit-l" ref={sheet}>
        <header>
          <h3 id="h-pit-l">{t.listTitle}</h3>
          <p className={s.audience}>{t.audience}</p>
        </header>
        <dl>
          {ORDER.map((k) => (
            <div key={k} className={s.item}>
              <dt>{m.faq.items[k].q}</dt>
              <dd>{m.faq.items[k].a}</dd>
            </div>
          ))}
        </dl>
      </article>
    </section>
  );
}

// as in the concept, the brackets are measured once the page has loaded
function start(sheet: HTMLElement): () => void {
  const sm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let io: IntersectionObserver | null = null;
  let notes: ReturnType<typeof annotate>[] = [];
  const run = () => {
    const color = getComputedStyle(sheet).getPropertyValue("--p-zlato").trim();
    notes = [...sheet.querySelectorAll("dd")].map((dd) =>
      annotate(dd, { type: "bracket", brackets: ["left"], color, strokeWidth: 1.6, padding: [2, 14], animate: !sm, animationDuration: 420 }),
    );
    const group = annotationGroup(notes);
    if (sm || !("IntersectionObserver" in window)) {
      group.show();
      return;
    }
    let shown = false;
    io = new IntersectionObserver(
      (es) => {
        const e = es[es.length - 1]!;
        if (e.intersectionRatio >= 0.35 && !shown) {
          shown = true;
          group.show();
        } else if (!e.isIntersecting && shown) {
          shown = false;
          notes.forEach((x) => x.hide());
        }
      },
      { threshold: [0, 0.35] },
    );
    io.observe(sheet);
  };
  if (document.readyState === "complete") run();
  else addEventListener("load", run);
  return () => {
    removeEventListener("load", run);
    io?.disconnect();
    notes.forEach((x) => x.remove());
  };
}
