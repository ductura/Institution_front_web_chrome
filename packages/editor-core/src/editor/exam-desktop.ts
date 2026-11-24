/**
 * Exam mode and the Ductura desktop app for Windows (P-4 proposal, status PRIJEDLOG).
 *
 * In the browser, keys a program sends outside it are trusted keys and pass exam mode. The desktop app can
 * tell them apart and drops them before they reach the page (Desktop_windows, ExamKeyGate). This bridge tells
 * the app when an exam starts and ends, and passes on how many keys it dropped, so exam mode can say why text
 * did not appear. Through window.chrome.webview (WebView2) only; in a browser it does nothing.
 *
 * The app accepts the message only from Ductura's own web address. It sends back a number only: no key,
 * no time, no program.
 */

export type DesktopMessageEvent = { data: unknown };

/** The part of window.chrome.webview (WebView2) the bridge uses. */
export type DesktopWebView = {
  postMessage(message: unknown): void;
  addEventListener(type: "message", handler: (event: DesktopMessageEvent) => void): void;
  removeEventListener(type: "message", handler: (event: DesktopMessageEvent) => void): void;
};

/** window.chrome.webview inside the desktop app, null in a browser. */
export function desktopWebView(scope: unknown = globalThis): DesktopWebView | null {
  const webview = (scope as { chrome?: { webview?: unknown } } | null)?.chrome?.webview;
  if (typeof webview !== "object" || webview === null) return null;
  const w = webview as Partial<DesktopWebView>;
  return typeof w.postMessage === "function" && typeof w.addEventListener === "function" &&
    typeof w.removeEventListener === "function" ? (w as DesktopWebView) : null;
}

export type DesktopExamOptions = {
  webview: DesktopWebView;
  /** An approved accommodation: the app then drops nothing (the on-screen keyboard and dictation send keys too). */
  accommodation: boolean;
  /** How many more keys the app dropped since the last report. */
  onBlocked: (newlyBlocked: number) => void;
};

/** Turns the app's exam mode on; the returned function turns it off. */
export function connectExamToDesktop(options: DesktopExamOptions): () => void {
  const { webview, accommodation, onBlocked } = options;
  let reported = 0;
  const handler = (event: DesktopMessageEvent) => {
    const data = event.data as { type?: unknown; count?: unknown } | null;
    if (typeof data !== "object" || data === null || data.type !== "ductura-keys-blocked") return;
    const count = data.count;
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count <= reported) return;
    const fresh = count - reported;
    reported = count;
    onBlocked(fresh);
  };
  webview.addEventListener("message", handler);
  webview.postMessage({ type: "ductura-exam", on: true, accommodation });
  let open = true;
  return () => {
    if (!open) return;
    open = false;
    webview.removeEventListener("message", handler);
    webview.postMessage({ type: "ductura-exam", on: false, accommodation });
  };
}