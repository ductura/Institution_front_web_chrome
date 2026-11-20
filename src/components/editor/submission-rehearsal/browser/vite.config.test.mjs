import { fileURLToPath } from "node:url";
import { copiedFrontAliases } from "../../../vitest.alias.ts";

export default {
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: [
    { find: "next/navigation", replacement: fileURLToPath(new URL("../../../../../catalog/src/next-navigation.ts", import.meta.url)) },
    ...copiedFrontAliases,
  ] },
};
