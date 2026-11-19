// Ported from Ductus src/components/shell/route-loading.test.ts at 078c780f
// (DAN-753); the checks of app/**/loading.tsx wait for the web's routes.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messagesHr as t } from "../../../locales/hr.ts";

import { RouteLoading } from "@ductura/ui";

describe("route loading (#732 item 4)", () => {
  it("announces the wait in the page's main, without a session mark", () => {
    const html = renderToStaticMarkup(
      createElement(RouteLoading, { label: t.fastPath.loading }),
    );
    expect(html).toContain('id="sadrzaj"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(`<p role="status">${t.fastPath.loading}</p>`);
    expect(html).not.toContain("<h1");
  });
});
