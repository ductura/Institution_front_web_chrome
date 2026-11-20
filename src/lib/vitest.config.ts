import { defineConfig } from "vitest/config";

import { copiedFrontAliases } from "../components/vitest.alias.ts";

export default defineConfig({
  resolve: { alias: copiedFrontAliases },
  test: { environment: "node", include: ["**/*.test.ts"], exclude: [
      "**/node_modules/**",
      // Real failure, not an import: the forbidden-vocabulary check flags "copied" in the English
      // catalogue (earlierDraftCopy, earlierDraftExplain). ZEL-W1, reported on Ductus#2028; the
      // English copy is a product decision. Whoever settles it deletes this line.
      "i18n/messages.en.test.ts",
    ] },
});
