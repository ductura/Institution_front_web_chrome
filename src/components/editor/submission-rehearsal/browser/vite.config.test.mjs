import { fileURLToPath } from "node:url";
import { copiedFrontAliases } from "../../../vitest.alias.ts";

export default {
  oxc: { jsx: { runtime: "automatic" } },
  optimizeDeps: { entries: ["src/components/editor/submission-rehearsal/browser/fixture.spec.tsx"] },
  resolve: { alias: [
    { find: "next/navigation", replacement: fileURLToPath(new URL("../../../../../catalog/src/next-navigation.ts", import.meta.url)) },
    ...copiedFrontAliases,
  ] },
};
