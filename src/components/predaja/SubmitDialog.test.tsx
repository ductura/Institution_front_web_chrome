import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messagesHr } from "@/lib/i18n/messages.hr";

import { SubmitDialog } from "./SubmitDialog";

// WEB-26, PD-3 "Predati rad?".
const t = messagesHr.submit;
const nothing = () => undefined;
const props = { open: true, revision: 7, late: false, onSubmit: nothing, onClose: nothing };

describe("SubmitDialog (WEB-26, PD-3)", () => {
  it("asks \"Predati rad?\" and names the revision it sends", () => {
    const markup = renderToStaticMarkup(<SubmitDialog {...props} sending={false} />);
    expect(markup).toContain(t.dialogTitle);
    expect(markup).toContain(`${t.revision}: 7`);
    expect(markup).toContain(`>${t.submit}</button>`);
    expect(markup).not.toContain(t.dialogLate);
  });

  it("says before sending that the deadline has passed (variant nakonroka)", () => {
    expect(renderToStaticMarkup(<SubmitDialog {...props} late sending={false} />)).toContain(t.dialogLate);
  });

  it("while sending both buttons do nothing and Escape does not close it", () => {
    const markup = renderToStaticMarkup(<SubmitDialog {...props} sending />);
    expect(markup.match(/<button[^>]*aria-disabled="true"/g)).toHaveLength(2);
    expect(markup).toContain(`>${t.sending}</button>`);
    expect(SubmitDialog({ ...props, sending: true }).props.dismissible).toBe(false);
    expect(SubmitDialog({ ...props, sending: false }).props.dismissible).toBe(true);
  });

  it("renders nothing while closed", () => {
    expect(renderToStaticMarkup(<SubmitDialog {...props} open={false} sending={false} />)).toBe("");
  });
});
