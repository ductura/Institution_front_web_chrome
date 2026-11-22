import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DirectEditView } from "./DirectEditSetting";
import { fakeDirectEditPort } from "./fake-port";
import { directEditSettingMessages as text } from "./messages.hr";
import { afterChange, changeDirectEdit, type DirectEditWrite, type SettingShown } from "./model";

const on: SettingShown = { kind: "ready", state: { enabled: true, changedAt: "2026-11-21T09:00:00.000Z" } };
const view = (shown: SettingShown, extra: { busy?: boolean; note?: string | null; submitted?: boolean } = {}) => {
  if (shown.kind !== "ready") throw new Error("not ready");
  return renderToStaticMarkup(createElement(DirectEditView, {
    state: shown.state, busy: extra.busy ?? false, note: extra.note ?? null, submitted: extra.submitted ?? false, onChange: () => {},
  }));
};

describe("postavka izravnih izmjena u radnom prostoru studenta", () => {
  it("opoziv prikazuje „isključeno” tek nakon potvrde poslužitelja", async () => {
    // While the revocation is on its way the mark still says the edits are allowed.
    const pending = view(on, { busy: true, note: text.saving });
    expect(pending).toContain('data-direct-edit-badge="on"');
    expect(pending).toContain(text.badgeOn);

    // An answer that confirms nothing leaves the mark as it was.
    for (const result of [{ kind: "unknown" }, { kind: "rejected" }, { kind: "signedOut" }] as DirectEditWrite[]) {
      expect(view(afterChange(on, result))).toContain('data-direct-edit-badge="on"');
    }

    // The server's confirmation turns it off.
    const port = fakeDirectEditPort(true);
    const confirmed = afterChange(on, await changeDirectEdit(port, "doc-demo-1", false));
    expect(port.writes).toEqual([false]);
    const off = view(confirmed);
    expect(off).toContain('data-direct-edit-badge="off"');
    expect(off).toContain(text.badgeOff);
    expect(off).toContain(text.enable);
  });

  it("predani rad prikazuje postavku samo za čitanje", () => {
    const html = view(on, { submitted: true });
    expect(html).toContain(text.badgeOn);
    expect(html).toContain(text.submittedLocked);
    expect(html).not.toContain("<button");
    expect(html).not.toContain(text.revoke);
  });

  it("nepredani rad nudi prekidač", () => {
    const html = view(on);
    expect(html).toContain("<button");
    expect(html).toContain(text.revoke);
  });
});
