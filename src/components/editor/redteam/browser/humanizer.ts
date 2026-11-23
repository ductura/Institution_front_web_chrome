/**
 * Red-team: plan of "human-looking" typing for a text an AI wrote.
 *
 * Turns a finished text into a sequence of key actions with the timing,
 * typos, corrections and pauses of a person typing it. It never touches a
 * browser: the red-team browser test plays the plan through trusted key events.
 * Seeded, so a run can be repeated exactly.
 */

export type Action =
  | { kind: "char"; ch: string; waitMs: number }
  | { kind: "enter"; waitMs: number }
  | { kind: "backspace"; waitMs: number };

export type HumanizerOptions = {
  /** Mean typing speed in words per minute (5 characters a word). */
  wpm: number;
  /** Chance per letter of hitting a neighbouring key and correcting it. */
  typoRate: number;
  /** Chance per word of typing part of it, deleting it and typing it again. */
  reviseRate: number;
  /** Chance per sentence of a long "thinking" pause. */
  thinkRate: number;
  seed: number;
};

export const DEFAULT_OPTIONS: HumanizerOptions = {
  wpm: 45,
  typoRate: 0.03,
  reviseRate: 0.02,
  thinkRate: 0.15,
  seed: 1,
};

/** mulberry32: small, fast, seedable. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Log-normal around `mean` with spread `sigma`: right-skewed like real intervals. */
function lognormal(random: () => number, mean: number, sigma: number): number {
  const u = Math.max(random(), 1e-9);
  const v = random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean * Math.exp(sigma * z - (sigma * sigma) / 2);
}

/** Croatian QWERTZ neighbours, for plausible typos. */
const ROWS = ["1234567890", "qwertzuiopšđ", "asdfghjklčćž", "yxcvbnm"];
const NEIGHBOURS = new Map<string, string[]>();
ROWS.forEach((row, r) => {
  [...row].forEach((key, c) => {
    const near: string[] = [];
    for (const [dr, dc] of [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, -1]]) {
      const other = ROWS[r + dr]?.[c + dc];
      if (other) near.push(other);
    }
    NEIGHBOURS.set(key, near);
  });
});

function typoFor(ch: string, random: () => number): string | null {
  const lower = ch.toLowerCase();
  const near = NEIGHBOURS.get(lower);
  if (!near?.length) return null;
  const wrong = near[Math.floor(random() * near.length)];
  return ch === lower ? wrong : wrong.toUpperCase();
}

/** The plan for `text`, as a person would type it. */
export function plan(text: string, options: Partial<HumanizerOptions> = {}): Action[] {
  const o = { ...DEFAULT_OPTIONS, ...options };
  const random = rng(o.seed);
  const meanMs = 60_000 / (o.wpm * 5);
  const key = () => Math.max(25, lognormal(random, meanMs, 0.45));
  const actions: Action[] = [];
  const type = (ch: string, waitMs = key()) =>
    actions.push(ch === "\n" ? { kind: "enter", waitMs } : { kind: "char", ch, waitMs });
  const back = (waitMs = key()) => actions.push({ kind: "backspace", waitMs });

  const tokens = text.match(/\s+|[^\s]+/g) ?? [];
  let sentenceStart = true;
  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      // A paragraph break is one Enter (the editor makes the paragraph) after
      // the longest pause of ordinary writing; other whitespace is a space.
      if (token.includes("\n")) type("\n", lognormal(random, 2500, 0.6));
      else type(" ", key() * 1.3);
      continue;
    }
    if (sentenceStart && random() < o.thinkRate) {
      // Reads back, thinks: a long pause before the sentence starts
      // (a "char" with no character is a pause alone).
      actions.push({ kind: "char", ch: "", waitMs: lognormal(random, 6000, 0.7) });
    }
    sentenceStart = /[.!?…]$/.test(token);

    if (token.length > 3 && random() < o.reviseRate) {
      // Types part of the word, changes its mind, deletes it and goes on.
      const part = Math.ceil(token.length * (0.4 + random() * 0.5));
      for (const ch of token.slice(0, part)) type(ch);
      back(lognormal(random, 700, 0.5));
      for (let i = 1; i < part; i += 1) back(lognormal(random, 90, 0.3));
    }

    for (const ch of token) {
      const wrong = /\p{L}/u.test(ch) && random() < o.typoRate ? typoFor(ch, random) : null;
      if (wrong) {
        type(wrong);
        if (random() < 0.35) {
          // Noticed one key later.
          type(ch);
          back(lognormal(random, 350, 0.4));
          back(lognormal(random, 110, 0.3));
        } else {
          back(lognormal(random, 300, 0.4));
        }
      }
      type(ch, /[,;:]/.test(ch) ? key() * 1.5 : key());
    }
  }
  return actions;
}

/** Where Croatian letters sit on a Croatian keyboard (KeyboardEvent.code). */
export const CROATIAN_CODES: Record<string, string> = {
  č: "Semicolon", ć: "Quote", ž: "Backslash", š: "BracketLeft", đ: "BracketRight",
};

type Keyboard = { type(text: string): Promise<void>; press(key: string): Promise<void> };

/**
 * Plays a plan through `keyboard` (trusted events), with time scaled by
 * `speed`. Playwright's `type` sends letters outside the US layout (č, ć, ž,
 * š, đ) as text with no key behind them; a Croatian keyboard sends a key for
 * each, so when `layoutKey` is given those letters go through it instead.
 */
export async function play(
  keyboard: Keyboard,
  wait: (ms: number) => Promise<void>,
  actions: Action[],
  speed = 1,
  layoutKey?: (ch: string) => Promise<void>,
): Promise<void> {
  for (const action of actions) {
    await wait(action.waitMs / speed);
    if (action.kind === "enter") await keyboard.press("Enter");
    else if (action.kind === "backspace") await keyboard.press("Backspace");
    else if (!action.ch) continue;
    else if (layoutKey && CROATIAN_CODES[action.ch.toLowerCase()]) await layoutKey(action.ch);
    else await keyboard.type(action.ch);
  }
}

/** A key of the Croatian layout through the Chrome DevTools Protocol (trusted). */
export function cdpLayoutKey(cdp: { send(method: string, params: object): Promise<unknown> }) {
  return async (ch: string) => {
    const code = CROATIAN_CODES[ch.toLowerCase()];
    const shift = ch !== ch.toLowerCase();
    const base = { key: ch, code, modifiers: shift ? 8 : 0, windowsVirtualKeyCode: 0 };
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", text: ch, unmodifiedText: ch, ...base });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
  };
}

/** Short statistics of a plan, for the report. */
export function summary(actions: Action[]) {
  const totalMs = actions.reduce((sum, a) => sum + a.waitMs, 0);
  return {
    tipke: actions.filter((a) => a.kind !== "char" || a.ch).length,
    backspace: actions.filter((a) => a.kind === "backspace").length,
    minuta: +(totalMs / 60_000).toFixed(1),
  };
}
