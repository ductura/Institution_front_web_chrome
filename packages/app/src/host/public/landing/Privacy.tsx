"use client";

import { useEffect, useRef } from "react";
import { getStroke } from "perfect-freehand";
import rough from "roughjs";

import { DEFAULT_INTERFACE_LOCALE, messagesFor, type InterfaceLocale } from "../../../../../../src/lib/i18n/locale";

import { GRAPHITE } from "./How";
import l from "./Landing.module.css";
import s from "./Privacy.module.css";
import { PRIVACY_STILL } from "./privacyStill";

type Labels = ReturnType<typeof messagesFor>["landing"]["privacy"]["labels"];
type Pt = [number, number];
type Rough = ReturnType<typeof rough.svg>;
type RoughOptions = NonNullable<Parameters<Rough["path"]>[1]>;

/* The concept's class names in the finished drawing, mapped to this module. */
const CLS: Record<string, string | undefined> = {
  "p-imena": s.named,
  "p-predmet": s.thing,
  "p-ispran": s.faded,
  "p-natpis": s.label,
  "p-anim": s.anim,
  "p-para": s.steam,
  "p-nota": s.note,
  "p-disk": s.disc,
  "p-tip": s.dot,
  "p-val": s.wave,
  "p-kursor": s.cursor,
  "p-kart": s.tab,
  "p-redak": s.line,
  "p-granica": s.border,
};
const still = (inner: string, labels: Labels) =>
  inner
    .replace(/class="([^"]+)"/g, (_, c: string) => `class="${c.split(" ").map((k) => CLS[k] ?? k).join(" ")}"`)
    .replace(/\{(\w+)\}/g, (_, k: string) => (k === "graphite" ? GRAPHITE : labels[k as keyof Labels]));

/**
 * "Privatnost" of koncepti/naslovnica (DAN-1520): a dark scene in which the
 * light falls only on the page, and three columns of facts under it. Without JS
 * the finished drawing is shown.
 */
