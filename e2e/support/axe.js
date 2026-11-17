// axe nad cijelom stranicom, prenesen iz Ductus e2e/local-editor.spec.ts:189 i
// e2e/offline-editor.spec.ts:65 (b36c82b9): WCAG 2.0 i 2.1, razine A i AA.
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Kršenja koja axe nalazi na stranici, s tim oznakama. */
export async function axeViolations(page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations;
}

/** Ductusova tvrdnja: nijedno kršenje. */
export async function axe(page) {
  expect(await axeViolations(page)).toEqual([]);
}
