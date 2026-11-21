import { copiedFrontAliases } from "../../../vitest.alias.ts";

export default {
  oxc: { jsx: { runtime: "automatic" } },
  optimizeDeps: { entries: ["src/components/editor/print-export/browser/fixture.spec.tsx"] },
  resolve: { alias: copiedFrontAliases },
};
