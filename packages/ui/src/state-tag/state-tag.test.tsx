import { renderToStaticMarkup as html } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StateTag, STATE_TAG_STATES, SUBMISSION_STATES } from "./index";

describe("StateTag (WEB-29)", () => {
  it("shows the Croatian text of every state beside its colour", () => {
    const texts = STATE_TAG_STATES.map((state) => {
      const m = html(<StateTag state={state} />);
      expect(m).toMatch(new RegExp(`data-state="${state}"`));
      return m.replace(/<span aria-hidden="true"[^>]*>[^<]*<\/span>/, "").replace(/<[^>]+>/g, "");
    });
    expect(texts).toEqual(["Predano", "Nije predano", "Nakon roka", "Čeka potvrdu", "Praznina u zapisu", "U pisanju", "Obavijest nije potvrđena"]);
    expect(SUBMISSION_STATES).toHaveLength(5);
  });

  it("hides the mark from assistive technology, so only the text is read", () => {
    const m = html(<StateTag state="late" />);
    expect(m).toMatch(/<span aria-hidden="true"[^>]*>!<\/span>Nakon roka/);
  });

  it("hides the mark of the states before submission too", () => {
    expect(html(<StateTag state="writing" />)).toMatch(/<span aria-hidden="true"[^>]*>…<\/span>U pisanju/);
    expect(html(<StateTag state="notice_pending" />)).toMatch(/<span aria-hidden="true"[^>]*>◌<\/span>Obavijest nije potvrđena/);
  });
});
