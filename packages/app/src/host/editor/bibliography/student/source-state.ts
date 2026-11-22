/**
 * "Stanje izvora" (tools.js srcState): Treba nabaviti / Imam / Pročitano. The
 * server has no field for it, so it stays on this device, per work. A second
 * click on the same state clears it, as in the prototype.
 */
export type SourceState = "get" | "have" | "read";
export type SourceStates = Readonly<Record<string, SourceState>>;

const KEY = (documentId: string) => `ductura.editor.source-state:${documentId}`;
const VALID = new Set<string>(["get", "have", "read"]);

type Store = Pick<Storage, "getItem" | "setItem">;
const local = (): Store | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function readStates(documentId: string, store: Store | null = local()): SourceStates {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(KEY(documentId)) ?? "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === "string" && VALID.has(v))) as SourceStates;
  } catch { return {}; }
}

export function toggleState(states: SourceStates, id: string, next: SourceState): SourceStates {
  const { [id]: current, ...rest } = states;
  return current === next ? rest : { ...rest, [id]: next };
}

export function writeStates(documentId: string, states: SourceStates, store: Store | null = local()): void {
  try { store?.setItem(KEY(documentId), JSON.stringify(states)); } catch { /* the state is a convenience */ }
}

export function stateCounts(ids: readonly string[], states: SourceStates) {
  return {
    get: ids.filter((id) => states[id] === "get").length,
    unread: ids.filter((id) => states[id] !== undefined && states[id] !== "read").length,
    any: ids.some((id) => states[id] !== undefined),
  };
}
