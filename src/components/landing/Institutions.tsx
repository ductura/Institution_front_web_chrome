"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { getStroke } from "perfect-freehand";
import rough from "roughjs";

import { DEFAULT_INTERFACE_LOCALE, messagesFor, type InterfaceLocale } from "../../lib/i18n/locale";

import h from "./Hero.module.css";
import { GRAPHITE } from "./How";
import s from "./Institutions.module.css";
import { INSTITUTIONS_STILL } from "./institutionsStill";
import l from "./Landing.module.css";

type PlanText = ReturnType<typeof messagesFor>["landing"]["institutions"]["plan"];
type Key = keyof PlanText | "code";
type Pt = [number, number];
type Rough = ReturnType<typeof rough.svg>;
type RoughOptions = NonNullable<Parameters<Rough["line"]>[4]>;

/* The made-up assignment code, the same on the plan and on the tag. */
const CODE = "K7M-4QD";

/* The concept's class names in the static drawings, mapped to this module. */
const CLS: Record<string, string | undefined> = {
  "u-nasa": s.ours,
  "u-pod": s.floor,
  "u-vrata": s.door,
  "u-natpisi": s.labels,
  "u-luk": s.arc,
  "u-krilo": s.leaf,
  "u-sarka": s.hinge,
  "u-trag": s.trail,
  star: s.old,
  "u-student": s.student,
  "u-noga": s.foot,
  "u-ramena": s.shoulders,
  "u-glava": s.crown,
  "u-zl": s.gold,
  "u-blijed": s.faint,
  "u-jak": s.strong,
  "u-metal": s.metal,
  "u-uz": s.cord,
  "u-rupa": s.hole,
};
const still = (inner: string, plan?: PlanText) =>
  inner
    .replace(/class="([^"]+)"/g, (_, c: string) => `class="${c.split(" ").map((k) => CLS[k] ?? k).join(" ")}"`)
    .replace(/\{(\w+)\}/g, (_, k: string) => (k === "graphite" ? GRAPHITE : k === "code" ? CODE : plan![k as keyof PlanText]));
const svgOf = (k: keyof typeof INSTITUTIONS_STILL, plan?: PlanText) => ({
  viewBox: INSTITUTIONS_STILL[k].viewBox,
  dangerouslySetInnerHTML: { __html: still(INSTITUTIONS_STILL[k].inner, plan) },
});

/**
 * "Za ustanove" of koncepti/naslovnica (DAN-1520): a hand-drawn floor plan in
 * which a student walks in with the assignment code, the roles beside it, and a
 * tag with the code hanging on a string from the entrance. Without JS the
 * finished plan and the tag are shown.
 */
