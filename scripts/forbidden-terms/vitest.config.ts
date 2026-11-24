import { defineConfig } from "vitest/config";

// Each scan.test.ts case copies locales/ into a temporary directory and
// imports the modules afresh, which takes about 400 ms locally and can exceed
// the default 5 s on a loaded CI runner. Assertions are unchanged; only the
// per-test deadline is raised.
export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20_000,
  },
});
