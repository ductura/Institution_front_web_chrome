import { expect, it } from "vitest";

import { claimOnboarding, onboardingKey } from "./seen";

it("claims once per account across page visits", () => {
  const saved = new Map<string, string>();
  const storage = () => ({
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => { saved.set(key, value); },
  });
  const student = onboardingKey("a".repeat(64));
  const nextStudent = onboardingKey("b".repeat(64));
  expect(claimOnboarding(student, storage)).toBe(true);
  expect(claimOnboarding(student, storage)).toBe(false);
  expect(claimOnboarding(nextStudent, storage)).toBe(true);
  expect([...saved.values()]).toEqual(["1", "1"]);
});

it("keeps the first view usable when the browser refuses storage", () => {
  const blocked = () => { throw new DOMException("Storage disabled", "SecurityError"); };
  const key = onboardingKey("c".repeat(64));
  expect(claimOnboarding(key, blocked)).toBe(true);
  expect(claimOnboarding(key, blocked)).toBe(false);
});
