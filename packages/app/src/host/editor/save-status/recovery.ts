const PREFIX = "ductura:editor-exit:";

export type ExitCopy = {
  readonly assignmentId: string;
  readonly at: number;
  readonly text: string | null;
};

const scopePrefix = (scope: string) => `${PREFIX}${scope}:`;

export function copyStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function keepExitCopy(storage: Storage | null, scope: string, copy: ExitCopy): boolean {
  if (!storage) return false;
  try {
    const id = copy.text === null ? "journal" : crypto.randomUUID();
    storage.setItem(`${scopePrefix(scope)}${encodeURIComponent(copy.assignmentId)}:${id}`, JSON.stringify(copy));
    return true;
  } catch {
    return false;
  }
}

function exitKeys(storage: Storage, prefix: string): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

export function hasExitCopies(storage: Storage): boolean {
  try {
    return exitKeys(storage, PREFIX).length > 0;
  } catch {
    return false;
  }
}

export function readExitCopies(storage: Storage, scope: string) {
  return exitKeys(storage, scopePrefix(scope)).flatMap((key) => {
    try {
      const copy: Partial<ExitCopy> | null = JSON.parse(storage.getItem(key) ?? "null");
      if (!copy || typeof copy.assignmentId !== "string" || !copy.assignmentId ||
          typeof copy.at !== "number" || !(copy.at > 0 && copy.at <= 8.64e15) ||
          (copy.text !== null && typeof copy.text !== "string")) return [];
      const { assignmentId, at, text } = copy;
      return [{ key, copy: { assignmentId, at, text } }];
    } catch {
      return [];
    }
  }).sort((a, b) => b.copy.at - a.copy.at);
}
