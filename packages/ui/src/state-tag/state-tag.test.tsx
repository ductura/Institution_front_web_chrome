import { renderToStaticMarkup as html } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StateTag, SUBMISSION_STATES } from "./index";

describe("StateTag (WEB-29)", () => {
  it("shows the Croatian text of every state beside its colour", () => {
    const texts = SUBMISSION_STATES.map((state) => {
      const m = html(<StateTag state={state} />);
      expect(m).toMatch(new RegExp(`data-state="${state}"`));
      return m.replace(/<span aria-hidden="true"[^>]*>[^<]*<\/span>/, "").replace(/<[^>]+>/g, "");
    });
    expect(texts).toEqual(["Predano", "Nije predano", "Nakon roka", "Čeka potvrdu", "Praznina u zapisu"]);
  });

  it("hides the mark from assistive technology, so only the text is read", () => {
    const m = html(<StateTag state="late" />);
    expect(m).toMatch(/<span aria-hidden="true"[^>]*>!<\/span>Nakon roka/);
  });
});