export function Institutions({ locale = DEFAULT_INTERFACE_LOCALE }: { locale?: InterfaceLocale }) {
  const root = useRef<HTMLElement>(null);
  const t = messagesFor(locale).landing.institutions;

  useEffect(() => (root.current ? start(root.current, t.plan) : undefined), [t.plan]);

  return (
    <section className={`${l.section} ${s.institutions}`} id="ustanove" aria-labelledby="h-ust" ref={root}>
      <div className={l.head}>
        <div className={l.eyebrow}>{t.eyebrow}</div>
        <h2 id="h-ust">
          {t.titleStart}
          <br />
          {t.titleEnd}
        </h2>
        <p>{t.intro}</p>
      </div>
      <div className={s.frame} data-x="frame">
        <div className={s.left} data-x="left">
          <div className={s.scene}>
            <div className={s.plan} role="img" aria-label={t.planLabel} data-x="plan">
              <svg className={s.live} aria-hidden="true" />
              {(["wide", "narrow"] as const).map((k) => (
                <svg
                  key={k}
                  className={`${s.still} ${s[k]}`}
                  aria-hidden="true"
                  style={{ "--u-fs": INSTITUTIONS_STILL[k].fs } as CSSProperties}
                  {...svgOf(k, t.plan)}
                />
              ))}
            </div>
            <div className={s.text}>
              <ol className={s.roles} aria-label={t.rolesLabel}>
                {t.roles.map((r, i) => (
                  <li key={r.tag} data-n={i + 1}>
                    <span className={`${l.eyebrow} ${s.tag}`}>{r.tag}</span>
                    <p className={s.claim}>{r.claim}</p>
                    <p>{r.more}</p>
                  </li>
                ))}
              </ol>
              <button type="button" className={s.replay} data-x="replay">
                {t.replay}
              </button>
            </div>
          </div>
          <div className={s.entry} data-x="entry">
            <div className={s.stage}>
              <svg className={s.ring} aria-hidden="true" {...svgOf("ring")} data-x="ring" />
              <div className={s.pendulum} data-x="pendulum">
                <svg className={s.ribbon} aria-hidden="true" {...svgOf("ribbon")} />
                <div className={s.card} data-x="card">
                  <div className={s.face} role="group" aria-label={t.front}>
                    <svg className={s.shape} aria-hidden="true" {...svgOf("front")} />
                    <div className={s.top}>
                      <span className={s.small}>{t.entry}</span>
                      <strong className={s.course} data-x="course">
                        {t.courseName}
                      </strong>
                      <span className={s.task}>{t.task}</span>
                    </div>
                    <div className={s.bottom}>
                      <div>
                        <span className={s.small}>{t.codeLabel}</span>
                        <div className={s.code} data-x="code">
                          {CODE}
                        </div>
                      </div>
                      <span className={s.sample}>{t.sample}</span>
                    </div>
                  </div>
                  <div className={`${s.face} ${s.reverse}`} role="group" aria-label={t.back}>
                    <svg className={s.shape} aria-hidden="true" {...svgOf("back")} />
                    <div className={s.top}>
                      <span className={s.small}>{t.howTitle}</span>
                      <ol className={s.steps}>
                        {t.steps.map((x) => (
                          <li key={x.bold}>
                            <span>
                              <b>{x.bold}</b>
                              {x.rest}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <span className={s.fine}>{t.fine}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className={s.notes} data-x="notes">
              {t.notes.map((n) => (
                <div key={n.tag} className={s.note}>
                  <span className={`${l.eyebrow} ${s.tag}`}>{n.tag}</span>
                  <p>{n.body}</p>
                </div>
              ))}
              <div>
                <div className={`${s.note} ${s.onboarding}`}>
                  <span className={`${l.eyebrow} ${s.tag}`}>{t.onboarding.tag}</span>
                  <p>{t.onboarding.body}</p>
                </div>
                <div className={s.actions}>
                  <a className={`${h.button} ${h.primary}`} href="#">
                    {t.contact}
                  </a>
                  <button type="button" className={`${s.link} ${s.flip}`} aria-pressed="false" data-x="flip">
                    {t.flip}
                  </button>
                </div>
                <small>{t.small}</small>
              </div>
            </div>
            <svg className={s.ties} aria-hidden="true" data-x="ties" />
          </div>
          <svg className={s.string} aria-hidden="true" data-x="string" />
        </div>
      </div>
    </section>
  );
}

/* ---------- drawing helpers, as in the concept ---------- */
const NS = "http://www.w3.org/2000/svg";
const el = (n: string, a: Record<string, string | number> = {}, parent?: Element) => {
  const e = document.createElementNS(NS, n);
  for (const k in a) e.setAttribute(k, String(a[k]));
  if (parent) parent.appendChild(e);
  return e;
};
const k01 = (v: number) => Math.min(1, Math.max(0, v));
const seeded = (n: number) => () => (n = (n * 16807) % 2147483647) / 2147483647;
const outline = (p: number[][]) => {
  if (p.length < 4) return "";
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(p[0]![0]!)} ${f(p[0]![1]!)} Q`;
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i] as Pt;
    const [x1, y1] = p[(i + 1) % p.length] as Pt;
    d += `${f(x0)} ${f(y0)} ${f((x0 + x1) / 2)} ${f((y0 + y1) / 2)} `;
  }
  return d + "Z";
};
type StrokeOptions = NonNullable<Parameters<typeof getStroke>[1]>;
const opts = (size: number, last: boolean): StrokeOptions => ({
  size,
  thinning: 0.55,
  smoothing: 0.55,
  streamline: 0.35,
  simulatePressure: true,
  last,
  start: { taper: size * 4, cap: true },
  end: { taper: last ? size * 5 : 0, cap: true },
});
const qb = (a: Pt, c: Pt, b: Pt, n = 14): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
  });
const tremble = (pts: Pt[], a: number, rnd: () => number): Pt[] =>
  pts.map(([x, y], i) => (i === 0 || i === pts.length - 1 ? [x, y] : [x + (rnd() - 0.5) * a, y + (rnd() - 0.5) * a]));
// a stroke drawn up to t of its points
const strokeTo = (path: Element, pts: Pt[], size: number, t: number, extra: StrokeOptions = {}) => {
  const c = Math.round(k01(t) * pts.length);
  path.setAttribute("d", c > 1 ? outline(getStroke(pts.slice(0, c), { ...opts(size, t >= 1), ...extra })) : "");
};
type Line = { p: SVGPathElement; L: number };
const roughLines = (g: Element): Line[] =>
  [...g.querySelectorAll("path")]
    .filter((p) => {
      const c = p.getAttribute("stroke");
      return c && c !== "none";
    })
    .map((p) => ({ p, L: Math.max(1, p.getTotalLength()) }));
const drawRough = (lines: Line[], t: number) => {
  const n = lines.length;
  lines.forEach(({ p, L }, i) => {
    const r = n < 2 ? t : k01((t - (i / n) * 0.72) / 0.28);
    if (r >= 1) {
      p.style.strokeDasharray = "";
      p.style.strokeDashoffset = "";
    } else {
      p.style.strokeDasharray = `${L} ${L}`;
      p.style.strokeDashoffset = String(L * (1 - r));
    }
  });
};
const pieces = (a: number, b: number, gaps: number[][] = []) => {
  const o: [number, number][] = [];
  let p = a;
  gaps.forEach(([x, y]) => {
    o.push([p, x!]);
    p = y!;
  });
  o.push([p, b]);
  return o;
};

/*
 * The floor plan: wide (720 × 476) and narrow (360 × 644); the entrance is in
 * the corridor's bottom wall, so the tag hangs from it. path: [x, y, the role
 * that starts there, the door the student opens there]; code: where the code is
 * typed by the course's door.
 */
type Wall = [number, number, number, number, number[][]?];
type Door = { h: Pt; l: Pt; e: Pt; s: number };
type Mark = { el?: [number, number, number, number]; pr?: number[][]; ob?: [number, number, number, number]; zid?: number[][] };
type Plan = {
  vb: [number, number];
  ty: number;
  walls: Wall[];
  partitions: [number, number, number, number][];
  doors: Door[];
  ours: [number, number, number, number];
  desks: [number, number, number, number, Key[]][];
  text: [number, number, Key, string, string?][];
  span: { x1: number; x2: number; y: number; wall: number };
  entrance: Pt;
  code: Pt;
  marks: Record<number, Mark>;
  path: [number, number, number?, number?][];
};
const PLAN: Record<"wide" | "narrow", Plan> = {
  wide: {
    vb: [720, 476],
    ty: 18,
    walls: [
      [30, 30, 690, 30],
      [30, 30, 30, 440],
      [690, 30, 690, 440],
      [30, 440, 690, 440, [[200, 260]]],
      [30, 330, 690, 330, [[140, 185], [400, 445], [580, 625]]],
    ],
    partitions: [
      [330, 30, 330, 330],
      [510, 30, 510, 330],
    ],
    doors: [
      { h: [140, 330], l: [140, 285], e: [185, 330], s: 1 },
      { h: [400, 330], l: [400, 285], e: [445, 330], s: 1 },
      { h: [580, 330], l: [580, 285], e: [625, 330], s: 1 },
      { h: [200, 440], l: [200, 380], e: [260, 440], s: 1 },
    ],
    ours: [36, 36, 288, 288],
    desks: [
      [56, 96, 112, 60, ["courseStart", "courseEnd", "code"]],
      [192, 96, 112, 60, ["course"]],
      [56, 182, 112, 60, ["course"]],
      [192, 182, 112, 60, ["course"]],
    ],
    text: [
      [52, 72, "yours", s.strong!],
      [420, 176, "second", s.strong!, "middle"],
      [420, 192, "institution", s.strong!, "middle"],
      [600, 176, "third", s.strong!, "middle"],
      [600, 192, "institution", s.strong!, "middle"],
    ],
    span: { x1: 30, x2: 330, y: 4, wall: 30 },
    entrance: [230, 440],
    code: [196, 357],
    marks: {
      1: { el: [230, 418, 120, 72], pr: [[38, 338, 644, 94]] },
      2: { el: [112, 126, 150, 86] },
      3: {
        ob: [36, 36, 288, 288],
        zid: [
          [324, 36, 12, 288],
          [504, 36, 12, 288],
        ],
      },
    },
    path: [[230, 478], [230, 458, 1, 3], [230, 385], [162, 385], [162, 348, 2, 0], [162, 290], [180, 270], [180, 169], [140, 169, 3]],
  },
  narrow: {
    vb: [360, 644],
    ty: 0,
    walls: [
      [20, 40, 340, 40],
      [20, 40, 20, 630],
      [340, 40, 340, 630],
      [20, 630, 340, 630, [[265, 325]]],
      [250, 40, 250, 630, [[248, 293], [400, 440], [530, 570]]],
    ],
    partitions: [
      [20, 310, 250, 310],
      [20, 470, 250, 470],
    ],
    doors: [
      { h: [250, 248], l: [205, 248], e: [250, 293], s: 0 },
      { h: [250, 400], l: [210, 400], e: [250, 440], s: 0 },
      { h: [250, 530], l: [210, 530], e: [250, 570], s: 0 },
      { h: [265, 630], l: [265, 572], e: [325, 630], s: 1 },
    ],
    ours: [26, 46, 218, 258],
    desks: [
      [34, 84, 98, 58, ["courseStart", "courseEnd", "code"]],
      [140, 84, 98, 58, ["course"]],
      [34, 158, 98, 58, ["course"]],
      [140, 158, 98, 58, ["course"]],
    ],
    text: [
      [34, 70, "yours", s.strong!],
      [135, 394, "secondFull", s.strong!, "middle"],
      [135, 554, "thirdFull", s.strong!, "middle"],
    ],
    span: { x1: 20, x2: 250, y: 24, wall: 40 },
    entrance: [295, 630],
    code: [262, 236],
    marks: {
      1: { el: [295, 598, 92, 96], pr: [[258, 48, 74, 574]] },
      2: { el: [83, 113, 128, 80] },
      3: {
        ob: [26, 46, 218, 258],
        zid: [
          [26, 304, 218, 12],
          [26, 464, 218, 12],
        ],
      },
    },
    path: [[295, 676], [295, 650, 1, 3], [295, 270], [268, 270, 2, 0], [215, 270], [136, 248], [136, 150], [92, 150, 3]],
  },
};
const STEP = 10;
const SPEED = 0.1; // drawing units per millisecond

/*
 * In order: the plan is drawn when it enters the view, then the student walks
 * in; the tag drops on its string when it is seen too, but only once the plan is
 * drawn. With reduced motion everything is finished at once. Leaving and
 * re-entering does not redraw, as in the concept.
 */
function start(root: HTMLElement, text: PlanText): () => void {
  const $ = <T extends Element = HTMLElement>(x: string) => root.querySelector<T>(`[data-x=${x}]`)!;
  const frame = $("frame");
  const plan = $("plan");
  const svg = plan.querySelector<SVGSVGElement>(`.${s.live}`)!;
  const left = $("left");
  const entry = $("entry");
  const str = $<SVGSVGElement>("string");
  const flip = $<HTMLButtonElement>("flip");
  const pendulum = $("pendulum");
  const notes = $("notes");
  const ties = $<SVGSVGElement>("ties");
  const card = $("card");
  const replay = $<HTMLButtonElement>("replay");
  const rows = [...root.querySelectorAll<HTMLLIElement>(`.${s.roles} li`)];
  const sm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let dead = false;
  const cleanups: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(e: HTMLElement, ev: K, f: (x: HTMLElementEventMap[K]) => void) => {
    e.addEventListener(ev, f);
    cleanups.push(() => e.removeEventListener(ev, f));
  };

  const wait = (ms: number) => new Promise((r) => setTimeout(r, sm ? 0 : ms));
  // progress 0 → 1 over requestAnimationFrame; with reduced motion straight to the end
  const EASE = {
    inOutQuad: (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2),
    outQuad: (u: number) => 1 - (1 - u) ** 2,
    outBack: (u: number) => 1 + 2 * (u - 1) ** 3 + (u - 1) ** 2,
  };
  const tween = (dur: number, f: (t: number) => unknown, ease: keyof typeof EASE | ((u: number) => number) = "inOutQuad") =>
    new Promise<void>((res) => {
      if (sm) {
        f(1);
        res();
        return;
      }
      const t0 = performance.now();
      const e = typeof ease === "function" ? ease : EASE[ease];
      const step = (now: number) => {
        if (dead) return res();
        const u = k01((now - t0) / dur);
        f(e(u));
        if (u < 1) requestAnimationFrame(step);
        else res();
      };
      requestAnimationFrame(step);
    });
  // threshold: read on each change, since the plan's height settles only after the fonts and styles load
  const whenIn = (target: Element, f: () => void, threshold?: () => number) => {
    if (sm || !("IntersectionObserver" in window)) {
      f();
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        const e = es[es.length - 1]!;
        if (e.isIntersecting && (!threshold || e.intersectionRatio >= threshold() - 0.005)) {
          io.disconnect();
          f();
        }
      },
      { rootMargin: "0px 0px -22% 0px", threshold: threshold ? Array.from({ length: 101 }, (_, i) => i / 100) : 0 },
    );
    io.observe(target);
    cleanups.push(() => io.disconnect());
  };
  const onWidth = (target: HTMLElement, f: () => void) => {
    let w = target.clientWidth;
    const ro = new ResizeObserver(() => {
      if (target.clientWidth !== w) {
        w = target.clientWidth;
        f();
      }
    });
    ro.observe(target);
    cleanups.push(() => ro.disconnect());
  };

  let lines: Line[] = [];
  let done = sm;
  let U: { pts: Pt[][]; paths: Element[]; knot: SVGElement } | null = null;
  let stringT = sm ? 1 : 0;
  let gT: Element | null = null;

  // the string from the plan's entrance to the tag's ring
  const drawString = (t: number) => {
    stringT = t;
    if (!U) return;
    U.paths.forEach((p, i) => strokeTo(p, U!.pts[i]!, 2.6, t, { simulatePressure: false }));
    U.knot.style.opacity = t > 0 ? "1" : "0";
  };
  const tieString = (C: Plan) => {
    const vb = svg.viewBox.baseVal;
    const R = svg.getBoundingClientRect();
    const k = R.width / vb.width;
    const L0 = left.getBoundingClientRect();
    const dx = R.left - L0.left + C.entrance[0] * k;
    const dy = R.top - L0.top + (C.entrance[1] + C.ty) * k;
    // in the wide layout the tag stands right under the entrance
    const two = getComputedStyle(entry).gridTemplateColumns.split(" ").length > 1;
    entry.style.setProperty("--u-pomak", two ? `${Math.max(0, Math.round(dx - 150))}px` : "0px");
    const L = left.getBoundingClientRect();
    const P = $("ring").getBoundingClientRect();
    const px = P.left - L.left + P.width / 2;
    const py = P.top - L.top + 9;
    str.setAttribute("viewBox", `0 0 ${L.width} ${L.height}`);
    str.innerHTML = "";
    const g = el("g", { filter: `url(#${GRAPHITE})` }, str);
    const rnd = seeded(53);
    const mid: Pt = [(dx + px) / 2, (dy + py) / 2 + 10];
    U = {
      pts: [-2, 2].map((o) => tremble(qb([dx + o * 0.6, dy + 2], [mid[0] + o * 3, mid[1]], [px + o, py], 22), 0.5, rnd)),
      paths: [el("path", { class: s.cord! }, g), el("path", { class: s.cord! }, g)],
      knot: el("circle", { cx: dx, cy: dy + 2, r: 3.4, class: s.knot! }, g) as SVGElement,
    };
    drawString(stringT);
  };

  // highlighting: one part of the plan (0 = none); the gold outline is drawn anew
  let marks: Record<string, { g: Element; lines: Line[] }> = {};
  let active = 0;
  const highlight = (n: number, draw = true) => {
    active = n;
    Object.entries(marks).forEach(([k, { g, lines: c }]) => {
      const yes = +k === n;
      g.classList.toggle(s.now!, yes);
      if (yes && draw && !sm) {
        c.forEach(({ p, L }) => {
          p.style.transition = "none";
          p.style.strokeDasharray = `${L} ${L}`;
          p.style.strokeDashoffset = String(L);
        });
        g.getBoundingClientRect();
        c.forEach(({ p }) => {
          p.style.transition = "";
          p.style.strokeDashoffset = "0";
        });
      }
    });
  };
  // the role by the plan: the current one is .now, the passed ones .past
  const role = (n: number) => {
    rows.forEach((li) => {
      const m = +li.dataset.n!;
      li.classList.toggle(s.now!, m === n);
      li.classList.toggle(s.past!, n > 0 && m < n);
    });
    highlight(n);
  };

  // doors: the leaf is a perfect-freehand stroke from the hinge, the swing a thin dashed line; f = 0 closed, 1 open
  type DoorEl = { d: Door; g: Element; arc: Element; leaf: Element; dr: Pt[]; f?: number };
  let DOORS: DoorEl[] = [];
  const angle = (a: Pt, b: Pt) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const setDoor = (v: DoorEl, f: number) => {
    v.f = f;
    const { h: hg, l: lf, e } = v.d;
    const r = Math.hypot(lf[0] - hg[0], lf[1] - hg[1]);
    const a0 = angle(hg, e);
    let da = angle(hg, lf) - a0;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    const a = a0 + da * f;
    const kx = hg[0] + r * Math.cos(a);
    const ky = hg[1] + r * Math.sin(a);
    const pts = v.dr.map(([ox, oy], i): Pt => [hg[0] + ((kx - hg[0]) * i) / 8 + ox, hg[1] + ((ky - hg[1]) * i) / 8 + oy]);
    v.leaf.setAttribute(
      "d",
      outline(getStroke(pts, { size: 3.4, thinning: 0.15, smoothing: 0.6, streamline: 0.3, simulatePressure: false, last: true, start: { cap: true }, end: { cap: true } })),
    );
    const n = Math.max(2, Math.round(18 * Math.min(1, f)));
    const f1 = (x: number) => x.toFixed(1);
    v.arc.setAttribute(
      "d",
      f > 0.03
        ? "M" +
            Array.from({ length: n + 1 }, (_, i) => {
              const b = a0 + (da * Math.min(1, f) * i) / n;
              return `${f1(hg[0] + r * Math.cos(b))} ${f1(hg[1] + r * Math.sin(b))}`;
            }).join(" L")
        : "",
    );
  };

  // the student: a person seen from above (shoulders, head and feet that step out in turn); footprints every STEP units
  let walk: "waiting" | "walking" | "end" = sm ? "end" : "waiting";
  let walkNo = 0;
  let S: { trail: Element; g: SVGElement; feet: Element[] } | null = null;
  type Dense = { D: { x: number; y: number; s: number }[]; stS: Record<number, number>; L: number };
  // the path is rounded at the corners and densely sampled; stS are the distances where the student stops
  const dense = (path: Plan["path"]): Dense => {
    const v: [number, number, number?][] = [];
    path.forEach((p, i) => {
      if (i === 0 || i === path.length - 1 || p[2] || p[3] != null) {
        v.push([p[0], p[1], i]);
        return;
      }
      const a = path[i - 1]!;
      const b = path[i + 1]!;
      const la = Math.hypot(p[0] - a[0], p[1] - a[1]);
      const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
      const r = Math.min(18, la / 2, lb / 2);
      qb(
        [p[0] + ((a[0] - p[0]) * r) / la, p[1] + ((a[1] - p[1]) * r) / la],
        [p[0], p[1]],
        [p[0] + ((b[0] - p[0]) * r) / lb, p[1] + ((b[1] - p[1]) * r) / lb],
        10,
      ).forEach((q) => v.push(q));
    });
    const D = [{ x: v[0]![0], y: v[0]![1], s: 0 }];
    const stS: Record<number, number> = { 0: 0 };
    let sum = 0;
    for (let j = 1; j < v.length; j++) {
      const [x0, y0] = v[j - 1]!;
      const [x1, y1, st] = v[j]!;
      const L = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(1, Math.ceil(L / 2));
      for (let m = 1; m <= n; m++) D.push({ x: x0 + ((x1 - x0) * m) / n, y: y0 + ((y1 - y0) * m) / n, s: sum + (L * m) / n });
      sum += L;
      if (st != null) stS[st] = sum;
    }
    return { D, stS, L: sum };
  };
  const point = (P: Dense, at: number): Pt => {
    const D = P.D;
    let lo = 0;
    let hi = D.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (D[m]!.s <= at) lo = m;
      else hi = m;
    }
    const a = D[lo]!;
    const b = D[hi]!;
    const f = b.s > a.s ? k01((at - a.s) / (b.s - a.s)) : 0;
    return [a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f];
  };
  const heading = (P: Dense, at: number) => {
    const [x0, y0] = point(P, Math.max(0, at - 3));
    const [x1, y1] = point(P, Math.min(P.L, at + 3));
    return Math.atan2(y1 - y0, x1 - x0);
  };
  type Print = { x: number; y: number; a: number; side: number; s: number };
  const prints = (P: Dense) => {
    const o: Print[] = [];
    let side = 1;
    for (let at = STEP / 2; at < P.L - 2; at += STEP) {
      side = -side;
      const [x, y] = point(P, at);
      o.push({ x, y, a: heading(P, at), side, s: at });
    }
    return o;
  };
  const foot = (k: Print, old?: boolean) => {
    const px = k.x - Math.sin(k.a) * 3 * k.side;
    const py = k.y + Math.cos(k.a) * 3 * k.side;
    const f1 = (x: number) => x.toFixed(1);
    const e = el(
      "ellipse",
      { cx: f1(px), cy: f1(py), rx: 1.5, ry: 2.7, transform: `rotate(${((k.a * 180) / Math.PI - 90).toFixed(0)} ${f1(px)} ${f1(py)})` },
      S!.trail,
    );
    if (old) e.classList.add(s.old!);
    else setTimeout(() => e.classList.add(s.old!), 1400);
  };
  // the step's phase moves the feet and sways the shoulders; amp is 0 while standing
  const place = (x: number, y: number, a: number, phase = 0, amp = 0) => {
    const sn = Math.sin(phase) * amp;
    S!.g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${((a * 180) / Math.PI + 90 + sn * 7).toFixed(1)})`);
    S!.feet[0]!.setAttribute("cy", (-sn * 4.4).toFixed(2));
    S!.feet[1]!.setAttribute("cy", (sn * 4.4).toFixed(2));
  };
  const current = () => (plan.clientWidth < 520 ? PLAN.narrow : PLAN.wide);
  // a walk between two stops: speeds up at the start and slows before the door (r is the share of acceleration)
  const walkEase = (r: number) => (u: number) => {
    const v = 1 / (1 - r);
    return u < r ? (v * u * u) / (2 * r) : u > 1 - r ? 1 - (v * (1 - u) ** 2) / (2 * r) : v * (u - r / 2);
  };
  // the code is typed letter by letter by the course's door, the same as on the tag
  const typeCode = async ([x, y]: Pt, alive: () => boolean) => {
    const t = el("text", { x, y, class: s.typed! }, gT!);
    for (let i = 1; i <= CODE.length; i++) {
      if (!alive()) return;
      t.textContent = CODE.slice(0, i);
      await wait(i === 4 ? 120 : 70);
    }
    await wait(200);
  };

  // the end of the walk (also when a width change breaks it): doors open, the student at the desk, all footprints on the floor
  const endWalk = () => {
    walkNo++;
    walk = "end";
    delete root.dataset.walk;
    role(0);
  };
  const go = async () => {
    if (sm || walk === "walking" || dead) return;
    walk = "waiting";
    build();
    const C = current();
    const mine = ++walkNo;
    const path = C.path;
    const P = dense(path);
    const K = prints(P);
    const alive = () => mine === walkNo && !dead;
    walk = "walking";
    root.dataset.walk = "";
    role(1);
    const stops = path.map((_, i) => i).filter((i) => P.stS[i] != null);
    let next = 0;
    S!.g.style.opacity = "1";
    place(path[0]![0], path[0]![1], heading(P, 0));
    for (let j = 0; j < stops.length; j++) {
      const i = stops[j]!;
      const [x, y, k, v] = path[i]!;
      if (k! > 1) role(k!);
      if (k === 3) {
        // at the desk the student turns to it and pauses while the institution is highlighted
        const a = heading(P, P.L);
        let d = -Math.PI / 2 - a;
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        await tween(400, (t) => alive() && place(x, y, a + d * t));
        if (!alive()) return;
        await wait(1400);
        break;
      }
      if (k === 2) {
        await typeCode(C.code, alive);
        if (!alive()) return;
      }
      if (v != null) {
        await wait(140);
        const door = DOORS[v]!;
        door.g.classList.add(s.opening!);
        await tween(620, (t) => alive() && setDoor(door, t), "outBack");
        if (!alive()) return;
        door.g.classList.remove(s.opening!);
      }
      if (k === 2) gT!.querySelector(`.${s.typed}`)?.classList.add(s.gone!);
      if (j === stops.length - 1) break;
      const s0 = P.stS[i]!;
      const s1 = P.stS[stops[j + 1]!]!;
      const L = s1 - s0;
      const r = Math.min(0.3, 26 / L);
      await tween(
        (L / SPEED) * (1 + r),
        (t) => {
          if (!alive()) return;
          const at = s0 + L * t;
          while (next < K.length && K[next]!.s <= at) foot(K[next++]!);
          const [px, py] = point(P, at);
          place(px, py, heading(P, at), (at / STEP) * Math.PI, Math.min(1, t * 5, (1 - t) * 5));
        },
        walkEase(r),
      );
      if (!alive()) return;
    }
    if (alive()) endWalk();
  };

  const build = () => {
    const narrow = plan.clientWidth < 520;
    const C = narrow ? PLAN.narrow : PLAN.wide;
    svg.setAttribute("viewBox", `0 0 ${C.vb[0]} ${C.vb[1]}`);
    svg.innerHTML = "";
    const rc = rough.svg(svg);
    const g0 = el("g", { transform: `translate(0 ${C.ty})` }, svg);
    const o = (seed: number, x: RoughOptions = {}): RoughOptions => ({ seed, stroke: "currentColor", strokeWidth: 1.2, roughness: 0.7, bowing: 0.5, ...x });
    let n = 1;
    // your institution: a light brass hatching
    const gN = el("g", { class: s.ours!, opacity: 0.32 }, g0);
    gN.appendChild(
      rc.rectangle(...C.ours, { seed: 90, stroke: "none", fill: "currentColor", fillStyle: "hachure", hachureAngle: -40, hachureGap: 10, fillWeight: 0.7, roughness: 0.8 }),
    );
    const gZ = el("g", {}, g0);
    // walls: a double line with openings
    C.walls.forEach(([x1, y1, x2, y2, gaps]) => {
      const flat = y1 === y2;
      pieces(flat ? x1 : y1, flat ? x2 : y2, gaps).forEach(([a, b]) =>
        [-3, 3].forEach((d) =>
          gZ.appendChild(flat ? rc.line(a, y1 + d, b, y1 + d, o(n++, { strokeWidth: 1.5 })) : rc.line(x1 + d, a, x1 + d, b, o(n++, { strokeWidth: 1.5 }))),
        ),
      );
    });
    // partitions between institutions: a solid hatched wall, no doors
    C.partitions.forEach(([x1, y1, x2, y2]) => {
      const flat = y1 === y2;
      const f: RoughOptions = { fill: "currentColor", fillStyle: "hachure", hachureGap: 3.2, hachureAngle: 45, fillWeight: 0.8 };
      gZ.appendChild(flat ? rc.rectangle(x1, y1 - 6, x2 - x1, 12, o(n++, f)) : rc.rectangle(x1 - 6, y1, 12, y2 - y1, o(n++, f)));
    });
    const gD = el("g", {}, g0);
    // the doors on the student's way wait closed until they come; the others are drawn open, as usual on a plan
    if (walk === "walking") endWalk();
    const onWay = C.path.filter((p) => p[3] != null).map((p) => p[3]);
    const rndV = seeded(71);
    DOORS = C.doors.map((d, i) => {
      const g = el("g", { class: `${s.door} ${s.labels}` }, g0);
      const v: DoorEl = {
        d,
        g,
        arc: el("path", { class: s.arc! }, g),
        leaf: el("path", { class: s.leaf! }, g),
        dr: Array.from({ length: 9 }, (_, j): Pt => (j === 0 ? [0, 0] : [(rndV() - 0.5) * 0.7, (rndV() - 0.5) * 0.7])),
      };
      el("circle", { cx: d.h[0], cy: d.h[1], r: 1.9, class: s.hinge! }, g);
      setDoor(v, walk === "waiting" && onWay.includes(i) ? 0 : 1);
      return v;
    });
    // footprints and the student are under the labels, so the labels stay legible when the student passes under them
    S = {
      trail: el("g", { class: s.trail! }, g0),
      g: el("g", { class: s.student!, style: `opacity:${walk === "end" ? 1 : 0}` }, g0) as SVGElement,
      feet: [],
    };
    S.feet = [-3.4, 3.4].map((cx) => el("ellipse", { cx, cy: 0, rx: 1.8, ry: 3, class: s.foot! }, S!.g));
    el("ellipse", { rx: 9, ry: 4.4, class: s.shoulders! }, S.g);
    el("circle", { cy: -0.5, r: 4.3, class: s.crown! }, S.g);
    if (walk === "end") {
      const p = C.path;
      const m = p.length;
      prints(dense(p)).forEach((k) => foot(k, true));
      place(p[m - 1]![0], p[m - 1]![1], -Math.PI / 2);
    }
    gT = el("g", { class: s.labels! }, g0);
    const word = (k: Key) => (k === "code" ? CODE : text[k]);
    C.desks.forEach(([x, y, w, hh, row]) => {
      el("rect", { x, y, width: w, height: hh, class: s.floor! }, gD);
      gD.appendChild(rc.rectangle(x, y, w, hh, o(n++, { strokeWidth: 1 })));
      row.forEach((k, i) => {
        const a: Record<string, string | number> = { x: x + w / 2, y: y + hh / 2 + (i - (row.length - 1) / 2) * 15 + 4, "text-anchor": "middle" };
        const cls = i === 2 ? s.gold : k === "course" ? s.faint : "";
        a.class = cls ?? "";
        el("text", a, gT!).textContent = word(k);
      });
    });
    // the span: a line, slanted ticks and guide lines to the wall
    const k = C.span;
    gD.appendChild(rc.line(k.x1 - 8, k.y, k.x2 + 8, k.y, o(n++, { strokeWidth: 0.9 })));
    [k.x1, k.x2].forEach((x) => {
      gD.appendChild(rc.line(x - 5, k.y + 5, x + 5, k.y - 5, o(n++, { strokeWidth: 1.6 })));
      gD.appendChild(rc.line(x, k.wall - 6, x, k.y - 8, o(n++, { strokeWidth: 0.7 })));
    });
    el("text", { x: (k.x1 + k.x2) / 2, y: k.y - 7, "text-anchor": "middle", class: s.faint! }, gT).textContent = text.span;
    C.text.forEach(([x, y, key, cls, anchor]) => {
      const a: Record<string, string | number> = { x, y, class: cls };
      if (anchor) a["text-anchor"] = anchor;
      el("text", a, gT!).textContent = word(key);
    });
    lines = roughLines(g0);
    const scale = svg.getBoundingClientRect().width / C.vb[0];
    if (scale > 0) svg.style.setProperty("--u-fs", `${(12 / scale).toFixed(2)}px`);
    // the highlights by the roles: the entrance circled and the corridor hatched, the course's desk circled, the institution outlined with filled partitions; not part of the first drawing
    marks = {};
    Object.entries(C.marks).forEach(([key, d]) => {
      const g = el("g", { class: s.mark! });
      g0.insertBefore(g, gT);
      if (d.el) g.appendChild(rc.ellipse(...d.el, o(200 + +key, { strokeWidth: 1.8, roughness: 1.1, bowing: 1.2 })));
      if (d.ob) g.appendChild(rc.rectangle(...d.ob, o(230, { strokeWidth: 1.8, roughness: 1 })));
      (d.pr || []).forEach((r) =>
        g.appendChild(
          rc.rectangle(r[0]!, r[1]!, r[2]!, r[3]!, o(210 + +key, { stroke: "none", fill: "currentColor", fillStyle: "hachure", hachureAngle: -40, hachureGap: 7, fillWeight: 0.9 })),
        ),
      );
      (d.zid || []).forEach((r, i) =>
        g.appendChild(rc.rectangle(r[0]!, r[1]!, r[2]!, r[3]!, o(220 + i, { strokeWidth: 1.6, fill: "currentColor", fillStyle: "solid" }))),
      );
      marks[key] = { g, lines: roughLines(g) };
    });
    highlight(active, false);
    drawRough(lines, done ? 1 : 0);
    tieString(C);
  };

  // the notes by the tag: in the wide layout they stand at the height of the course and the code on the tag, tied to the card's edge by a thin line
  let tiesT = sm ? 1 : 0;
  let TIES: { p: Element; pts: Pt[]; tc: SVGElement }[] = [];
  const offset = (e: HTMLElement | null, to: HTMLElement): Pt => {
    let x = 0;
    let y = 0;
    while (e && e !== to) {
      x += e.offsetLeft;
      y += e.offsetTop;
      e = e.offsetParent as HTMLElement | null;
    }
    return [x, y];
  };
  const drawTies = (t: number) => {
    tiesT = t;
    TIES.forEach(({ p, pts, tc }) => {
      strokeTo(p, pts, 1.3, t, { simulatePressure: false, thinning: 0.2, start: { taper: 0, cap: true }, end: { taper: 0, cap: true } });
      tc.style.opacity = t > 0 ? "1" : "0";
    });
  };
  const children = () => [...notes.children] as HTMLElement[];
  const align = () => {
    const two = getComputedStyle(entry).gridTemplateColumns.split(" ").length > 1;
    const [b1, b2, pz] = children() as [HTMLElement, HTMLElement, HTMLElement];
    if (two) notes.dataset.aligned = "";
    else delete notes.dataset.aligned;
    [b1, b2, pz].forEach((d) => (d.style.top = ""));
    notes.style.height = "";
    ties.innerHTML = "";
    TIES = [];
    if (!two) return;
    const [kx] = offset(card, entry);
    const nx = notes.offsetLeft;
    const ny = notes.offsetTop;
    const mid = (x: string) => {
      const e = $(x);
      return offset(e, entry)[1] + e.offsetHeight / 2;
    };
    const oz = b1.querySelector<HTMLElement>(`.${s.tag}`)!.offsetHeight / 2;
    const y1 = mid("course");
    const y2 = mid("code");
    b1.style.top = `${y1 - ny - oz}px`;
    b2.style.top = `${y2 - ny - oz}px`;
    const pzY = y2 - ny - oz + b2.offsetHeight + 44;
    pz.style.top = `${pzY}px`;
    notes.style.height = `${pzY + pz.offsetHeight}px`;
    ties.setAttribute("viewBox", `0 0 ${entry.clientWidth} ${entry.clientHeight}`);
    const g = el("g", { filter: `url(#${GRAPHITE})` }, ties);
    const rnd = seeded(29);
    [y1, y2].forEach((y) => {
      const x0 = kx + 306;
      const x1 = nx - 16;
      TIES.push({
        p: el("path", { class: s.tie! }, g),
        pts: tremble(qb([x0, y], [(x0 + x1) / 2, y + 1.5], [x1, y], 16), 0.3, rnd),
        tc: el("circle", { cx: x0, cy: y, r: 2.6, class: s.dot! }, g) as SVGElement,
      });
    });
    drawTies(tiesT);
  };

  // the tag: turned by a click on the card or with the button from the keyboard (an interruptible CSS transition), swung by a CSS animation; once still, the lines to the notes are drawn
  const turn = (yes: boolean) => {
    if (yes) entry.dataset.flipped = "";
    else delete entry.dataset.flipped;
    flip.setAttribute("aria-pressed", String(yes));
  };
  const toggle = () => turn(!("flipped" in entry.dataset));
  on(flip, "click", toggle);
  on(card, "click", toggle);
  const swing = async () => {
    if (!sm) {
      pendulum.classList.add(s.swing!);
      await wait(2300);
    }
    if (!dead) await tween(650, drawTies, "outQuad");
  };

  // hovering a role only highlights its part of the plan; while the student walks, the walk leads the roles
  rows.forEach((li) => on(li, "pointerenter", () => walk !== "walking" && role(+li.dataset.n!)));
  on(rows[0]!.parentElement!, "pointerleave", () => walk !== "walking" && role(0));
  on(replay, "click", () => void go());

  if (!sm) root.dataset.anim = "";
  root.dataset.js = "";
  build();
  onWidth(plan, build);
  // the entry's width depends on the columns, and the string on the ring's position: recompute when the left column's width changes
  onWidth(left, () => {
    if (svg.viewBox.baseVal.width) tieString(current());
    align();
  });
  align();
  void document.fonts?.ready.then(() => !dead && align());
  if (sm) frame.dataset.done = "";
  let drawn!: () => void;
  const planDone = new Promise<void>((r) => (drawn = r));
  whenIn(
    plan,
    async () => {
      await tween(2600, (t) => drawRough(lines, t));
      if (dead) return;
      done = true;
      frame.dataset.done = "";
      drawn();
      await wait(500);
      void go();
    },
    // the student starts only once the whole plan is seen
    () => Math.min(0.85, (innerHeight * 0.68) / Math.max(1, plan.getBoundingClientRect().height)),
  );
  whenIn(entry, async () => {
    await planDone;
    if (dead) return;
    await tween(600, drawString, "outQuad");
    if (!dead) void swing();
  });

  return () => {
    dead = true;
    walkNo++;
    cleanups.forEach((f) => f());
    delete root.dataset.js;
    delete root.dataset.anim;
    delete root.dataset.walk;
    delete frame.dataset.done;
    delete entry.dataset.flipped;
    delete notes.dataset.aligned;
    flip.setAttribute("aria-pressed", "false");
    pendulum.classList.remove(s.swing!);
    rows.forEach((li) => li.classList.remove(s.now!, s.past!));
    children().forEach((d) => (d.style.top = ""));
    notes.style.height = "";
    entry.style.removeProperty("--u-pomak");
    for (const x of [svg, str, ties]) {
      x.innerHTML = "";
      x.removeAttribute("viewBox");
    }
    svg.style.removeProperty("--u-fs");
  };
}
