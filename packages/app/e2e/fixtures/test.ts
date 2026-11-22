// LOK-WEB-26: the shared fake institution server of the host e2e. Every test
// page answers each /api/v1 operation of the server contract with a default
// from the contract's own vectors (contract-api.ts). It is registered before
// the spec's routes, and Playwright tries the latest route first, so a spec's
// page.route overrides it and route.fallback() hands a request back to it.
// A request outside the contract, or to an operation without a default,
// throws, which fails the test with the request named.
import { test as base } from "@playwright/test";

import { generatedDefaults } from "./contract-api";

export { expect, type Page, type Route } from "@playwright/test";

const defaults = generatedDefaults();

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("**/api/v1/**", (route) => {
      const request = route.request();
      const { pathname } = new URL(request.url());
      const match = defaults.operation(request.method(), pathname);
      if (match === null) throw new Error(`Unexpected fake API request ${request.method()} ${pathname} (not in the server contract)`);
      if (match.answer === null) throw new Error(`Fake API request ${request.method()} ${pathname} (${match.operation}) has no default; fake it in the spec`);
      const { status, contentType, body } = match.answer;
      return route.fulfill({ status, contentType, body });
    });
    await use(page);
  },
});
