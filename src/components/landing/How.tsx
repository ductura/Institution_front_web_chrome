"use client";

import { memo, useEffect, useRef, type CSSProperties } from "react";
import { getStroke, type StrokeOptions } from "perfect-freehand";
import rough from "roughjs";
import { annotate, annotationGroup } from "rough-notation";

import { DEFAULT_INTERFACE_LOCALE, messagesFor, type InterfaceLocale } from "../../lib/i18n/locale";

import { HOW_SAMPLE } from "./howSample";
import { HOW_SAMPLE_EN } from "./howSample.en";
import {
  BulletListIcon,
  CaretDownIcon,
  ClearFormattingIcon,
  ClockIcon,
  DocumentIcon,
  LockIcon,
  PasteIcon,
  PencilIcon,
  QuoteIcon,
  RedoIcon,
  SendIcon,
  UndoIcon,
} from "./icons";
import h from "./How.module.css";
import l from "./Landing.module.css";
import p from "./Preview.module.css";

type RoughAnnotation = ReturnType<typeof annotate>;

const fill = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

/* ---------- the example thesis: words after each session come from the text (howSample.ts, howSample.en.ts) ---------- */
type Pt = [number, number];
/** [kind, text, from session, deleted in session, pasted] */
type Block = [string, string, number, number | null, boolean];
const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;
// A thesis through a semester, October to January; each month is a quarter of the width, the curve in 1000 × 300.
// [month, day, minutes, kind: z pasted, p rewritten]
const RAW: [number, number, number, ("z" | "p")?][] = [
  [0, 3, 40], [0, 9, 55], [0, 15, 35], [0, 22, 70], [0, 29, 60],
  [1, 5, 80], [1, 12, 50, "z"], [1, 18, 75], [1, 24, 65], [1, 27, 90], [1, 30, 60],
  [2, 2, 80], [2, 6, 70], [2, 9, 95], [2, 13, 60], [2, 16, 110, "p"], [2, 20, 70],
  [3, 3, 60], [3, 7, 90], [3, 9, 80], [3, 11, 100], [3, 13, 70], [3, 14, 120], [3, 15, 250],
  [3, 17, 90], [3, 18, 60], [3, 20, 80], [3, 21, 50], [3, 22, 70], [3, 23, 45],
];
type Day = { m: number; d: number; min: number; w: number; kind?: "z" | "p" };
const MONTH_DAYS = [31, 30, 31, 31];
const dayX = (m: number, d: number) => (m + (d - 0.5) / MONTH_DAYS[m]!) * 250;
const PIN_SESSION = [0, 6, 15, 23, 29];
const VER_SUBMITTED = 41;
// Set by eye on the Croatian curve; another language moves y with its marks (a third of the curve's units).
const PIN_STYLE_HR = [
  { x: 2.2, y: 96, c: h.upRight },
  { x: 34.9, y: 79, c: h.left },
  { x: 63.3, y: 64.2, c: h.down },
  { x: 87.9, y: 31, c: h.left },
  { x: 93.7, y: 20.7, c: h.upLeft },
];
const STATIC_PATH_HR =
  "M10 290L20.2 290 25.5 285.5 68.5 285.5 74.4 279.5 116.9 279.5 122.1 277 173.4 277 179.7 267.5 229.8 267.5 235.8 258.8 287.5 258.8 294.2 247.6 345.8 247.6 348.8 243.9 348.8 226.4 351.5 222.6 395.8 222.6 402.3 213.9 445.8 213.9 452 206.4 470.8 206.4 477.8 195.2 495.8 195.2 501.8 190.2 512.1 190.2 518.8 184 544.4 184 550.7 176.5 568.5 176.5 575.7 165.3 600.8 165.3 606.8 160.3 625 160.3 627.7 156.5 632.7 192.7 657.3 192.7 663.6 182.7 770.2 182.7 776.2 175.3 802.4 175.3 809.4 162.8 818.5 162.8 825.2 152.8 834.7 152.8 842 140.3 850.8 140.3 857.1 131.6 858.9 131.6 866.9 117.9 879.3 92.9 883.1 92.9 890.1 85.4 891.1 85.4 897.1 80.5 907.3 80.5 913.9 74.2 915.3 74.2 921 70.5 923.4 70.5 929.7 65.5 931.5 65.5 937 62 975 62";
export const GRAPHITE = "how-graphite";
const GOLD = "#806529";
const TICK = "M3.5 8.5 6.5 11.5 12.5 4.5";
const SAMPLES: Record<InterfaceLocale, string> = { hr: HOW_SAMPLE, en: HOW_SAMPLE_EN };
const CLOCKS: Record<InterfaceLocale, string> = { hr: "hr-HR", en: "en-GB" };

