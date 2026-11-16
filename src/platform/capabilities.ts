import type { MessageKey } from "../../locales/hr.ts";

/**
 * What this browser can do, probed by feature, never by user agent (web
 * PLAN §1). Every probe runs inside try/catch: a probe that throws reports
 * the fallback, so a caller never sees an exception from here.
 */

/**
 * The parts of `window` the probes read; pass `window` itself, not methods
 * taken off it (a detached `matchMedia` throws and reads as `fine`). Tests
 * pass a fake of this shape.
 */
export interface PlatformEnv {
  navigator?: {
    clipboard?: { writeText?: (text: string) => Promise<void> };
    permissions?: { query?: (descriptor: { name: string }) => Promise<{ state: string }> };
  };
  document?: {
    createElement?: (tag: "textarea") => ClipboardScratch;
    body?: { appendChild(node: unknown): unknown; removeChild(node: unknown): unknown } | null;
    execCommand?: (command: string) => boolean;
    queryCommandSupported?: (command: string) => boolean;
    activeElement?: { focus?(options?: { preventScroll?: boolean }): void } | null;
  };
  indexedDB?: unknown;
  matchMedia?: (query: string) => { matches: boolean };
}

/** The textarea `writeClipboard` selects for the `execCommand` fallback. */
export interface ClipboardScratch {
  value: string;
  style?: { position?: string; opacity?: string; insetBlockStart?: string; insetInlineStart?: string };
  setAttribute?(name: string, value: string): void;
  select(): void;
}

export interface Capabilities {
  /** `async`: Clipboard API; `exec-command`: legacy copy; `none`: neither. */
  clipboard: "async" | "exec-command" | "none";
  /** The Permissions API answers queries. */
  permissions: boolean;
  /** `indexeddb` only says the factory exists; `probeIndexedDb` says it opens. */
  storage: "indexeddb" | "none";
  /** `coarse` for touch as the primary pointer, otherwise `fine`. */
  pointer: "coarse" | "fine";
}

const CLIPBOARD_FAILED = "workspace.earlierDraftCopyFailed" satisfies MessageKey;

export type ClipboardResult =
  | { ok: true; via: "async" | "exec-command" }
  | { ok: false; messageKey: typeof CLIPBOARD_FAILED };

export type PermissionAnswer = "granted" | "denied" | "prompt" | "unknown";

function probe<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

function hasExecCopy(env: PlatformEnv): boolean {
  return probe(() => {
    const doc = env.document;
    if (typeof doc?.execCommand !== "function" || typeof doc.createElement !== "function" || !doc.body) {
      return false;
    }
    return typeof doc.queryCommandSupported === "function" ? doc.queryCommandSupported("copy") === true : true;
  }, false);
}

export function detectCapabilities(env: PlatformEnv): Capabilities {
  const asyncClipboard = probe(() => typeof env.navigator?.clipboard?.writeText === "function", false);
  return {
    clipboard: asyncClipboard ? "async" : hasExecCopy(env) ? "exec-command" : "none",
    permissions: probe(() => typeof env.navigator?.permissions?.query === "function", false),
    storage: probe(() => (env.indexedDB != null ? "indexeddb" : "none"), "none"),
    pointer: probe(
      () => (typeof env.matchMedia === "function" && env.matchMedia("(pointer: coarse)").matches === true ? "coarse" : "fine"),
      "fine",
    ),
  };
}

function execCopy(text: string, env: PlatformEnv): boolean {
  const doc = env.document;
  if (!doc?.createElement || !doc.body || !doc.execCommand) return false;
  const scratch = doc.createElement("textarea");
  scratch.value = text;
  scratch.setAttribute?.("readonly", "");
  scratch.setAttribute?.("aria-hidden", "true");
  if (scratch.style) Object.assign(scratch.style, { position: "fixed", opacity: "0", insetBlockStart: "0", insetInlineStart: "0" });
  // select() moves focus to the scratch node; give it back afterwards, so the
  // editor keeps its caret (and a phone keeps its keyboard).
  const focused = doc.activeElement ?? null;
  doc.body.appendChild(scratch);
  let copied = false;
  try {
    scratch.select();
    copied = doc.execCommand("copy") === true;
  } finally {
    // Cleanup never turns a copy that worked into a failure.
    try {
      doc.body.removeChild(scratch);
    } catch {
      // Already removed.
    }
    try {
      focused?.focus?.({ preventScroll: true });
    } catch {
      // The old focus is gone.
    }
  }
  return copied;
}

/**
 * Puts text on the clipboard: the Clipboard API first, then the legacy copy
 * command when the API is missing or refused (no permission, no user gesture,
 * insecure context). When both fail the caller gets the catalogue key of the
 * warning that offers export instead; it never throws.
 */
export async function writeClipboard(text: string, env: PlatformEnv): Promise<ClipboardResult> {
  try {
    const write = env.navigator?.clipboard?.writeText;
    if (typeof write === "function") {
      await write.call(env.navigator!.clipboard, text);
      return { ok: true, via: "async" };
    }
  } catch {
    // Refused or failed: fall through to the legacy command.
  }
  if (probe(() => hasExecCopy(env) && execCopy(text, env), false)) return { ok: true, via: "exec-command" };
  return { ok: false, messageKey: CLIPBOARD_FAILED };
}

/**
 * The state of a permission, or `unknown` when the browser cannot say: no
 * Permissions API (Safari before 16, some WebViews), a name it does not know
 * (Firefox rejects `clipboard-write`), or an answer outside the three states.
 */
export async function permissionState(name: string, env: PlatformEnv): Promise<PermissionAnswer> {
  try {
    const query = env.navigator?.permissions?.query;
    if (typeof query !== "function") return "unknown";
    const { state } = await query.call(env.navigator!.permissions, { name });
    return state === "granted" || state === "denied" || state === "prompt" ? state : "unknown";
  } catch {
    return "unknown";
  }
}
