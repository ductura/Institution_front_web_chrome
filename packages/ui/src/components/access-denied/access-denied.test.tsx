// @vitest-environment jsdom
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { AccessDenied, type AccessDeniedLabels } from "./AccessDenied";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels: AccessDeniedLabels = {
  title: { denied: "Nema ovlasti", expired: "Prijava je istekla", signedOut: "Potrebna je prijava" },
  body: { denied: "Sadržaj nije dostupan s ovim računom.", expired: "Prijava je istekla zbog neaktivnosti.", signedOut: "Prijavite se." },
  signIn: "Prijava preko AAI@EduHr",
  heldNote: "Neposlani unos čuva se na ovom uređaju.",
  home: "Na početnu",
};
const props = { labels, signInHref: "/api/v1/auth/login?returnTo=%2Fzadaci", homeHref: "/app/web/" };

describe("AccessDenied markup", () => {
  it("denied: one heading, a way home and no sign-in", () => {
    const html = renderToStaticMarkup(<AccessDenied kind="denied" {...props} />);
    expect(html).toContain('data-access="denied"');
    expect(html).toContain("<h1>Nema ovlasti</h1>");
    expect(html).toContain('href="/app/web/"');
    expect(html).not.toContain("AAI@EduHr");
    expect(html).not.toContain("<form");
  });

  it("expired: sign-in link to the login route, and the kept-input note only when something is kept", () => {
    const kept = renderToStaticMarkup(<AccessDenied kind="expired" holdsInput {...props} />);
    expect(kept).toContain('href="/api/v1/auth/login?returnTo=%2Fzadaci"');
    expect(kept).toContain("Neposlani unos čuva se na ovom uređaju.");
    expect(renderToStaticMarkup(<AccessDenied kind="expired" {...props} />)).not.toContain("Neposlani unos");
    expect(renderToStaticMarkup(<AccessDenied kind="signedOut" holdsInput {...props} />)).not.toContain("Neposlani unos");
  });

  it("denied text does not depend on what was asked for", () => {
    expect(renderToStaticMarkup(<AccessDenied kind="denied" {...props} />)).toBe(renderToStaticMarkup(<AccessDenied kind="denied" {...props} holdsInput />));
  });
});

describe("AccessDenied accessibility", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

  it.each(["denied", "expired", "signedOut"] as const)("%s has no axe violation", async (kind) => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => root?.render(<AccessDenied kind={kind} holdsInput {...props} />));
    const result = await axe.run(host, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
