import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Unavailable } from "./StudentBibliographyHost";
import { bibliographyStudentHr as t } from "./messages.hr";

const COURSE = "0f0e0d0c-0b0a-4908-8706-050403020115";
const render = (courseId: string | null | undefined) =>
  renderToStaticMarkup(createElement(Unavailable, { assignmentId: undefined, courseId }));

describe("F4-PM1-R05 required literature in the bibliography card", () => {
  it("with a course reads the required literature (data-required-literature) instead of the 'not available' sentence", () => {
    const html = render(COURSE);
    expect(html).toContain("data-required-literature");
    expect(html).not.toContain(t.mandatoryUnavailable);
  });
  it("without a course (unknown assignment, failed read) says honestly that it is not available", () => {
    for (const none of [null, undefined]) {
      const html = render(none);
      expect(html).toContain(t.mandatoryUnavailable);
      expect(html).not.toContain("data-required-literature");
    }
  });
});