export function Privacy({ locale = DEFAULT_INTERFACE_LOCALE }: { locale?: InterfaceLocale }) {
  const root = useRef<HTMLElement>(null);
  const t = messagesFor(locale).landing.privacy;

  useEffect(() => (root.current ? start(root.current, t.labels) : undefined), [t.labels]);

  return (
    <section className={`${l.section} ${s.privacy}`} id="privatnost" aria-labelledby="h-bil" ref={root}>
      <div className={l.head}>
        <div className={l.eyebrow}>{t.eyebrow}</div>
        <h2 id="h-bil">
          {t.titleStart}
          <br />
          {t.titleEnd}
        </h2>
        <p className={s.intro}>
          {t.introStart}
          <b>{t.introBold}</b>
          {t.introEnd}
        </p>
      </div>
      <div className={s.scene} role="img" aria-label={t.sceneLabel} data-x="scene">
        <svg className={s.live} aria-hidden="true" />
        {(["wide", "narrow"] as const).map((k) => (
          <svg
            key={k}
            className={`${s.still} ${s[k]}`}
            viewBox={PRIVACY_STILL[k].viewBox}
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: still(PRIVACY_STILL[k].inner, t.labels) }}
          />
        ))}
      </div>
      <div className={s.panes} data-x="panes">
        {t.panes.map((p) => (
          <div key={p.title} className={s.pane}>
            <svg className={s.small} viewBox="0 0 160 110" aria-hidden="true" />
            <h3>{p.title}</h3>
            <p>{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- drawing helpers, as in the concept ---------- */
const NS = "http://www.w3.org/2000/svg";
const el = (n: string, a: Record<string, string | number> = {}, host?: Element) => {
  const e = document.createElementNS(NS, n);
  for (const k in a) e.setAttribute(k, String(a[k]));
  if (host) host.appendChild(e);
  return e;
};
const k01 = (v: number) => Math.min(1, Math.max(0, v));
const seeded = (n: number) => () => (n = (n * 16807) % 2147483647) / 2147483647;
const PAPER = "#fcfbf8";
const INK = "#242422";
const INK2 = "#55534d";
const GOLD = "#806529";
const GOLD_WARM = "#c8aa6e";
const RULE2 = "#e2e0d9";
const SV = "#b3aea3";
const TABLE = "#242422";
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
const stroke = (pts: Pt[], size: number, last = true) =>
  outline(
    getStroke(pts, {
      size,
      thinning: 0.55,
      smoothing: 0.55,
      streamline: 0.35,
      simulatePressure: true,
      last,
      start: { taper: size * 3, cap: true },
      end: { taper: last ? size * 4 : 0, cap: true },
    }),
  );
const qb = (a: Pt, c: Pt, b: Pt, n = 18): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
  });
// Rough.js paths are drawn through stroke-dashoffset
const prepare = (g: Element) =>
  [...g.querySelectorAll("path")]
    .filter((p) => {
      const c = p.getAttribute("stroke");
      return c && c !== "none";
    })
    .map((p): [SVGPathElement, number] => {
      const L = p.getTotalLength() + 2;
      p.style.strokeDasharray = `${L} ${L}`;
      p.style.strokeDashoffset = String(L);
      return [p, L];
    });
const drawTo = (list: [SVGPathElement, number][], t: number, spread = 0.55) => {
  const n = list.length;
  list.forEach(([p, L], i) => {
    const lt = k01((t - (n > 1 ? (i / (n - 1)) * spread : 0)) / (1 - spread));
    p.style.strokeDashoffset = String(L * (1 - lt));
  });
};
// a hand-cut rectangle: points along the edges with a small tremor
const cut = (x1: number, y1: number, x2: number, y2: number, rnd: () => number, a = 1.4, step = 36) => {
  const p: Pt[] = [];
  const j = () => (rnd() - 0.5) * 2 * a;
  const edge = (ax: number, ay: number, bx: number, by: number) => {
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let i = 0; i < n; i++) p.push([ax + ((bx - ax) * i) / n + j(), ay + ((by - ay) * i) / n + j()]);
  };
  edge(x1, y1, x2, y1);
  edge(x2, y1, x2, y2);
  edge(x2, y2, x1, y2);
  edge(x1, y2, x1, y1);
  return p;
};
const dPoly = (p: Pt[]) => "M" + p.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") + "Z";
// open scissors, blades facing +x
const scissors = (host: Element, color: string, paper: string) => {
  const g = el("g", { filter: `url(#${GRAPHITE})` }, host);
  const ring = (cx: number, cy: number, rx: number, ry: number) =>
    Array.from({ length: 26 }, (_, i): Pt => {
      const a = (i / 24) * 6.4;
      return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
    });
  for (const [cx, cy, rx, ry] of [
    [-30, -9, 9, 6.5],
    [-30, 9, 9, 6.5],
  ] as const)
    el("path", { d: stroke(ring(cx, cy, rx, ry), 2.6), fill: color }, g);
  el("path", { d: stroke(qb([-22, -6], [-4, 0], [26, 9]), 3.2), fill: color }, g);
  el("path", { d: stroke(qb([-22, 6], [-4, 0], [26, -9]), 3.2), fill: color }, g);
  el("circle", { cx: -4, cy: 0, r: 1.8, fill: paper }, g);
  return g;
};
// the page without text: the title is a thicker short line, the lines are graphite, the pasted part gold
const page = (host: Element, r: Rough, x: number, y: number, m: number) => {
  const g = el("g", { transform: `translate(${x} ${y}) scale(${m})` }, host);
  el("rect", { x: 0, y: 0, width: 340, height: 352, rx: 3, fill: PAPER }, g);
  const rr = seeded(5);
  const wave = (x1: number, x2: number, yy: number, i: number, color: string, w: number) => {
    const pts = Array.from({ length: 16 }, (_, k): Pt => [x1 + ((x2 - x1) * k) / 15, yy + Math.sin(k * 1.7 + i) * 1.4]);
    g.appendChild(r.linearPath(pts, { stroke: color, strokeWidth: w, roughness: 0.8, bowing: 1, seed: 20 + i }));
  };
  wave(24, 150, 30, 0, "#85827a", 1);
  g.appendChild(r.line(24, 44, 316, 44, { stroke: RULE2, strokeWidth: 1, roughness: 0.6, seed: 3 }));
  el("path", { d: stroke(qb([24, 72], [60, 70], [104, 71]), 6.5), fill: INK, filter: `url(#${GRAPHITE})` }, g);
  (
    [
      [114, 300],
      [140, 292],
      [166, 0],
      [192, 0],
      [218, 118],
      [256, 290],
      [282, 270],
      [308, 196],
    ] as const
  ).forEach(([yy, end], i) => {
    if (i === 2) {
      wave(24, 112, yy, i, INK2, 1.1);
      wave(120, 296, yy, i + 10, GOLD, 1.7);
      return;
    }
    if (i === 3) {
      wave(24, 190, yy, i, GOLD, 1.7);
      wave(198, 300 - rr() * 10, yy, i + 10, INK2, 1.1);
      return;
    }
    wave(24, end - rr() * 8, yy, i, INK2, 1.1);
  });
  return g;
};

type Place = [number, number, number];
type Layout = {
  vb: [number, number];
  page: Place;
  cut: [number, number, number, number];
  light: [number, number, number, number];
  tabs: Place;
  camera: Place;
  notebook: Place;
  phone: Place;
  microphone: Place;
  message: Place;
  desk: Place | null;
  fs: number;
};
const LAYOUT: Record<"wide" | "narrow", Layout> = {
  wide: {
    vb: [1000, 560],
    page: [330, 104, 1],
    cut: [250, 72, 750, 500],
    light: [500, 288, 340, 350],
    tabs: [28, 22, 1],
    camera: [470, 18, 1],
    notebook: [62, 190, 1],
    phone: [828, 84, 1],
    microphone: [846, 370, 1],
    message: [598, 10, 1],
    desk: [50, 430, 1],
    fs: 12,
  },
  narrow: {
    vb: [400, 640],
    page: [57, 122, 0.84],
    cut: [36, 102, 364, 442],
    light: [200, 272, 240, 250],
    tabs: [12, 8, 0.62],
    camera: [300, 12, 0.8],
    notebook: [26, 470, 0.55],
    phone: [160, 462, 0.6],
    microphone: [300, 466, 0.75],
    message: [204, 44, 0.5],
    desk: null,
    fs: 12,
  },
};
const FADE_ORDER = ["camera", "microphone", "message", "tabs", "phone", "desk", "notebook"] as const;
type Thing = (typeof FADE_ORDER)[number];

/* ---------- the three small drawings under the scene ---------- */
type Stroke = { p: Pt[]; s: number; gold?: boolean };
const ln = (a: Pt, b: Pt, n = 8) =>
  Array.from({ length: n + 1 }, (_, i): Pt => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
const wav = (x1: number, x2: number, y: number, a = 1.6) =>
  Array.from({ length: 14 }, (_, i): Pt => {
    const x = x1 + ((x2 - x1) * i) / 13;
    return [x, y + Math.sin(i * 1.3) * a * (i % 3 ? 1 : 0.4)];
  });
const join = (...d: Pt[][]) => d.reduce((a, b) => a.concat(b.slice(1)));
const oval = (cx: number, cy: number, rx: number, ry: number, more = 1.06, n = 26) =>
  Array.from({ length: n + 1 }, (_, i): Pt => {
    const a = -1.4 + (i / n) * 6.28 * more;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });
const sheet = (x1: number, y1: number, x2: number, y2: number) =>
  join(ln([x1, y1], [x2, y1 - 3]), ln([x2, y1 - 3], [x2 + 3, y2]), ln([x2 + 3, y2], [x1 + 2, y2 + 2]), ln([x1 + 2, y2 + 2], [x1, y1]));
// a dashed gold line around the page: short strokes along the edge
const dashed = (x1: number, y1: number, x2: number, y2: number, d = 9, r = 6) => {
  const o: Stroke[] = [];
  const edge = (a: Pt, b: Pt) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.floor(L / (d + r));
    for (let i = 0; i < n; i++) {
      const t0 = (i * (d + r)) / L;
      const t1 = (i * (d + r) + d) / L;
      o.push({
        p: ln([a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1], 3),
        s: 1.5,
        gold: true,
      });
    }
  };
  edge([x1, y1], [x2, y1]);
  edge([x2, y1], [x2, y2]);
  edge([x2, y2], [x1, y2]);
  edge([x1, y2], [x1, y1]);
  return o;
};
const curve = (x: number, y: number, m: number) =>
  join(
    qb([x, y], [x + 8 * m, y - 4 * m], [x + 14 * m, y - 9 * m], 8),
    qb([x + 14 * m, y - 9 * m], [x + 20 * m, y - 14 * m], [x + 30 * m, y - 24 * m], 8),
  );
const SMALL: Stroke[][] = [
  // recorded only inside the line: a page with lines, a gold line around it
  [
    { p: sheet(52, 22, 104, 88), s: 2.2 },
    { p: wav(62, 94, 38), s: 1.5 },
    { p: wav(62, 90, 52), s: 1.5 },
    { p: wav(62, 80, 66), s: 1.5 },
    ...dashed(36, 8, 124, 102),
  ],
  // yours: headphones and a cup, the steam in gold
  [
    { p: qb([15, 64], [42, -6], [69, 64]), s: 2.4 },
    { p: qb([22, 60], [42, 8], [62, 60]), s: 1.4 },
    { p: oval(16, 74, 8, 15), s: 2.4 },
    { p: oval(20, 74, 3, 9, 1), s: 1.4 },
    { p: oval(68, 74, 8, 15), s: 2.4 },
    { p: oval(64, 74, 3, 9, 1), s: 1.4 },
    { p: oval(118, 52, 20, 5), s: 2 },
    {
      p: join(ln([98, 53], [101, 84], 6), qb([101, 84], [103, 97], [118, 97], 10), qb([118, 97], [133, 97], [135, 84], 10), ln([135, 84], [138, 53], 6)),
      s: 2.4,
    },
    { p: qb([137, 60], [158, 64], [135, 84], 12), s: 2.2 },
    { p: qb([88, 101], [118, 110], [150, 101], 14), s: 1.8 },
    { p: join(qb([111, 42], [104, 34], [111, 26], 8), qb([111, 26], [118, 18], [111, 10], 8)), s: 1.8, gold: true },
    { p: join(qb([125, 42], [118, 34], [125, 26], 8), qb([125, 26], [132, 18], [125, 10], 8)), s: 1.8, gold: true },
  ],
  // the same view: two equal pages, the same gold curve on both, an equals sign between
  [
    { p: sheet(14, 22, 64, 92), s: 2.2 },
    { p: wav(22, 52, 36, 1.2), s: 1.4 },
    { p: curve(24, 80, 1.1), s: 2, gold: true },
    { p: ln([74, 52], [86, 52], 3), s: 1.8 },
    { p: ln([74, 61], [86, 61], 3), s: 1.8 },
    { p: sheet(96, 22, 146, 92), s: 2.2 },
    { p: wav(104, 134, 36, 1.2), s: 1.4 },
    { p: curve(106, 80, 1.1), s: 2, gold: true },
  ],
];

/*
 * The scene is drawn each time a third of it enters the view: the light opens on
 * the page, the things in the dark are sketched, scissors cut the line, the camera
 * bounces off it and the things outside fade one by one; then the quiet life
 * runs. Leaving the view stops it and the next entry starts over. The small
 * drawings under it are drawn anew at each entry. With reduced motion everything
 * is finished at once.
 */
function start(root: HTMLElement, labels: Labels): () => void {
  const scene = root.querySelector<HTMLElement>("[data-x=scene]")!;
  const svg = scene.querySelector<SVGSVGElement>(`.${s.live}`)!;
  const panes = root.querySelector<HTMLElement>("[data-x=panes]")!;
  const sm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrowQ = matchMedia("(max-width: 640px)");
  const io = "IntersectionObserver" in window;
  const observers: IntersectionObserver[] = [];

  // progress 0 → 1 over requestAnimationFrame; with reduced motion straight to the end
  const EASE = {
    outCubic: (u: number) => 1 - (1 - u) ** 3,
    inCubic: (u: number) => u ** 3,
    inOutSine: (u: number) => -(Math.cos(Math.PI * u) - 1) / 2,
    linear: (u: number) => u,
  };
  const ani = (ms: number, f: (t: number) => unknown, { delay = 0, ease = "outCubic" as keyof typeof EASE } = {}) =>
    new Promise<void>((res) => {
      if (sm) {
        f(1);
        res();
        return;
      }
      let t0: number | null = null;
      const step = (now: number) => {
        if (t0 === null) t0 = now + delay;
        const u = k01((now - t0) / ms);
        if (now >= t0) f(EASE[ease](u));
        if (u < 1) requestAnimationFrame(step);
        else res();
      };
      requestAnimationFrame(step);
    });
  const wait = (ms: number) => new Promise((r) => setTimeout(r, sm ? 0 : ms));

  type Built = {
    cut: (t: number) => void;
    light: (t: number) => void;
    lines: [SVGPathElement, number][];
    all: Element;
    border: Element;
    L: Layout;
    g: (k: Thing) => Element | null;
  };
  let started = false;
  let done = sm;
  let S: Built | null = null;

  const build = () => {
    const narrow = narrowQ.matches;
    const L = LAYOUT[narrow ? "narrow" : "wide"];
    const [W, H] = L.vb;
    const id = "pz" + (narrow ? "u" : "s");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    svg.innerHTML = "";
    const r = rough.svg(svg);
    const rnd = seeded(41);
    const defs = el("defs", {}, svg);
    // light: a hole in the dark grows from nothing
    const rg = el("radialGradient", { id: id + "-svj" }, defs);
    for (const [o, c] of [
      [0, "#000"],
      [0.6, "#000"],
      [1, "#fff"],
    ] as const)
      el("stop", { offset: o, "stop-color": c }, rg);
    const mask = el("mask", { id: id + "-maska", maskUnits: "userSpaceOnUse", x: 0, y: 0, width: W, height: H }, defs);
    el("rect", { width: W, height: H, fill: "#fff" }, mask);
    const [cx, cy, rx, ry] = L.light;
    const hole = el("ellipse", { cx, cy, rx: 0, ry: 0, fill: `url(#${id}-svj)` }, mask);
    el("rect", { width: W, height: H, fill: TABLE }, svg);
    const warm = el("ellipse", { cx, cy, rx: 0, ry: 0, fill: GOLD_WARM, opacity: 0.08 }, svg);
    const [lx, ly, lm] = L.page;
    page(svg, r, lx, ly, lm);
    const dark = el("rect", { width: W, height: H, fill: "#0b0b0a", opacity: 1, mask: `url(#${id}-maska)` }, svg);
    // things in the dark
    const all = el("g", { opacity: 0 }, svg);
    const st = (seed: number, x: RoughOptions = {}): RoughOptions => ({ stroke: SV, strokeWidth: 1.2, roughness: 1.3, bowing: 1.2, seed, ...x });
    const group = (name: Thing, [x, y, m]: Place) =>
      el("g", { transform: `translate(${x} ${y}) scale(${m})`, "data-g": name, class: s.thing! }, all);
    const add = (g: Element, n: Element) => g.appendChild(n);
    const ka = group("tabs", L.tabs);
    [0, 94, 188].forEach((x, i) => add(ka, r.path(`M${x} 44 L${x + 6} 22 H${x + 82} L${x + 88} 44`, st(10 + i))));
    add(ka, r.line(-6, 44, 282, 44, st(13)));
    const km = group("camera", L.camera);
    add(km, r.rectangle(0, 0, 60, 30, st(15)));
    add(km, r.circle(30, 15, 20, st(16)));
    add(km, r.circle(30, 15, 6, st(17)));
    add(km, r.line(30, 30, 30, 40, st(18)));
    add(km, r.line(16, 40, 44, 40, st(19)));
    const bl = group("notebook", L.notebook);
    add(bl, r.rectangle(0, 0, 150, 190, st(30)));
    for (let y = 14; y < 184; y += 20) add(bl, r.circle(10, y, 9, st(31 + y, { strokeWidth: 1 })));
    [34, 58, 82, 106, 130].forEach((y, i) => add(bl, r.line(28, y, 130 - (i % 3) * 18, y, st(50 + i, { strokeWidth: 1, roughness: 1.6 }))));
    const mo = group("phone", L.phone);
    add(mo, r.rectangle(0, 0, 92, 176, st(70)));
    add(mo, r.rectangle(8, 16, 76, 140, st(71, { strokeWidth: 1 })));
    const disc = el("g", { class: `${s.anim} ${s.disc}` }, mo);
    add(disc, r.circle(46, 70, 46, st(72)));
    add(disc, r.circle(46, 70, 8, st(73)));
    add(disc, r.line(46, 50, 46, 58, st(79, { strokeWidth: 1 })));
    add(mo, r.line(18, 124, 74, 124, st(74)));
    add(
      mo,
      r.polygon(
        [
          [38, 134],
          [38, 148],
          [50, 141],
        ],
        st(75),
      ),
    );
    const mi = group("microphone", L.microphone);
    add(mi, r.path("M20 22 a22 22 0 0 1 44 0 v42 a22 22 0 0 1 -44 0 Z", st(50)));
    [34, 48, 62].forEach((y, i) => add(mi, r.line(26, y, 58, y, st(51 + i, { strokeWidth: 0.9 }))));
    add(mi, r.path("M0 60 a42 42 0 0 0 84 0", st(55)));
    add(mi, r.line(42, 102, 42, 136, st(56)));
    add(mi, r.line(14, 138, 70, 138, st(57)));
    // notes by the phone
    for (const [x, y, i] of [
      [112, 34, 0],
      [140, 66, 1],
    ] as const) {
      add(mo, r.ellipse(x, y + 30, 13, 9, st(80 + i, { fill: SV, fillStyle: "solid" })));
      add(mo, r.line(x + 6, y + 28, x + 6, y - 4, st(82 + i)));
      add(mo, r.path(`M${x + 6} ${y - 4} q10 4 12 16`, st(84 + i)));
    }
    // a message bubble: two lines without text
    const po = group("message", L.message);
    add(po, r.path("M10 0 H110 a10 10 0 0 1 10 10 V30 a10 10 0 0 1 -10 10 H36 L22 52 L24 40 H10 a10 10 0 0 1 -10 -10 V10 a10 10 0 0 1 10 -10 Z", st(90)));
    add(po, r.line(16, 14, 96, 14, st(91, { strokeWidth: 1 })));
    add(po, r.line(16, 26, 70, 26, st(92, { strokeWidth: 1 })));
    // headphones and a cup on the desk, only in the wide view
    if (L.desk) {
      const so = group("desk", L.desk);
      add(so, r.path("M10 54 C10 4 86 4 86 54", st(94)));
      add(so, r.rectangle(0, 48, 20, 34, st(95)));
      add(so, r.rectangle(76, 48, 20, 34, st(96)));
      add(so, r.path("M130 34 H178 V62 a14 14 0 0 1 -14 14 H144 a14 14 0 0 1 -14 -14 Z", st(97)));
      add(so, r.path("M178 42 a10 10 0 0 1 0 22", st(98)));
      add(so, r.path("M146 24 q-6 -8 0 -16", st(99, { strokeWidth: 1 })));
      add(so, r.path("M160 24 q-6 -8 0 -16", st(100, { strokeWidth: 1 })));
    }
    const lines = prepare(all);
    // quiet life: still while the section is not alive, not part of the drawing
    const G = (k: Thing) => all.querySelector(`[data-g="${k}"]`);
    const line1 = (d: string, host: Element, cl: string, w = 1.2) =>
      el("path", { d, fill: "none", stroke: SV, "stroke-width": w, "stroke-linecap": "round", class: `${s.anim} ${cl}` }, host);
    const corner = (host: Element, x: number, y: number) => el("g", { transform: `translate(${x} ${y})` }, host);
    if (L.desk) {
      const so = G("desk")!;
      const steam = corner(so, 0, -8);
      for (const d of ["M146 26 q-6 -8 0 -16 q6 -8 0 -16", "M161 26 q-6 -8 0 -16 q6 -8 0 -16"]) line1(d, steam, s.steam!);
      const notes = corner(so, 0, 0);
      for (const [x, y] of [
        [-16, 40],
        [-26, 24],
        [-14, 10],
      ] as const) {
        const n = el("g", { class: `${s.anim} ${s.note}` }, notes);
        el("ellipse", { cx: x, cy: y + 10, rx: 4.6, ry: 3.4, fill: SV, transform: `rotate(-20 ${x} ${y + 10})` }, n);
        el("path", { d: `M${x + 4} ${y + 9} V${y - 6} q6 2 7 8`, fill: "none", stroke: SV, "stroke-width": 1.2 }, n);
      }
    }
    const typing = corner(G("message")!, 0, 0);
    for (const x of [84, 94, 104]) el("circle", { cx: x, cy: 26, r: 2.4, fill: SV, class: `${s.anim} ${s.dot}` }, typing);
    const waves = corner(G("microphone")!, 0, 0);
    line1("M8 10 q-9 18 0 36 M76 10 q9 18 0 36", waves, s.wave!);
    line1("M-2 2 q-14 26 0 52 M86 2 q14 26 0 52", waves, s.wave!);
    el("rect", { x: lx + 202 * lm, y: ly + 298 * lm, width: 2 * lm, height: 18 * lm, fill: INK, class: s.cursor! }, svg);
    // the tabs change by themselves, as if someone clicked them
    const tabs = corner(G("tabs")!, 0, 0);
    for (const x of [0, 94, 188])
      el("path", { d: `M${x} 44 L${x + 6} 22 H${x + 82} L${x + 88} 44 Z`, fill: SV, class: `${s.anim} ${s.tab}` }, tabs);
    // the notebook adds a line by itself
    el(
      "path",
      {
        d: "M28 154 q22 -2 45 0 t45 0",
        fill: "none",
        stroke: SV,
        "stroke-width": 1,
        "stroke-linecap": "round",
        pathLength: 1,
        "stroke-dasharray": 1,
        class: `${s.anim} ${s.line}`,
      },
      corner(G("notebook")!, 0, 0),
    );
    // labels by the things: they grow with the thing but keep the same size
    const label = (name: Thing, x: number, y: number, text: string, anchor = "middle") => {
      const g = G(name);
      const at = L[name];
      if (!g || !at) return;
      el("text", { x, y, "font-size": (L.fs / at[2]).toFixed(2), "text-anchor": anchor, class: s.label! }, g).textContent = text;
    };
    label("tabs", 0, 70, labels.tabs, "start");
    if (narrow) label("camera", 30, 60, labels.camera);
    else label("camera", -12, 24, labels.camera, "end");
    label("notebook", 75, 216, labels.notes);
    label("phone", 66, 204, labels.music);
    label("microphone", 42, 164, labels.microphone);
    label("desk", 48, 106, labels.headphones);
    if (narrow) label("message", 60, 82, labels.messages);
    else label("message", 134, 26, labels.messages, "start");
    // the line around the page: dashed, revealed behind the scissors
    const [x1, y1, x2, y2] = L.cut;
    const d = dPoly(cut(x1, y1, x2, y2, rnd, 1.6, 40));
    const reveal = el("mask", { id: id + "-otkrij", maskUnits: "userSpaceOnUse", x: -20, y: -20, width: W + 40, height: H + 40 }, defs);
    const trace = el("path", { d, fill: "none", stroke: "#fff", "stroke-width": 10 }, reveal) as SVGPathElement;
    const border = el("path", {
      d,
      fill: "none",
      stroke: "#dedbd3",
      "stroke-width": 1.6,
      "stroke-dasharray": "10 7",
      mask: `url(#${id}-otkrij)`,
      class: s.border!,
    }, svg);
    const guide = el("path", { d, fill: "none", stroke: "none" }, svg) as SVGPathElement;
    const Lt = guide.getTotalLength();
    trace.style.strokeDasharray = `${Lt} ${Lt}`;
    const sk = scissors(svg, "#faf9f5", TABLE);
    const cutTo = (t: number) => {
      trace.style.strokeDashoffset = String(Lt * (1 - t));
      const p = guide.getPointAtLength(Lt * t);
      const q = guide.getPointAtLength(Math.min(Lt, Lt * t + 2));
      const a = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
      sk.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${a})`);
      sk.setAttribute("opacity", t > 0 && t < 1 ? "1" : "0");
    };
    const light = (t: number) => {
      const e = 1 - Math.pow(1 - t, 3);
      hole.setAttribute("rx", String(rx * e));
      hole.setAttribute("ry", String(ry * e));
      warm.setAttribute("rx", String(rx * 0.88 * e));
      warm.setAttribute("ry", String(ry * 0.88 * e));
      dark.setAttribute("opacity", String(1 - 0.16 * e));
    };
    S = { cut: cutTo, light, lines, all, border, L, g: (k) => svg.querySelector(`[data-g="${k}"]`) };
    if (done) {
      light(1);
      cutTo(1);
      all.setAttribute("opacity", "1");
      all.classList.add(s.named!);
      drawTo(lines, 1);
      FADE_ORDER.forEach((k) => S!.g(k)?.classList.add(s.faded!));
    } else {
      light(0);
      cutTo(0);
    }
  };

  root.dataset.js = "";
  build();
  let cycle = 0;
  let inView = false;
  const alive = (on: boolean) => {
    if (on) root.dataset.alive = "";
    else delete root.dataset.alive;
  };
  const onNarrow = () => {
    done = done || started;
    cycle++;
    build();
    alive(done && inView);
  };
  narrowQ.addEventListener("change", onNarrow);
  // drawn each time the section enters the view; on leaving it stops and the next time starts over
  const run = async () => {
    const mine = ++cycle;
    const on = () => mine === cycle;
    started = true;
    done = false;
    alive(false);
    build();
    const b = S!;
    await wait(500);
    if (!on()) return;
    b.all.setAttribute("opacity", "1");
    void ani(1600, (t) => on() && drawTo(b.lines, t), { ease: "inOutSine" }).then(() => on() && b.all.classList.add(s.named!));
    await ani(1300, (t) => on() && b.light(t), { delay: 700, ease: "linear" });
    await wait(300);
    if (!on()) return;
    await ani(2200, (t) => on() && b.cut(t), { ease: "inOutSine" });
    await wait(200);
    // the camera tries to get into the light and bounces off the line
    const km = b.g("camera")!;
    const [kx, ky, kmm] = b.L.camera;
    const dist = b.L.cut[1] - (ky + 40 * kmm) - 1.5;
    const move = (v: number) => km.setAttribute("transform", `translate(${kx} ${ky + v}) scale(${kmm})`);
    await wait(250);
    if (!on()) return;
    await ani(650, (t) => on() && move(dist * t), { ease: "inCubic" });
    if (!on()) return;
    b.border.classList.add(s.hit!);
    setTimeout(() => b.border.classList.remove(s.hit!), 280);
    await ani(1100, (t) => on() && move(t < 1 ? dist * Math.exp(-4.5 * t) * Math.cos(3 * Math.PI * t) : 0), { ease: "linear" });
    await wait(300);
    for (const k of FADE_ORDER) {
      if (!on()) return;
      b.g(k)?.classList.add(s.faded!);
      await wait(420);
    }
    if (!on()) return;
    done = true;
    alive(true);
  };
  if (!sm && io) {
    const o = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1]!;
        if (e.intersectionRatio >= 0.3 && !inView) {
          inView = true;
          void run();
        } else if (!e.isIntersecting && inView) {
          inView = false;
          cycle++;
          alive(false);
        }
      },
      { threshold: [0, 0.3] },
    );
    o.observe(scene);
    observers.push(o);
  } else {
    done = true;
    build();
  }

  // the small drawings under the scene, drawn anew at each entry
  const drawn = [...panes.querySelectorAll<SVGSVGElement>(`.${s.small}`)].map((small, k) => {
    const g = el("g", { filter: `url(#${GRAPHITE})` }, small);
    return SMALL[k]!.map((c) => ({ ...c, path: el("path", { class: (c.gold ? s.gold : s.full)! }, g) }));
  });
  const draw = (t: number) =>
    drawn.forEach((strokes, k) => {
      const tk = k01((t - k * 0.14) / 0.72);
      const n = strokes.length;
      strokes.forEach((c, i) => {
        const r = k01(tk * n - i);
        const m = Math.round(r * c.p.length);
        c.path.setAttribute("d", m > 1 ? stroke(c.p.slice(0, m), c.s * 1.25, r >= 1) : "");
      });
    });
  let up = false;
  let round = 0;
  const light = () => {
    up = true;
    const mine = ++round;
    void ani(2200, (t) => mine === round && draw(t), { delay: 300, ease: "inOutSine" });
  };
  draw(0);
  if (sm || !io) light();
  else {
    const o = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1]!;
        if (e.intersectionRatio >= 0.35 && !up) light();
        else if (!e.isIntersecting && up) {
          up = false;
          round++;
          draw(0);
        }
      },
      { threshold: [0, 0.35] },
    );
    o.observe(panes);
    observers.push(o);
  }

  return () => {
    cycle++;
    round++;
    observers.forEach((o) => o.disconnect());
    narrowQ.removeEventListener("change", onNarrow);
    delete root.dataset.js;
    delete root.dataset.alive;
    svg.innerHTML = "";
    svg.removeAttribute("viewBox");
    panes.querySelectorAll(`.${s.small}`).forEach((x) => (x.innerHTML = ""));
  };
}
