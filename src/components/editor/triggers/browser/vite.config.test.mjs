import { fileURLToPath } from "node:url";

// This loopback server is used only by the Playwright editor fixture.
export default {
  root: fileURLToPath(new URL("./", import.meta.url)),
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: {
    "@/domain/sync": fileURLToPath(new URL("../../../../../packages/editor-core/src/sync", import.meta.url)),
    "@/lib/i18n": fileURLToPath(new URL("../../../../lib/i18n", import.meta.url)),
  } },
  server: { host: "127.0.0.1", port: 5306, strictPort: true,
    fs: { allow: [fileURLToPath(new URL("../../../../../", import.meta.url))] } },
};
