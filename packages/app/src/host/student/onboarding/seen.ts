const seenHere = new Set<string>();

export function onboardingKey(scope: string) {
  return `ductura:editor-onboarding:v1:${scope}`;
}

/** Claim before displaying, including when the page is left without using Skip. */
export function claimOnboarding(key: string, storage: () => Pick<Storage, "getItem" | "setItem">) {
  try {
    const store = storage();
    if (store.getItem(key) === "1") return false;
    store.setItem(key, "1");
    return true;
  } catch {
    if (seenHere.has(key)) return false;
    seenHere.add(key);
    return true;
  }
}
