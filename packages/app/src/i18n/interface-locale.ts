import { isUiLocale, type UiLocale } from "@ductura/ui";

/**
 * The saved interface language of the signed-in person (DAN-427, M11.5):
 * `profile.interface-locale.get` and `.post` of the published contract, always
 * through `src/client` (no-direct-api). The call is injected, so a test hands
 * in createApi over a fake transport.
 */
type Result = { readonly ok: boolean; readonly status: number; readonly body?: unknown };
export type LocaleCall = (id: "profile.interface-locale.get" | "profile.interface-locale.post", input: {
  params: undefined; query: undefined; body: { locale: UiLocale } | undefined;
}) => Promise<Result>;

export type LocaleRead =
  | { readonly kind: "saved"; readonly locale: UiLocale | null }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export type LocaleSave = { readonly kind: "saved"; readonly locale: UiLocale } | { readonly kind: "signedOut" } | { readonly kind: "failed" };

function localeOf(body: unknown): UiLocale | null | undefined {
  if (body === null || typeof body !== "object" || !("locale" in body)) return undefined;
  const { locale } = body as { locale: unknown };
  return locale === null || isUiLocale(locale) ? locale : undefined;
}

export async function readInterfaceLocale(call: LocaleCall): Promise<LocaleRead> {
  try {
    const result = await call("profile.interface-locale.get", { params: undefined, query: undefined, body: undefined });
    if (result.ok) {
      const locale = localeOf(result.body);
      return locale === undefined ? { kind: "unavailable" } : { kind: "saved", locale };
    }
    return result.status === 401 ? { kind: "signedOut" } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function saveInterfaceLocale(call: LocaleCall, locale: UiLocale): Promise<LocaleSave> {
  try {
    const result = await call("profile.interface-locale.post", { params: undefined, query: undefined, body: { locale } });
    if (result.ok) {
      const saved = localeOf(result.body);
      return saved === undefined || saved === null ? { kind: "failed" } : { kind: "saved", locale: saved };
    }
    return result.status === 401 ? { kind: "signedOut" } : { kind: "failed" };
  } catch {
    return { kind: "failed" };
  }
}

/** Key of the browser's copy, so the next page paints in the saved language before the server answers. */
export const LOCALE_KEY = "ductura.interface-locale";

type KeyStore = Pick<Storage, "getItem" | "setItem">;

export function readStoredLocale(storage: KeyStore | undefined): UiLocale | null {
  try {
    const value = storage?.getItem(LOCALE_KEY);
    return isUiLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeLocale(storage: KeyStore | undefined, locale: UiLocale): void {
  try {
    storage?.setItem(LOCALE_KEY, locale);
  } catch {
    // Storage blocked: the language holds for this page and comes from the server on the next.
  }
}
