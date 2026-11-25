import { expect, it } from "vitest";

import { markOnboardingSeen, onboardingKey, onboardingSeen } from "./seen";

const memory = () => {
  const saved = new Map<string, string>();
  return { saved, storage: () => ({
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => { saved.set(key, value); },
  }) };
};

it("ED-05 (NF2-P20): showing the guide marks nothing; only finishing or skipping it does, per account", () => {
  const { saved, storage } = memory();
  const student = onboardingKey("a".repeat(64));
  const nextStudent = onboardingKey("b".repeat(64));
  expect(onboardingSeen(student, storage)).toBe(false);
  // Shown and left (page closed, Esc): still not seen, so it comes back with the next visit.
  expect(onboardingSeen(student, storage)).toBe(false);
  expect([...saved.values()]).toEqual([]);
  markOnboardingSeen(student, storage);
  expect(onboardingSeen(student, storage)).toBe(true);
  expect(onboardingSeen(nextStudent, storage)).toBe(false);
  expect([...saved.values()]).toEqual(["1"]);
});

it("when the browser refuses storage, a finished guide stays finished for this page", () => {
  const blocked = () => { throw new DOMException("Storage disabled", "SecurityError"); };
  const key = onboardingKey("c".repeat(64));
  expect(onboardingSeen(key, blocked)).toBe(false);
  markOnboardingSeen(key, blocked);
  expect(onboardingSeen(key, blocked)).toBe(true);
});