/** The thesis, the curve and the texts of one interface language; the numbers come from that language's text. */
function build(locale: InterfaceLocale) {
  const msg = messagesFor(locale).landing;
  const tp = msg.preview;

  const BLOCKS: Block[] = SAMPLES[locale].trim()
    .split(/\r?\n/)
    .map((r) => {
      const m = /^(\d+)(?:-(\d+))? (\w+) (.*)$/.exec(r)!;
      return [m[3] === "zp" ? "p" : m[3]!, m[4]!, +m[1]!, m[2] ? +m[2] : null, m[3] === "zp"];
    });
  const inSession = (i: number) => BLOCKS.filter(([, , from, to]) => from <= i && (to == null || to > i));
  const total = (bl: Block[], f: (b: Block) => boolean = () => true) =>
    bl.reduce((z, b) => z + (f(b) ? countWords(b[1]) : 0), 0);
  const share = (i: number) => ({
    typed: total(BLOCKS, (b) => b[2] === i && !b[4]),
    pasted: total(BLOCKS, (b) => b[2] === i && b[4]),
    deleted: total(BLOCKS, (b) => b[3] === i),
  });
  const LOG: Day[] = RAW.map(([m, d, min, kind], i) => ({ m, d, min, w: total(inSession(i)), kind }));
  const N = LOG.length;
  const day = (i: number) => LOG[i]!;
  const TOTAL = day(N - 1).w;
  const PASTED_TOTAL = total(inSession(N - 1), (b) => b[4]);
  const Yr = (w: number) => Math.max(40, 290 - (w / TOTAL) * 228);
  const T: Pt[] = [[10, 290]];
  const SESSIONS: Pt[] = [];
  let PASTED = 0;
  {
    let before = 0;
    LOG.forEach(({ m, d, min, w, kind }, i) => {
      const x = dayX(m, d);
      const sw = 4 + min / 30;
      SESSIONS.push([x, sw]);
      if (kind === "z") {
        const zl = share(i).pasted;
        const a = Math.max(0, Math.min(150, w - before - zl));
        T.push([x, Yr(before)], [x + 3, Yr(before + a)]);
        PASTED = T.length - 1;
        T.push([x + 3, Yr(before + a + zl)], [x + sw, Yr(w)]);
      } else if (kind === "p") T.push([x, Yr(before)], [x + sw * 0.35, Yr(before + 150)], [x + sw, Yr(w)]);
      else T.push([x, Yr(before)], [x + sw, Yr(w)]);
      before = w;
    });
  }
  const tp_ = (i: number) => T[i]!;
  const sessionEnd = (i: number) => SESSIONS[i]![0] + SESSIONS[i]![1];
  // Marks 1 to 5: first notes, the pasted passage, the rewritten chapter, the longest session, submission.
  const MARKS: Pt[] = [
    [22, 288],
    [tp_(PASTED)[0], (tp_(PASTED - 1)[1] + tp_(PASTED + 1)[1]) / 2],
    [sessionEnd(15), Yr(day(15).w)],
    [sessionEnd(23), Yr(day(23).w)],
    [sessionEnd(29), Yr(TOTAL)],
  ];
  const MINUTES = LOG.map((d) => d.min);
  // The finished curve, for the page without script: the concept's own for Croatian, from the text for the others.
  const r1 = (v: number) => String(Math.round(v * 10) / 10);
  const STATIC_PATH =
    locale === "hr"
      ? STATIC_PATH_HR
      : [...T, [975, Yr(TOTAL)] as Pt]
          .map(([x, y], i) => `${i === 0 ? "M" : i === 1 ? "L" : ""}${r1(x)} ${r1(y)}`)
          .join(" ")
          .replace(" L", "L");

  const numbers = { total: TOTAL, pasted: share(6).pasted, cut: day(14).w - day(15).w };
  const t = {
    ...msg.how,
    chartLabel: fill(msg.how.chartLabel, numbers),
    pins: msg.how.pins.map((pin) => ({ name: pin.name, note: fill(pin.note, numbers) })),
  };

  const date = (i: number) => fill(t.date, { d: day(i).d, m: t.months[day(i).m]! });
  const duration = (m: number) =>
    m >= 60
      ? m % 60
        ? fill(t.hoursMinutes, { h: Math.floor(m / 60), m: m % 60 })
        : fill(t.hours, { h: Math.floor(m / 60) })
      : fill(t.minutes, { m });
  const clock = (d: Date) =>
    d.toLocaleTimeString(CLOCKS[locale], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  // Pasted paragraphs keep their insert numbers, in the order they stand in the work.
  const INSERT = new Map(BLOCKS.filter((b) => b[4]).map((b, k) => [b, k + 1]));

  const TOOLS = [
    { k: "undo", tip: t.tools.undo, kbd: "Ctrl+Z", Icon: UndoIcon },
    { k: "redo", tip: t.tools.redo, kbd: "Ctrl+Y", Icon: RedoIcon },
    null,
    { k: "bold", tip: t.tools.bold, kbd: "Ctrl+B", mark: tp.marks.bold, pressed: true },
    { k: "italic", tip: t.tools.italic, kbd: "Ctrl+I", mark: tp.marks.italic, pressed: true, c: p.italic },
    { k: "underline", tip: t.tools.underline, kbd: "Ctrl+U", mark: tp.marks.underline, pressed: true, c: p.underline },
    null,
    { k: "insertUnorderedList", tip: t.tools.bullets, Icon: BulletListIcon, pressed: true },
    { k: "navod", tip: t.tools.quote, Icon: QuoteIcon },
    { k: "removeFormat", tip: t.tools.clear, Icon: ClearFormattingIcon },
    null,
    { k: "umetni", tip: t.tools.paste, kbd: "Ctrl+V", Icon: PasteIcon },
  ];

  return {
    t, tp, BLOCKS, inSession, total, share, LOG, N, day, TOTAL, PASTED_TOTAL, Yr, T, PASTED, sessionEnd, MARKS, MINUTES,
    STATIC_PATH, date, duration, clock, INSERT, TOOLS,
  };
}
type Model = ReturnType<typeof build> & { PIN_STYLE: typeof PIN_STYLE_HR };
const MODELS = new Map<InterfaceLocale, Model>();
const model = (locale: InterfaceLocale): Model => {
  let m = MODELS.get(locale);
  if (!m) {
    const b = build(locale);
    const hr = locale === "hr" ? b : model("hr");
    const PIN_STYLE = PIN_STYLE_HR.map((s, k) => ({ ...s, y: s.y + (b.MARKS[k]![1] - hr.MARKS[k]![1]) / 3 }));
    MODELS.set(locale, (m = { ...b, PIN_STYLE }));
  }
  return m;
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/* ---------- strokes: perfect-freehand outline as an SVG path, a hand that slows in the corners ---------- */
const NS = "http://www.w3.org/2000/svg";
const el = (n: string, a: Record<string, string | number> = {}, parent?: Element) => {
  const e = document.createElementNS(NS, n);
  for (const k in a) e.setAttribute(k, String(a[k]));
  if (parent) parent.appendChild(e);
  return e;
};
const k01 = (v: number) => Math.min(1, Math.max(0, v));
const seeded = (s: number) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const outline = (s: number[][]) => {
  if (s.length < 4) return "";
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(s[0]![0]!)} ${f(s[0]![1]!)} Q`;
  for (let i = 0; i < s.length; i++) {
    const [x0, y0] = s[i] as Pt;
    const [x1, y1] = s[(i + 1) % s.length] as Pt;
    d += `${f(x0)} ${f(y0)} ${f((x0 + x1) / 2)} ${f((y0 + y1) / 2)} `;
  }
  return d + "Z";
};
const opts = (size: number, last: boolean, pressure = true): StrokeOptions => ({
  size,
  thinning: 0.55,
  smoothing: 0.55,
  streamline: 0.35,
  simulatePressure: pressure,
  last,
  start: { taper: size * 4, cap: true },
  end: { taper: last ? size * 5 : 0, cap: true },
});
const stroke = (pts: Pt[], o: StrokeOptions) => outline(getStroke(pts, o));
const hand = (pts: Pt[], step: number, shake: number, rnd: () => number) => {
  const o: Pt[] = [];
  const j = (a: number) => (rnd() - 0.5) * 2 * a;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i]!;
    const [x2, y2] = pts[i + 1]!;
    const n = Math.max(3, Math.round(Math.hypot(x2 - x1, y2 - y1) / step));
    for (let k = 0; k < n; k++) {
      const u = k / n;
      const e = u * u * (3 - 2 * u);
      o.push([x1 + (x2 - x1) * e + j(shake), y1 + (y2 - y1) * e + j(shake)]);
    }
  }
  o.push(pts[pts.length - 1]!);
  return o;
};
// Chaikin: the hand draws no sharp corners.
const chaikin = (q: Pt[]) => {
  const o: Pt[] = [q[0]!];
  for (let i = 0; i < q.length - 1; i++) {
    const [a, b] = q[i]!;
    const [c, d] = q[i + 1]!;
    o.push([0.75 * a + 0.25 * c, 0.75 * b + 0.25 * d], [0.25 * a + 0.75 * c, 0.25 * b + 0.75 * d]);
  }
  o.push(q[q.length - 1]!);
  return o;
};
const loop = (cx: number, cy: number, r: number, rnd: () => number) => {
  const o: Pt[] = [];
  const n = 20;
  const from = rnd() * 6.28;
  for (let i = 0; i <= n + 3; i++) {
    const a = from - (i / n) * 6.28;
    const rr = r * (1 + (rnd() - 0.5) * 0.16) + i * 0.05;
    o.push([cx + Math.cos(a) * rr * 1.1, cy + Math.sin(a) * rr]);
  }
  return o;
};

/* ---------- three small drawings beside the steps (160 × 110) ---------- */
const qb = (a: Pt, c: Pt, b: Pt, n = 14): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const s = i / n;
    const u = 1 - s;
    return [u * u * a[0] + 2 * u * s * c[0] + s * s * b[0], u * u * a[1] + 2 * u * s * c[1] + s * s * b[1]];
  });
const ln = (a: Pt, b: Pt, n = 8): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
const wave = (x1: number, x2: number, y: number, a = 2.2): Pt[] =>
  Array.from({ length: 16 }, (_, i) => [x1 + ((x2 - x1) * i) / 15, y + Math.sin(i * 1.3) * a * (i % 3 ? 1 : 0.4)]);
const circle = (cx: number, cy: number, r: number, from = -1.4, n = 24, more = 1.08): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + (i / n) * 6.28 * more;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.96];
  });
const join = (...d: Pt[][]) => d.reduce((a, b) => a.concat(b.slice(1)));
type Line = { p: Pt[]; s: number; gold?: boolean };
const DRAWINGS: Line[][] = [
  // You write: a sheet, three lines of handwriting, a pencil (gold).
  [
    { p: join(ln([30, 12], [118, 8]), ln([118, 8], [124, 100]), ln([124, 100], [36, 104]), ln([36, 104], [30, 12])), s: 2.4 },
    { p: wave(44, 106, 32), s: 1.8 },
    { p: wave(44, 100, 47), s: 1.8 },
    { p: wave(44, 86, 62), s: 1.8 },
    { p: join(ln([150, 36], [98, 76]), ln([98, 76], [88, 90]), ln([88, 90], [104, 84]), ln([104, 84], [156, 44])), s: 2.2, gold: true },
  ],
  // Ductura records: a notebook with ticks and a clock (gold).
  [
    { p: join(ln([34, 10], [116, 12]), ln([116, 12], [114, 104]), ln([114, 104], [32, 102]), ln([32, 102], [34, 10])), s: 2.4 },
    { p: ln([46, 12], [45, 102]), s: 1.4 },
    ...[0, 24, 48].map((dy) => ({ p: join(ln([54, 32 + dy], [59, 38 + dy], 3), ln([59, 38 + dy], [69, 25 + dy], 4)), s: 2.2 })),
    ...[0, 24, 48].map((dy) => ({ p: wave(76, 104 - dy / 6, 33 + dy, 1), s: 1.5 })),
    { p: circle(130, 80, 17), s: 2.2, gold: true },
    { p: join(ln([130, 69], [130, 80], 4), ln([130, 80], [138, 85], 3)), s: 2, gold: true },
  ],
  // A person decides: an eye looks at the curve (gold).
  [
    { p: qb([10, 50], [42, 18], [76, 50]), s: 2.4 },
    { p: qb([10, 50], [42, 82], [76, 50]), s: 2.4 },
    { p: circle(43, 50, 11, 0, 20, 1.05), s: 2 },
    { p: circle(44, 50, 3.5, 0, 10, 1.1), s: 3.4 },
    { p: ln([90, 96], [154, 96]), s: 1.4 },
    {
      p: join(qb([92, 92], [104, 86], [112, 82]), qb([112, 82], [122, 82], [130, 68]), qb([130, 68], [140, 54], [154, 46])),
      s: 2.4,
      gold: true,
    },
  ],
];

const ICONS = { pencil: PencilIcon, clock: ClockIcon, paste: PasteIcon, list: BulletListIcon, send: SendIcon };

/**
 * "Kako radi" (#kako): one thesis through a semester as a chart drawn by hand,
 * the work as it was after each session (the editor of the preview with the
 * teacher's column), and three steps with drawings. The markup is static, so
 * the finished curve and the steps read without script; the controller works
 * on the DOM directly, which is why the component never re-renders. The chart
 * draws itself each time it comes into view; the pointer only points.
 */
export const How = memo(function How({ locale = DEFAULT_INTERFACE_LOCALE }: { locale?: InterfaceLocale }) {
  const root = useRef<HTMLElement>(null);
  const m = model(locale);
  const { t, TOTAL, N, STATIC_PATH, PIN_STYLE, TOOLS } = m;

  useEffect(() => (root.current ? start(root.current, m) : undefined), [m]);

  return (
    <section className={`${l.section} ${h.how}`} id="kako" aria-labelledby="h-put" ref={root}>
      <div className={l.head}>
        <div className={l.eyebrow}>{t.eyebrow}</div>
        <h2 id="h-put">
          {t.titleStart}
          <br />
          {t.titleEnd}
        </h2>
        <p data-x="intro">
          {t.introStart}
          <span className={h.pencil} data-x="pencil">
            {t.introPencil}
          </span>
          {t.introMid}
          <span className={h.goldWord} data-x="gold">
            {t.introGold}
          </span>
          {t.introEnd}
        </p>
      </div>
      <figure className={h.graph} data-x="graph">
        <div className={h.paper} data-x="paper">
          <div className={h.top}>
            <span>{t.sheetTitle}</span>
            <span>
              <span className={h.words} data-x="words">
                {TOTAL}
              </span>
              {t.wordsAfter}
              <span data-x="sessions">{N}</span>
              {t.sessionsAfter}
            </span>
          </div>
          <div className={h.canvas} role="img" aria-label={t.chartLabel} data-x="canvas">
            <svg aria-hidden="true" viewBox="0 0 1000 300" preserveAspectRatio="none">
              <path
                d={STATIC_PATH}
                fill="none"
                stroke="#242422"
                strokeWidth="2.4"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {t.pins.map((pin, k) => (
              <div
                key={pin.name}
                className={`${h.pin} ${PIN_STYLE[k]!.c}`}
                style={{ "--x": PIN_STYLE[k]!.x, "--y": PIN_STYLE[k]!.y } as CSSProperties}
                aria-hidden="true"
              >
                <b>{k + 1}</b>
                {k === 1 ? (
                  <span className={h.pasted}>
                    <i className={h.pastedName} data-x="ann-pin">
                      {pin.name}
                    </i>
                    <small>{pin.note}</small>
                  </span>
                ) : (
                  <span>
                    {pin.name}
                    <small>{pin.note}</small>
                  </span>
                )}
              </div>
            ))}
            <div className={h.caption} aria-hidden="true" data-x="caption" />
          </div>
          <div className={h.months} aria-hidden="true">
            {t.months.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
          <ol className={h.list}>
            {t.pins.map((pin, k) => (
              <li key={pin.name}>
                <b>{k + 1}</b>
                <span className={k === 1 ? `${h.name} ${h.pasted}` : h.name} data-x={k === 1 ? "ann-list" : undefined}>
                  {pin.name}
                </span>
                <small>{pin.note}</small>
              </li>
            ))}
          </ol>
          <div className={h.hints}>
            <button type="button" data-x="open">
              {t.openHint}
            </button>
            <button type="button" data-x="write-open">
              {t.writeHint}
            </button>
          </div>
          <div className={h.work} role="region" aria-label={t.region} inert data-x="work">
            <div className={h.workTop}>
              <button type="button" className={`${h.btn} ${h.close} ${h.back}`} aria-label={t.back} data-x="close">
                <CaretDownIcon className={p.icon} />
                <span>{t.chart}</span>
              </button>
              <div className={h.about} aria-live="polite" data-x="about" />
              <button type="button" className={`${h.btn} ${h.back}`} aria-label={t.previous} data-x="prev">
                <CaretDownIcon className={p.icon} />
              </button>
              <button type="button" className={`${h.btn} ${h.fwd}`} aria-label={t.next} data-x="next">
                <CaretDownIcon className={p.icon} />
              </button>
            </div>
            <div
              className={h.strip}
              role="slider"
              tabIndex={0}
              aria-label={t.slider}
              aria-valuemin={1}
              aria-valuemax={N + 1}
              aria-valuenow={1}
              data-x="strip"
            >
              <svg viewBox="0 30 1000 270" preserveAspectRatio="none" aria-hidden="true" />
              <i className={h.now} data-x="now" />
            </div>
            <div className={h.window} data-lenis-prevent data-x="window">
              <div className={`${p.bar} ${h.bar}`}>
                <nav className={`${p.path} ${h.path}`} aria-label={t.path}>
                  <DocumentIcon className={p.icon} />
                  <span className={`${p.course} ${h.course}`}>{t.course}</span>
                  <span className={`${p.slash} ${h.slash}`}>/</span>
                  <b>{t.work}</b>
                </nav>
                <div className={h.switch} role="group" aria-label={t.views}>
                  <button type="button" className={`${h.option} ${h.active}`} data-p="student" aria-pressed="true">
                    {t.student}
                  </button>
                  <button type="button" className={h.option} data-p="teacher" aria-pressed="false">
                    {t.teacher}
                  </button>
                </div>
                <button type="button" className={`${p.submit} ${h.submit} ${h.write}`} data-x="write">
                  <PencilIcon className={p.icon} />
                  <span>{t.writeOn}</span>
                </button>
              </div>
              <div className={`${p.toolRow} ${h.toolRow}`}>
                <div className={p.tools} role="toolbar" aria-label={t.toolbar}>
                  {TOOLS.map((b, i) =>
                    b ? (
                      <button
                        key={b.k}
                        type="button"
                        className={`${p.tool} ${h.tool}${b.c ? ` ${b.c}` : ""}`}
                        data-kk={b.k}
                        data-tip={b.tip}
                        data-kbd={b.kbd}
                        aria-label={b.tip}
                        aria-pressed={b.pressed ? false : undefined}
                      >
                        {b.Icon ? <b.Icon className={p.icon} /> : b.mark}
                      </button>
                    ) : (
                      <i key={i} className={p.sep} aria-hidden="true" />
                    ),
                  )}
                </div>
              </div>
              <div className={h.body} data-x="body">
                <div className={h.scroll} data-x="scroll">
                  <div className={`${p.sheetFrame} ${h.sheetFrame}`}>
                    <span className={`${p.seal} ${h.seal}`} aria-hidden="true">
                      <LockIcon className={p.icon} />
                      <span data-x="seal">{t.readOnly}</span>
                    </span>
                    <article className={h.page} spellCheck={false} data-x="page" />
                  </div>
                </div>
                <aside className={`${p.side} ${h.side}`} aria-label={t.teacherSees} data-x="side" />
              </div>
              <div className={`${p.status} ${h.status}`} data-x="status" />
            </div>
          </div>
        </div>
      </figure>
      <div className={h.steps} data-x="steps">
        {t.steps.map((s) => (
          <div key={s.title}>
            <svg className={h.drawing} viewBox="0 0 160 110" aria-hidden="true" />
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </div>
        ))}
      </div>
      <div hidden data-x="icons">
        {Object.entries(ICONS).map(([k, Icon]) => (
          <Icon key={k} className={p.icon} data-ik={k} />
        ))}
      </div>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          {/* The graphite filter of the concept (proba 01), unchanged. */}
          <filter id={GRAPHITE} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves={2} seed={3} result="sum" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="sum"
              scale="2.2"
              xChannelSelector="R"
              yChannelSelector="G"
              result="drhti"
            />
            <feTurbulence type="fractalNoise" baseFrequency="2.4" numOctaves={1} seed={8} result="zrno" />
            <feColorMatrix
              in="zrno"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.9"
              result="maska"
            />
            <feComposite in="drhti" in2="maska" operator="in" />
          </filter>
        </defs>
      </svg>
      <div className={p.tip} data-x="tip" aria-hidden="true" />
    </section>
  );
});

type Live = { active: boolean; words: number; pasted: number; typed: number; deleted: number; began: number };
type Feed = { kind: "typed" | "deleted" | "pasted"; n: number; k?: number; t: Date; where: string; fresh: boolean };

/** The controller of #kako of koncepti/naslovnica; returns its cleanup. */
function start(root: HTMLElement, m: Model): () => void {
  const { t, tp, BLOCKS, inSession, total, share, LOG, N, day, TOTAL, PASTED_TOTAL, Yr, T, PASTED, sessionEnd, MARKS } = m;
  const { MINUTES, date, duration, clock, INSERT } = m;
  const ac = new AbortController();
  const on = { signal: ac.signal };
  const timeouts = new Set<number>();
  const frames = new Set<number>();
  const observers: { disconnect(): void }[] = [];
  const notes: RoughAnnotation[] = [];
  let tick = 0;
  const after = (f: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timeouts.delete(id);
      f();
    }, ms);
    timeouts.add(id);
    return id;
  };
  const raf = (f: FrameRequestCallback) => {
    const id = requestAnimationFrame((s) => {
      frames.delete(id);
      f(s);
    });
    frames.add(id);
    return id;
  };
  const $ = <T extends Element = HTMLElement>(k: string) => root.querySelector<T>(`[data-x="${k}"]`) as T;
  const all = <T extends Element = HTMLElement>(s: string, from: ParentNode = root) => [...from.querySelectorAll<T>(s)];
  const cls = (c: string) => `.${CSS.escape(c)}`;
  const sm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const icon = (k: keyof typeof ICONS) => root.querySelector(`[data-ik="${k}"]`)!.outerHTML;
  const filter = `url(#${GRAPHITE})`;

  const live: Live = { active: false, words: TOTAL, pasted: PASTED_TOTAL, typed: 0, deleted: 0, began: 0 };
  const curve = (): Pt[] => {
    if (!live.active) return [...T, [975, Yr(TOTAL)]];
    const mid = live.words - (live.pasted - PASTED_TOTAL);
    return [...T, [946, Yr(TOTAL)], [958, Yr(mid)], [960, Yr(live.words)], [975, Yr(live.words)]];
  };
  const liveGold = () => live.active && live.pasted > PASTED_TOTAL;
  const wordsAt = (y: number) => Math.round(k01((290 - y) / 228) * TOTAL);

  // Draws 0 → 1 each time a third of the target is in view and clears on leaving; with reduced motion at once.
  function play(target: Element, ms: number, step: (u: number) => void, done: () => void) {
    if (sm || !("IntersectionObserver" in window)) {
      done();
      return;
    }
    const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
    let up = false;
    let round = 0;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1]!;
        if (!e.isIntersecting && up) {
          up = false;
          round++;
          step(0);
          return;
        }
        if (e.intersectionRatio < 0.35 || up) return;
        up = true;
        const t0 = performance.now();
        const mine = ++round;
        const frame = (now: number) => {
          if (mine !== round) return;
          const u = k01((now - t0) / ms);
          step(u < 0.72 ? ease(u / 0.72) * 0.72 : u);
          if (u < 1) raf(frame);
        };
        raf(frame);
      },
      { threshold: [0, 0.35] },
    );
    io.observe(target);
    observers.push(io);
  }

  /* ---------- the chart ---------- */
  const graphEl = $("graph");
  const canvas = $("canvas");
  const svg = canvas.querySelector("svg")!;
  const pins = all(cls(h.pin!), canvas);
  const counter = $("words");
  const caption = $("caption");
  type G = {
    w: number;
    h: number;
    hk: number;
    narrow: boolean;
    size: number;
    main: Pt[];
    second: Pt[];
    z0: number;
    z1: number;
    p1: Element;
    p2: Element;
    pz: Element;
    marks: { i: number; pts: Pt[]; path: Element; dot: Element | null }[];
    marker: Element;
    ses: Pt[];
    cur: Element;
    curLine: Element;
    curDot: Element;
    zz: Element | null;
    zn: Element | null;
  };
  let G: G | null = null;
  let last = sm ? 1 : 0;
  let ann: RoughAnnotation | null = null;
  let annTarget: Element | null = null;
  let annShown = false;

  const build = () => {
    const w = canvas.clientWidth;
    if (!w) return;
    const narrow = graphEl.clientWidth <= 620;
    // Below the base line only the short month ticks, above it the curve of words.
    const TOP = narrow ? 26 : 34;
    const strip = narrow ? 12 : 16;
    const ht = Math.round(w * (narrow ? 0.78 : 0.34)) + strip;
    const hk = ht - strip;
    canvas.style.aspectRatio = `${w} / ${ht}`;
    svg.setAttribute("viewBox", `0 0 ${w} ${ht}`);
    svg.removeAttribute("preserveAspectRatio");
    svg.innerHTML = "";
    const X = (x: number) => (x / 1000) * w;
    const Y = (y: number) => TOP + ((y - 36) / 264) * (hk - TOP);
    const P = ([x, y]: Pt): Pt => [X(x), Y(y)];
    pins.forEach((pin, i) => pin.style.setProperty("--y", String((Y(MARKS[i]![1]) / ht) * 100)));

    // Word levels: quiet dashed lines with a number, so the curve can be read.
    const levels = el("g", {}, svg);
    [3000, 6000, 9000].forEach((r, i) => {
      const y = Y(Yr(r));
      el("path", { d: `M${X(20)} ${y}H${X(990)}`, stroke: "#34332f", "stroke-opacity": 0.16, "stroke-dasharray": "2 5", fill: "none" }, levels);
      const tx = el("text", { x: X(20), y: y - 5, fill: "#5c5a54", "font-size": narrow ? 10 : 11, style: "font-family: var(--ff-mono)" }, levels);
      tx.textContent = `${r}${i === 2 ? ` ${t.wordsWord}` : ""}`;
    });
    const rnd = seeded(23);
    const size = narrow ? 4.2 : 5.6;

    // Grid: the month ticks and the base line, by hand (Rough.js).
    const grid = el("g", {}, svg) as SVGGElement;
    const rc = rough.svg(svg);
    const o = { stroke: "#34332f", strokeWidth: 1, roughness: 1.4, bowing: 2 };
    [250, 500, 750].forEach((x, i) =>
      grid.appendChild(rc.line(X(x), Y(300) + 4, X(x), ht, { ...o, roughness: 0.6, bowing: 0.5, seed: 11 + i })),
    );
    grid.appendChild(rc.line(X(20), Y(300), X(990), Y(300), { ...o, strokeWidth: 0.9, roughness: 1, seed: 7 }));
    grid.style.opacity = "0.55";

    // The stroke: the main pass, a second faint pass, the gold pasted segment, loops around the marks.
    const K = curve();
    const pts = K.map(P);
    const main = hand(chaikin(chaikin(pts)), narrow ? 5 : 6, 0.5, rnd);
    const second = hand(
      chaikin(chaikin(pts.map(([x, y]): Pt => [x + (rnd() - 0.5) * 3, y + (rnd() - 0.5) * 3]))),
      8,
      1,
      rnd,
    );
    const gp = el("g", { filter }, svg);
    const p1 = el("path", { class: h.ink!, opacity: 0.92 }, gp);
    const p2 = el("path", { class: h.ink!, opacity: 0.35 }, gp);
    const pz = el("path", { class: h.gold!, opacity: 0.95 }, gp);
    const near = ([x, y]: Pt) => {
      let m = 0;
      let md = 1e9;
      main.forEach(([a, b], k) => {
        const d = Math.hypot(a - x, b - y);
        if (d < md) {
          md = d;
          m = k;
        }
      });
      return m;
    };
    const z0 = near(pts[PASTED]!);
    const z1 = near(pts[PASTED + 1]!);
    const marks = MARKS.map((mk, i) => {
      const [x, y] = main[near(P(mk))]!;
      const end = i === 4;
      return {
        i,
        pts: loop(x, y, narrow ? 6 : 7.5, rnd),
        path: el("path", { class: (end ? h.gold : h.ink)!, opacity: 0.9 }, gp),
        dot: end ? el("circle", { cx: x, cy: y, r: 3.2, class: h.gold!, opacity: 0 }, gp) : null,
      };
    });
    // The pasted passage: a gold marker over the jump of the curve (instead of a loop).
    const [ax, ay] = pts[PASTED - 1]!;
    const [bx, by] = pts[PASTED + 1]!;
    const mw = narrow ? 12 : 16;
    const marker = el("rect", { x: (ax + bx) / 2 - mw / 2, y: by - 6, width: mw, height: ay - by + 12, rx: mw / 2, fill: GOLD, opacity: 0 }, svg);
    svg.insertBefore(marker, gp);
    // The end of each session on the curve: the pointer stops there and the work opens from it.
    const ses: Pt[] = LOG.map((d, i) => [X(sessionEnd(i)), Y(Yr(d.w))]);
    // The live session: a gold jump if something was pasted and a caption by the end of the curve.
    let zz: Element | null = null;
    let zn: Element | null = null;
    if (live.active) {
      const [zx, zy] = P(K[K.length - 1]!);
      ses.push([zx, zy]);
      if (liveGold()) {
        const a = pts[K.length - 3]!;
        const b = pts[K.length - 2]!;
        const seg = Array.from({ length: 8 }, (_, k): Pt => [a[0] + ((b[0] - a[0]) * k) / 7, a[1] + ((b[1] - a[1]) * k) / 7]);
        zz = el("path", { class: h.gold!, opacity: 0, d: stroke(seg, { ...opts(size * 2.4, true), thinning: 0.2 }) }, gp);
      }
      // The caption below the curve, with a dashed line to the point, off the curve and the submission mark.
      const d = narrow ? 34 : 44;
      zn = el("g", { opacity: 0, "pointer-events": "none" }, svg);
      el("path", { d: `M${zx} ${zy + 7}V${zy + d}`, stroke: GOLD, "stroke-dasharray": "2 3", fill: "none" }, zn);
      el("circle", { cx: zx, cy: zy, r: narrow ? 3.2 : 4, fill: GOLD }, zn);
      el(
        "text",
        {
          x: zx - 4,
          y: zy + d + (narrow ? 12 : 14),
          "text-anchor": "end",
          fill: GOLD,
          "font-size": narrow ? 15 : 17,
          style: "font-family: var(--ff-manuscript); font-style: italic",
        },
        zn,
      ).textContent = t.yourSession;
    }
    const cur = el("g", { opacity: 0, "pointer-events": "none" }, svg);
    const curLine = el("path", { stroke: GOLD, "stroke-width": 1, "stroke-dasharray": "2 3", fill: "none" }, cur);
    const curDot = el("circle", { r: narrow ? 4 : 5, fill: GOLD, stroke: "#f2eee5", "stroke-width": 2.5 }, cur);
    G = { w, h: ht, hk, narrow, size, main, second, z0, z1, p1, p2, pz, marks, marker, ses, cur, curLine, curDot, zz, zn };
    draw(last, true);
  };

  const markPasted = (show: boolean) => {
    if (!G) return;
    const target = $(G.narrow ? "ann-list" : "ann-pin");
    if (annTarget !== target) {
      ann?.remove();
      ann = annotate(target, {
        type: "circle",
        color: GOLD,
        strokeWidth: 1.6,
        padding: G.narrow ? [4, 10] : [4, 12],
        animate: !sm,
        animationDuration: 650,
      });
      notes.push(ann);
      annTarget = target;
      annShown = false;
    }
    if (show && !annShown) {
      ann!.show();
      annShown = true;
    } else if (!show && annShown) {
      ann!.hide();
      annShown = false;
    }
  };

  // Three layers: the curve is written, then the pasted passage stands out, last the marks the teacher reads.
  const F1 = 0.45;
  const F2 = 0.7;
  function draw(u: number, force?: boolean) {
    if (!G) return;
    if (!force && u === last) return;
    last = u;
    const { main, second, z0, z1, size } = G;
    const n = main.length;
    const tp1 = k01(u / F1);
    const c = Math.round(tp1 * n);
    const done = tp1 >= 1;
    G.p1.setAttribute("d", c > 1 ? stroke(main.slice(0, c), opts(size, done)) : "");
    const t2 = k01((tp1 - 0.06) / 0.94);
    const c2 = Math.round(t2 * second.length);
    G.p2.setAttribute("d", c2 > 1 ? stroke(second.slice(0, c2), opts(size * 0.45, t2 >= 1)) : "");
    const front = c > 0 ? main[Math.min(c, n) - 1]! : ([0, 0] as Pt);
    counter.textContent = String(
      done ? live.words : c > 0 ? Math.min(live.words, wordsAt(36 + (front[1] / G.hk) * 264)) : 0,
    );
    G.zz?.setAttribute("opacity", done ? "0.95" : "0");
    G.zn?.setAttribute("opacity", done ? "1" : "0");
    // The gold segment thickens over the curve already written.
    G.marker.setAttribute("opacity", (0.32 * k01((u - F1 - 0.06) / 0.1)).toFixed(3));
    const tz = k01((u - F1 - 0.02) / 0.14);
    const cz = Math.round(tz * (z1 + 1 - z0));
    G.pz.setAttribute(
      "d",
      cz > 1
        ? stroke(main.slice(z0, z0 + cz), { ...opts(size * 3, tz >= 1), thinning: 0.2, start: { taper: size * 2, cap: true } })
        : "",
    );
    // Loops and captions.
    G.marks.forEach((o) => {
      const r = k01((u - F2 - o.i * 0.05) / 0.08);
      const m = o.i === 1 ? 0 : Math.round(r * o.pts.length);
      o.path.setAttribute("d", m > 1 ? stroke(o.pts.slice(0, m), opts(G!.size * 0.42, r >= 1, false)) : "");
      o.dot?.setAttribute("opacity", r >= 1 ? "0.95" : "0");
      pins[o.i]!.classList.toggle(h.shown!, r > 0.4);
    });
    markPasted(u >= F2 + 0.05 + 0.08);
    canvas.classList.toggle(h.ready!, u >= 1);
    if (u < 1) pointAt(-1);
  }

  // The pointer over the chart stops at the end of the nearest session.
  let curS = -1;
  const nearest = (e: { clientX: number }) => {
    const r = canvas.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * G!.w;
    let m = 0;
    let md = 1e9;
    G!.ses.forEach(([x], i) => {
      const d = Math.abs(x - px);
      if (d < md) {
        md = d;
        m = i;
      }
    });
    return m;
  };
  function pointAt(i: number) {
    curS = i;
    if (!G) return;
    if (i < 0) {
      G.cur.setAttribute("opacity", "0");
      caption.classList.remove(h.shown!);
      return;
    }
    const [x, y] = G.ses[i]!;
    G.curLine.setAttribute("d", `M${x} ${y + 8}V${G.hk}`);
    G.curDot.setAttribute("cx", String(x));
    G.curDot.setAttribute("cy", String(y));
    G.cur.setAttribute("opacity", "1");
    caption.style.setProperty("--x", String((x / G.w) * 100));
    caption.style.setProperty("--y", String((y / G.h) * 100));
    caption.innerHTML = `<b>${i < N ? date(i) : t.now}</b> ${fill(t.words, { n: i < N ? day(i).w : live.words })}`;
    caption.classList.add(h.shown!);
  }
  const ready = () => last >= 1;
  const pinSpan = (e: Event) => (e.target as Element).closest(`${cls(h.pin!)} span`);

  const open = work(() => {
    build();
    $("sessions").textContent = String(G ? G.ses.length : N);
  });

  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (!ready() || e.pointerType === "touch" || pinSpan(e)) {
        if (curS >= 0 && pinSpan(e)) pointAt(-1);
        return;
      }
      const i = nearest(e);
      if (i !== curS) pointAt(i);
    },
    on,
  );
  canvas.addEventListener("pointerleave", () => pointAt(-1), on);
  canvas.addEventListener(
    "click",
    (e) => {
      if (!ready()) return;
      const pin = (e.target as Element).closest<HTMLElement>(cls(h.pin!));
      const i = pin ? PIN_SESSION[pins.indexOf(pin)]! : nearest(e);
      pointAt(-1);
      open(i, e.clientX, e.clientY);
    },
    on,
  );
  canvas.tabIndex = 0;
  canvas.addEventListener(
    "keydown",
    (e) => {
      if (!ready() || !G) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        pointAt(Math.max(0, Math.min(G.ses.length - 1, (curS < 0 ? 0 : curS) + (e.key === "ArrowRight" ? 1 : -1))));
      } else if ((e.key === "Enter" || e.key === " ") && curS >= 0) {
        e.preventDefault();
        const r = canvas.getBoundingClientRect();
        const [x, y] = G.ses[curS]!;
        open(curS, r.left + (x / G.w) * r.width, r.top + (y / G.h) * r.height);
      }
    },
    on,
  );
  canvas.addEventListener("blur", () => pointAt(-1), on);
  all(`${cls(h.list!)} li`).forEach((li, k) => {
    li.style.cursor = "pointer";
    li.addEventListener("click", (e) => open(PIN_SESSION[k]!, e.clientX, e.clientY), on);
  });
  $("open").addEventListener("click", (e) => open(0, e.clientX, e.clientY), on);
  $("write-open").addEventListener("click", (e) => open(N, e.clientX, e.clientY), on);

  /* ---------- the open work: the text as it was after each session ---------- */
  function sheetHtml(i: number, history: boolean) {
    let n = 0;
    let html = "";
    let ul = false;
    let wasDel = false;
    let firstPasted = true;
    const bl = history ? BLOCKS.filter(([, , from, to]) => from <= i && (to == null || to >= i)) : inSession(i);
    bl.forEach((b) => {
      const [v, text, from, to, z] = b;
      const deleted = history && to === i;
      const fresh = history && from === i && !deleted;
      const kl = [fresh && h.fresh, z && history && h.zl, deleted && h.deleted, (fresh || deleted) && h.enter]
        .filter(Boolean)
        .join(" ");
      const at = `${kl ? ` class="${kl}"` : ""}${fresh || deleted ? ` style="--n:${n++}"` : ""}`;
      let note = "";
      if (history && z && firstPasted) {
        note = `<span class="${h.note}">${fill(t.pastedNote, { d: date(from), n: share(from).pasted })}</span>`;
        firstPasted = false;
      }
      if (deleted && !wasDel) {
        const o = v === "li" ? t.deletedNotes : t.deletedChapter;
        if (v === "li") {
          if (ul) {
            html += "</ul>";
            ul = false;
          }
          html += `<p class="${h.note} ${h.deletedNote}">${o}</p>`;
        } else note = `<span class="${h.note} ${h.deletedNote}">${o}</span>`;
      }
      wasDel = deleted;
      if (v === "li" && !ul) {
        html += "<ul>";
        ul = true;
      } else if (v !== "li" && ul) {
        html += "</ul>";
        ul = false;
      }
      const tx = z ? `<span class="${h.insert}" data-i="${INSERT.get(b)}">${esc(text)}</span>` : esc(text);
      if (v === "pod") html += `<p class="${h.sub}">${tx}</p>`;
      else if (v === "li") html += `<li${at}>${tx}</li>`;
      else if (v === "q") html += `<blockquote${at}>${note}${tx}</blockquote>`;
      else if (v === "p") html += `<p${at}>${note}${tx}</p>`;
      else html += `<${v}${at}>${tx}</${v}>`;
    });
    if (ul) html += "</ul>";
    return { html, n };
  }

  function work(refresh: () => void) {
    const paper = $("paper");
    const panel = $("work");
    const about = $("about");
    const win = $("window");
    const page = $("page");
    const scroll = $("scroll");
    const body = $("body");
    const side = $("side");
    const status = $("status");
    const seal = $("seal");
    const strip = $("strip");
    const nowEl = $("now");
    const tsvg = strip.querySelector("svg")!;
    const prev = $<HTMLButtonElement>("prev");
    const next = $<HTMLButtonElement>("next");
    const close = $("close");
    const ends = [...LOG.map((_, i) => sessionEnd(i)), 975];
    const ORIGINAL = new Set(inSession(N - 1).map((b) => norm(b[1])));
    const INSERT_SEL = cls(h.insert!);
    let s = -1;
    let opened = false;
    let from: Element | null = null;
    let byKey = false;
    let view = "student";
    let liveHtml: string | null = null;
    let ver = VER_SUBMITTED;
    let saveTimer = 0;
    let sideFrame = 0;
    const feed: Feed[] = [];
    // The focus ring returns only when the work was opened from the keyboard.
    root.addEventListener("pointerdown", () => (byKey = false), { capture: true, signal: ac.signal });
    root.addEventListener("keydown", () => (byKey = true), { capture: true, signal: ac.signal });

    // The strip: a thin curve of the whole work and a tick per session; the last is the live one, gold what was pasted in it.
    const tPath = el("path", { fill: "none", stroke: "#5c5a54", "stroke-width": 1.4, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" }, tsvg);
    const tGold = el("path", { fill: "none", stroke: GOLD, "stroke-width": 3, "stroke-linecap": "round", "vector-effect": "non-scaling-stroke" }, tsvg);
    el("path", { d: ends.map((x) => `M${x} 300V284`).join(""), stroke: "#34332f", "stroke-opacity": 0.35, "vector-effect": "non-scaling-stroke" }, tsvg);
    const stripDraw = () => {
      const K = curve();
      tPath.setAttribute("d", "M" + K.map(([x, y]) => `${x} ${y}`).join("L"));
      const a = K[K.length - 3]!;
      const b = K[K.length - 2]!;
      tGold.setAttribute("d", liveGold() ? `M${a[0]} ${a[1]}L${b[0]} ${b[1]}` : "");
    };

    const isLive = () => s === N;
    const editing = () => isLive() && view === "student" && opened;
    const wordsNow = (i: number) => (i === N ? live.words : day(i).w);
    const inPage = () => page.contains(getSelection()?.anchorNode ?? null);

    /* The teacher's column. */
    const insertsHtml = (um: [string | number, string][]) =>
      um.length
        ? `<ul class="${p.inserts}">${um
            .map(
              ([k, x]) =>
                `<li><button type="button" data-um="${k}"><span class="${p.num}">${k}</span><span class="${p.excerpt}">${esc(x)}</span><span class="${p.chars}">${fill(t.words, { n: countWords(x) })}</span></button></li>`,
            )
            .join("")}</ul>`
        : `<p class="${p.none} ${h.none}">${t.noInserts}</p>`;
    const sideShow = () => {
      const i = s;
      const z = isLive();
      let w: number;
      let um: number;
      let ses: number;
      let min: number;
      let rows: [string, string | number][];
      let ume: [string | number, string][];
      if (z) {
        w = live.words;
        um = live.pasted;
        ses = N + 1;
        min = MINUTES.reduce((a, b) => a + b, 0) + Math.floor((Date.now() - live.began) / 60000);
        rows = [
          [t.duration, `<span data-x="lasts">${mmss(Date.now() - live.began)}</span>`],
          [t.typedRow, `+${live.typed}`],
          [t.deletedRow, live.deleted ? `−${live.deleted}` : "0"],
          [t.pastedRow, Math.max(0, live.pasted - PASTED_TOTAL)],
        ];
        const src =
          view === "student"
            ? page
            : (() => {
                const d = document.createElement("div");
                d.innerHTML = liveHtml ?? "";
                return d;
              })();
        ume = all(INSERT_SEL, src).map((e) => [e.dataset.i ?? "", e.textContent ?? ""]);
      } else {
        const bl = inSession(i);
        const u = share(i);
        w = day(i).w;
        um = total(bl, (b) => b[4]);
        ses = i + 1;
        min = MINUTES.slice(0, i + 1).reduce((a, b) => a + b, 0);
        rows = [
          [t.duration, duration(MINUTES[i]!)],
          [t.typedRow, `+${u.typed}`],
          [t.deletedRow, u.deleted ? `−${u.deleted}` : "0"],
          [t.pastedRow, u.pasted],
        ];
        ume = bl.filter((b) => b[4]).map((b) => [INSERT.get(b)!, b[1]]);
      }
      const typed = w - um;
      const pct = w ? Math.round((typed / w) * 100) : 100;
      const changed = live.typed + live.deleted + Math.max(0, live.pasted - PASTED_TOTAL) > 0;
      const head = (k: keyof typeof ICONS, title: string) => `<span class="${p.heading}">${icon(k)}${title}</span>`;
      side.innerHTML = `<section><h4>${head("pencil", t.origin)}${z ? `<span class="${h.liveTag}"><i class="${h.liveDot}" aria-hidden="true"></i>${t.live}</span>` : `<span>${date(i)}</span>`}</h4>
      <div class="${p.big} ${h.big}"><b>${pct} %</b><span>${t.typedIn}</span></div>
      <div class="${p.ratio}" aria-hidden="true"><i style="width:${pct}%"></i><i style="width:${100 - pct}%"></i></div>
      <dl class="${p.legend}"><div><dt><i></i>${t.typed}</dt><dd>${fill(t.words, { n: typed })}</dd></div><div><dt><i class="${p.pasted}"></i>${t.inserted}</dt><dd>${fill(t.words, { n: um })}</dd></div><div><dt><i class="${p.versions}"></i>${t.sessions}</dt><dd>${ses}, ${duration(min)}</dd></div></dl></section>
      <section><h4>${head("clock", z ? t.thisSession : t.thatSession)}<span>${z ? t.now : fill(t.ofN, { i: i + 1, n: N })}</span></h4>
      <dl class="${p.legend} ${p.plain}">${rows.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}${a === t.duration ? "" : ` ${t.wordsWord}`}</dd></div>`).join("")}</dl></section>
      <section><h4>${head("paste", t.inserts)}<span>${ume.length}</span></h4>${insertsHtml(ume)}</section>
      ${z ? `<section><h4>${head("list", t.happening)}</h4>${feed.length ? `<ol class="${h.feed}">${feed.slice(-8).reverse().map((e) => `<li class="${[e.kind === "pasted" ? h.feedPasted : e.kind === "deleted" ? h.feedDeleted : "", e.fresh ? h.recent : ""].filter(Boolean).join(" ")}"><time>${clock(e.t)}</time><span>${e.kind === "pasted" ? fill(t.feedPasted, { n: `<b>${e.n}</b>`, k: e.k ?? "" }) : e.kind === "deleted" ? fill(t.feedDeleted, { n: `<b>−${e.n}</b>` }) : fill(t.feedTyped, { n: `<b>+${e.n}</b>` })}${e.where ? `<small>${esc(e.where)}</small>` : ""}</span></li>`).join("")}</ol>` : `<p class="${p.none} ${h.none}">${t.feedEmpty}</p>`}</section>` : ""}
      <section><h4>${head("send", t.submission)}</h4>${z || i === N - 1 ? `<dl class="${p.legend} ${p.plain}"><div><dt>${t.submittedLabel}</dt><dd>${t.submittedAt}</dd></div><div><dt>${t.version}</dt><dd>${VER_SUBMITTED}</dd></div></dl>${z && changed ? `<p class="${h.after}">${fill(t.changedAfter, { n: ver })}</p>` : ""}` : `<p class="${p.none} ${h.none}">${t.notSubmitted}</p>`}</section>`;
      feed.forEach((e) => (e.fresh = false));
    };
    side.addEventListener(
      "click",
      (e) => {
        const b = (e.target as Element).closest<HTMLElement>("[data-um]");
        if (!b) return;
        const u = page.querySelector<HTMLElement>(`${INSERT_SEL}[data-i="${b.dataset.um}"]`);
        if (!u) return;
        const sc = body.scrollHeight > body.clientHeight + 2 ? body : scroll;
        const r = u.getBoundingClientRect();
        const rs = sc.getBoundingClientRect();
        sc.scrollTo({ top: sc.scrollTop + r.top - rs.top - rs.height / 3, behavior: sm ? "auto" : "smooth" });
        u.classList.add(h.glow!);
        after(() => u.classList.remove(h.glow!), 1600);
      },
      on,
    );

    /* The head and the status bar. */
    const header = () => {
      const i = s;
      if (isLive()) {
        const r = live.words - TOTAL;
        const writing = live.typed + live.deleted + live.pasted - PASTED_TOTAL > 0;
        about.innerHTML = `<b>${t.now}</b><span>${fill(t.session, { n: N + 1 })}</span><span>${fill(t.words, { n: live.words })}${r ? ` (${r > 0 ? "+" : "−"}${Math.abs(r)})` : ""}</span><span class="${h.event}">${writing ? t.youWrite : t.startWriting}</span>`;
      } else {
        const { min, w } = day(i);
        const diff = w - (i ? day(i - 1).w : 0);
        const k = PIN_SESSION.indexOf(i);
        about.innerHTML = `<b>${date(i)}</b><span>${fill(t.sessionOf, { i: i + 1, n: N })}</span><span>${duration(min)}</span><span>${fill(t.words, { n: w })} (${diff > 0 ? "+" : "−"}${Math.abs(diff)})</span>${k >= 0 ? `<span class="${h.event}">${t.pins[k]!.name}</span>` : ""}`;
      }
      const w = wordsNow(i);
      nowEl.style.setProperty("--x", String(ends[i]! / 10));
      nowEl.style.setProperty("--y", String((Yr(w) - 30) / 2.7));
      strip.setAttribute("aria-valuenow", String(i + 1));
      strip.setAttribute("aria-valuetext", fill(t.sliderText, { d: i === N ? t.now : date(i), n: w }));
      prev.disabled = i === 0;
      next.disabled = i === N;
    };
    const statusShow = () => {
      const i = s;
      status.innerHTML = isLive()
        ? `<span class="${p.saved}" data-x="saved"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="${TICK}"/></svg><span data-x="state" role="status">${tp.saved}</span></span><span>${t.versionWord} <b data-x="ver">${ver}</b></span><span><b data-x="count">${live.words}</b> ${t.wordsWord}</span><span class="${p.session} ${h.session} ${h.narrowHide}"><i class="${p.pulse}" aria-hidden="true"></i>${t.sessionWord} <b data-x="clock">${mmss(Date.now() - live.began)}</b></span><span class="${p.right} ${h.narrowHide}"><button type="button" class="${p.paste} ${h.paste}" data-kk="umetni">${icon("paste")}<span>${t.pasteShort}</span></button></span>`
        : `<span>${date(i)}</span><span><b>${day(i).w}</b> ${t.wordsWord}</span><span class="${h.narrowHide}">${fill(t.sessionOf, { i: i + 1, n: N })}</span><span class="${p.right}">${i === N - 1 ? t.submittedPrefix : ""}${t.readOnly}</span>`;
    };

    /* The sheet. */
    const plain = () => {
      page.removeAttribute("contenteditable");
      page.removeAttribute("role");
      page.removeAttribute("aria-multiline");
      page.removeAttribute("aria-label");
    };
    const markNew = () =>
      all(":scope > *, :scope > ul > li, :scope > ol > li", page).forEach((e) => {
        if (e.matches("ul, ol")) return;
        const x = norm(e.textContent ?? "");
        if (x && !ORIGINAL.has(x)) e.classList.add(h.fresh!);
      });
    const pageShow = () => {
      const i = s;
      if (isLive()) {
        if (liveHtml == null) liveHtml = sheetHtml(N - 1, false).html;
        page.innerHTML = liveHtml;
        if (view === "student") {
          page.contentEditable = "true";
          page.setAttribute("role", "textbox");
          page.setAttribute("aria-multiline", "true");
          page.setAttribute("aria-label", t.editorLabel);
        } else {
          plain();
          markNew();
        }
      } else {
        plain();
        const { html, n } = sheetHtml(i, true);
        page.innerHTML =
          html +
          `<p class="${h.end}">${i === N - 1 ? fill(t.sheetSubmitted, { v: VER_SUBMITTED }) : ""}${fill(t.sheetWords, { n: day(i).w })}${n ? t.sheetChanged : ""}</p>`;
      }
      seal.textContent = isLive() ? t.teacherView : t.readOnly;
    };

    const show = (i: number, force?: boolean) => {
      const changed = i !== s;
      s = i;
      win.classList.toggle(h.live!, isLive());
      win.classList.toggle(h.teach!, isLive() && view === "teacher");
      win.classList.toggle(h.reading!, !isLive() || view === "teacher");
      header();
      if (!changed && !force) return;
      if (isLive() && !live.began) live.began = Date.now();
      pageShow();
      statusShow();
      sideShow();
      toolState();
      const first = page.querySelector(cls(h.enter!));
      if (first && opened) {
        const r = first.getBoundingClientRect();
        const rt = scroll.getBoundingClientRect();
        if (r.top < rt.top || r.bottom > rt.bottom)
          scroll.scrollTo({ top: scroll.scrollTop + r.top - rt.top - 40, behavior: sm ? "auto" : "smooth" });
      }
    };

    /* Writing: each change goes at once to the figures, the strip, the teacher's column and (on closing) the chart. */
    const where = () => {
      let n = getSelection()?.anchorNode ?? null;
      if (!n || !page.contains(n)) return "";
      while (n && n.parentNode !== page) n = n.parentNode;
      for (let e = n as Element | null; e; e = e.previousElementSibling)
        if (/^H[2-4]$/.test(e.tagName)) return e.textContent ?? "";
      return "";
    };
    const record = (kind: Feed["kind"], n: number, k?: number) => {
      const now = new Date();
      const z = feed[feed.length - 1];
      if (z && z.kind === kind && kind !== "pasted" && now.getTime() - z.t.getTime() < 5000) {
        z.n += n;
        z.t = now;
        z.fresh = true;
      } else feed.push({ kind, n, k, t: now, where: where(), fresh: true });
    };
    const BLOCK = /^(P|H[1-6]|LI|BLOCKQUOTE|DIV|UL|OL|BR)$/;
    const textOf = (node: Node) => {
      let x = "";
      const walk = (m: Node) => {
        for (const c of m.childNodes) {
          if (c.nodeType === 3) x += (c as Text).data;
          else if (c.nodeType === 1) {
            const b = BLOCK.test((c as Element).tagName);
            if (b) x += " ";
            walk(c);
            if (b) x += " ";
          }
        }
      };
      walk(node);
      return x;
    };
    const wordsOf = (node: Node) => countWords(textOf(node));
    const pastedOf = (node: ParentNode) => all(INSERT_SEL, node).reduce((z, e) => z + wordsOf(e), 0);
    const recount = (k?: number) => {
      const w = wordsOf(page);
      const um = pastedOf(page);
      const dUm = um - live.pasted;
      const dTyped = w - live.words - dUm;
      if (dTyped > 0) {
        live.typed += dTyped;
        record("typed", dTyped);
      }
      const del = Math.max(0, -dTyped) + Math.max(0, -dUm);
      if (del) {
        live.deleted += del;
        record("deleted", del);
      }
      if (dUm > 0) record("pasted", dUm, k);
      live.words = w;
      live.pasted = um;
      liveHtml = page.innerHTML;
      if (live.typed + live.deleted + Math.abs(live.pasted - PASTED_TOTAL) > 0) live.active = true;
      // Saving: the tick redraws when writing settles, and each saved change is a new version.
      const st = status.querySelector('[data-x="saved"]');
      if (st) {
        st.classList.add(p.saving!);
        st.classList.remove(p.redraw!);
        st.querySelector('[data-x="state"]')!.textContent = t.saving;
      }
      clearTimeout(saveTimer);
      saveTimer = after(() => {
        ver++;
        const sv = status.querySelector('[data-x="saved"]');
        if (!sv) return;
        sv.classList.remove(p.saving!);
        sv.classList.add(p.redraw!);
        sv.querySelector('[data-x="state"]')!.textContent = tp.saved;
        status.querySelector('[data-x="ver"]')!.textContent = String(ver);
        sideShow();
      }, 1200);
      const br = status.querySelector('[data-x="count"]');
      if (br) br.textContent = String(w);
      header();
      stripDraw();
      cancelAnimationFrame(sideFrame);
      frames.delete(sideFrame);
      sideFrame = raf(sideShow);
    };
    page.addEventListener(
      "input",
      () => {
        if (editing()) recount();
      },
      on,
    );
    const insert = (x: string) => {
      if (!editing()) return;
      const k = Math.max(0, ...all(INSERT_SEL, page).map((e) => +(e.dataset.i ?? 0) || 0)) + 1;
      const sp = document.createElement("span");
      sp.className = h.insert!;
      sp.dataset.i = String(k);
      sp.textContent = x;
      const sel = getSelection()!;
      let r: Range;
      if (sel.rangeCount && inPage()) r = sel.getRangeAt(0);
      else {
        const end = all("p", page).pop() ?? page;
        r = document.createRange();
        r.selectNodeContents(end);
        r.collapse(false);
      }
      r.deleteContents();
      r.insertNode(sp);
      sp.before(" ");
      sp.after(" ");
      const c = document.createRange();
      c.setStartAfter(sp.nextSibling!);
      c.collapse(true);
      sel.removeAllRanges();
      sel.addRange(c);
      recount(k);
    };
    page.addEventListener(
      "paste",
      (e) => {
        if (!editing()) return;
        e.preventDefault();
        const x = norm(e.clipboardData ? e.clipboardData.getData("text/plain") : "");
        if (x) insert(x);
      },
      on,
    );
    page.addEventListener("drop", (e) => e.preventDefault(), on);
    // The toolbar and the button in the status bar: editor commands; a button does not take the focus from the sheet.
    win.addEventListener(
      "mousedown",
      (e) => {
        if ((e.target as Element).closest("[data-kk]")) e.preventDefault();
      },
      on,
    );
    win.addEventListener(
      "click",
      (e) => {
        const b = (e.target as Element).closest<HTMLElement>("[data-kk]");
        if (!b || !editing()) return;
        const k = b.dataset.kk!;
        if (k === "umetni") {
          insert(t.excerpt);
          return;
        }
        if (!inPage()) page.focus();
        if (k === "navod")
          document.execCommand(
            "formatBlock",
            false,
            document.queryCommandValue("formatBlock") === "blockquote" ? "p" : "blockquote",
          );
        else document.execCommand(k);
        toolState();
      },
      on,
    );
    const PRESSED = all("[aria-pressed]", win.querySelector(cls(p.tools!))!);
    function toolState() {
      const u = editing() && inPage();
      PRESSED.forEach((b) =>
        b.setAttribute("aria-pressed", u && document.queryCommandState(b.dataset.kk!) ? "true" : "false"),
      );
    }
    document.addEventListener(
      "selectionchange",
      () => {
        if (opened && isLive()) toolState();
      },
      on,
    );
    const options = all(`${cls(h.switch!)} [data-p]`, win);
    options.forEach((b) =>
      b.addEventListener(
        "click",
        () => {
          if (view === b.dataset.p) return;
          view = b.dataset.p!;
          options.forEach((x) => {
            x.classList.toggle(h.active!, x === b);
            x.setAttribute("aria-pressed", String(x === b));
          });
          show(s, true);
        },
        on,
      ),
    );
    $("write").addEventListener(
      "click",
      () => {
        show(N);
        scroll.scrollTop = 0;
        page.focus({ preventScroll: true });
      },
      on,
    );

    /* Tooltip: the tool's name and shortcut; after the first, neighbours show at once. */
    const tip = $("tip");
    let tipTimer = 0;
    let tipLast = 0;
    const showTip = (g: HTMLElement) => {
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
      tip.classList.add(p.shown!);
    };
    const hideTip = () => {
      clearTimeout(tipTimer);
      if (tip.classList.contains(p.shown!)) tipLast = Date.now();
      tip.classList.remove(p.shown!);
    };
    all("[data-tip]", win).forEach((g) => {
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

    const openAt = (i: number, cx: number, cy: number) => {
      const r = paper.getBoundingClientRect();
      paper.style.setProperty("--ox", `${cx - r.left}px`);
      paper.style.setProperty("--oy", `${cy - r.top}px`);
      from = document.activeElement;
      s = -1;
      stripDraw();
      show(i);
      scroll.scrollTop = 0;
      body.scrollTop = 0;
      const f = page.querySelector<HTMLElement>(cls(h.enter!));
      if (f) scroll.scrollTop = Math.max(0, f.offsetTop - 60);
      panel.inert = false;
      paper.classList.add(h.open!);
      opened = true;
      clearInterval(tick);
      tick = window.setInterval(() => {
        if (!isLive()) return;
        const d = mmss(Date.now() - live.began);
        all('[data-x="clock"], [data-x="lasts"]', panel).forEach((e) => (e.textContent = d));
      }, 1000);
      // When the sheet grows, it is brought whole into view.
      after(
        () => {
          const v = paper.getBoundingClientRect();
          if (v.top < 0 || v.bottom > innerHeight)
            paper.scrollIntoView({ block: v.height > innerHeight ? "start" : "nearest", behavior: sm ? "auto" : "smooth" });
        },
        sm ? 0 : 650,
      );
      after(
        () => {
          if (i === N && view === "student") page.focus({ preventScroll: true });
          else close.focus({ preventScroll: true });
        },
        sm ? 0 : 350,
      );
    };
    const closeWork = () => {
      if (!opened) return;
      opened = false;
      clearInterval(tick);
      paper.classList.remove(h.open!);
      panel.inert = true;
      hideTip();
      if (live.active) refresh();
      if (from instanceof HTMLElement || from instanceof SVGElement)
        from.focus({ preventScroll: true, focusVisible: byKey } as FocusOptions);
    };

    close.addEventListener("click", closeWork, on);
    prev.addEventListener("click", () => s > 0 && show(s - 1), on);
    next.addEventListener("click", () => s < N && show(s + 1), on);
    panel.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          closeWork();
        }
      },
      on,
    );
    strip.addEventListener(
      "keydown",
      (e) => {
        const k = ({ ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 } as Record<string, number>)[e.key];
        if (k) {
          e.preventDefault();
          show(Math.max(0, Math.min(N, s + k)));
        } else if (e.key === "Home" || e.key === "End") {
          e.preventDefault();
          show(e.key === "Home" ? 0 : N);
        }
      },
      on,
    );
    // Dragging along the strip leafs through the sessions.
    const onStrip = (e: PointerEvent) => {
      const r = strip.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 1000;
      let m = 0;
      let md = 1e9;
      ends.forEach((k, i) => {
        const d = Math.abs(k - x);
        if (d < md) {
          md = d;
          m = i;
        }
      });
      if (m !== s) show(m);
    };
    strip.addEventListener(
      "pointerdown",
      (e) => {
        strip.setPointerCapture(e.pointerId);
        onStrip(e);
      },
      on,
    );
    strip.addEventListener(
      "pointermove",
      (e) => {
        if (strip.hasPointerCapture(e.pointerId)) onStrip(e);
      },
      on,
    );
    return openAt;
  }

  build();
  let width = canvas.clientWidth;
  const ro = new ResizeObserver(() => {
    if (canvas.clientWidth !== width) {
      width = canvas.clientWidth;
      build();
    }
  });
  ro.observe(graphEl);
  observers.push(ro);
  // Draws itself each time a third of the chart is in view; the pointer and scrolling do not touch the drawing.
  play(graphEl, 7000, draw, () => draw(1, true));

  /* ---------- the drawings beside the steps ---------- */
  {
    const lines = all<SVGSVGElement>(cls(h.drawing!)).map((s, k) => {
      const g = el("g", { filter }, s);
      return DRAWINGS[k]!.map((c) => ({ ...c, path: el("path", { class: (c.gold ? h.gold : h.ink)! }, g) }));
    });
    const sketch = (u: number) =>
      lines.forEach((strokes, k) => {
        const tk = k01((u - k * 0.12) / 0.76);
        const n = strokes.length;
        strokes.forEach((c, i) => {
          const r = k01(tk * n - i);
          const m = Math.round(r * c.p.length);
          c.path.setAttribute("d", m > 1 ? stroke(c.p.slice(0, m), { ...opts(c.s * 1.25, r >= 1), thinning: 0.5 }) : "");
        });
      });
    sketch(0);
    play($("steps"), 2400, sketch, () => sketch(1));
  }

  /* ---------- the lead: "pencil" underlined in graphite, "gold" in gold, anew at each entry ---------- */
  {
    const intro = $("intro");
    const color = (v: string) => getComputedStyle(root).getPropertyValue(v).trim();
    const a = [
      annotate($("pencil"), { type: "underline", color: color("--ink"), strokeWidth: 1.6, padding: 1, iterations: 2, animate: !sm, animationDuration: 700 }),
      annotate($("gold"), { type: "underline", color: color("--accent"), strokeWidth: 3, padding: 1, iterations: 1, animate: !sm, animationDuration: 500 }),
    ];
    notes.push(...a);
    const group = annotationGroup(a);
    if (sm || !("IntersectionObserver" in window)) group.show();
    else {
      let shown = false;
      const io = new IntersectionObserver(
        (entries) => {
          const e = entries[entries.length - 1]!;
          if (e.intersectionRatio >= 0.6 && !shown) {
            shown = true;
            group.show();
          } else if (!e.isIntersecting && shown) {
            shown = false;
            a.forEach((x) => x.hide());
          }
        },
        { threshold: [0, 0.6] },
      );
      io.observe(intro);
      observers.push(io);
    }
  }

  root.classList.add(h.js!);

  return () => {
    ac.abort();
    observers.forEach((o) => o.disconnect());
    timeouts.forEach(clearTimeout);
    frames.forEach(cancelAnimationFrame);
    clearInterval(tick);
    notes.forEach((n) => n.remove());
    root.classList.remove(h.js!);
  };
}
