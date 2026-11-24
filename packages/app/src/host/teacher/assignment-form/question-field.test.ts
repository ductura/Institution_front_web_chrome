// @vitest-environment jsdom
// NF-4 NZ-15: the question beside the declaration in the assignment form, honest until a route sets it.
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { declarationQuestionHr as t } from "./messages.hr";
import { DECLARATION_QUESTION_MAX_CHARS, QuestionField } from "./QuestionField";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("QuestionField (NZ-15)", () => {
  it("is disabled, names its limit and says that asking is not available yet", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => { root.render(createElement(QuestionField)); });
    const area = host.querySelector("textarea")!;
    expect(area.disabled).toBe(true);
    expect(host.querySelector("label")?.textContent).toContain(t.label);
    expect(host.textContent).toContain(`Do ${DECLARATION_QUESTION_MAX_CHARS} znakova.`);
    expect(host.textContent).toContain(t.unavailable);
    act(() => root.unmount());
    host.remove();
  });
});
