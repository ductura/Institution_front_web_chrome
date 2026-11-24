// @vitest-environment jsdom
// NZ-16 on the screen: the "Zadatak" select takes the focus only on a page opened by a choice in it, and the
// note about students' names stands beside the package actions. Invented data only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import Merlin from "./Merlin";
import { merlinMessages as t } from "./messages.hr";
import type { MerlinData, MerlinPort, MerlinRow } from "./model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const NOW = Date.parse("2026-11-24T10:00:00Z");
const SENT: MerlinRow = {
  familyName: "Izmišljenić", givenName: "Ana", submitted: true, submittedMinute: "2026-11-05T09:30:00Z", afterDeadline: false,
  pdfName: "izmisljenic_esej.pdf", pdfSha256: "a".repeat(64), docxName: "izmisljenic_esej.docx", docxSha256: "b".repeat(64),
};
const DATA: MerlinData = {
  rows: [SENT], extensionReasons: [],
  assignments: [
    { id: "a1", title: "Izmišljeni esej", workType: "essay", dueAt: "2026-11-01T22:59:00.000Z" },
    { id: "a2", title: "Izmišljeni završni", workType: "bachelor_thesis", dueAt: "2099-01-01T00:00:00.000Z" },
  ],
};
const port: MerlinPort = {
  requestPackage: async () => ({ kind: "nepoznato" }) as never,
  readPackage: async () => ({ kind: "nepoznato" }),
  leaveFor: () => {},
  csvPath: (id) => `/csv/${id}`,
};

describe("Merlin focus and personal-data note (NZ-16)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

  async function mount(props: { focusChooser?: boolean; onChoose?: (id: string) => void }) {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(Merlin, { assignmentId: "a1", data: DATA, port, now: () => NOW, ...props })); });
    return host;
  }

  it("focuses the select on a page opened by a choice, and only there", async () => {
    let host = await mount({});
    expect(document.activeElement).toBe(document.body);
    act(() => root?.unmount());
    document.body.innerHTML = "";
    host = await mount({ focusChooser: true });
    const select = host.querySelector("select");
    expect(select).not.toBeNull();
    expect(document.activeElement).toBe(select);
    // A later mount without the wish does not take the focus (no state left behind by the earlier one).
    act(() => root?.unmount());
    document.body.innerHTML = "";
    await mount({});
    expect(document.activeElement).toBe(document.body);
  });

  it("names the kind of work in the options and hands the choice on", async () => {
    const chosen: string[] = [];
    const host = await mount({ onChoose: (id) => chosen.push(id) });
    const select = host.querySelector("select")!;
    expect([...select.options].map((o) => o.textContent)).toEqual([
      "Izmišljeni esej · Esej · rok je prošao", "Izmišljeni završni · Završni rad",
    ]);
    await act(async () => { select.value = "a2"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(chosen).toEqual(["a2"]);
  });

  it("says that the file holds students' names", async () => {
    const host = await mount({});
    expect(host.querySelector('[data-testid="merlin-personal-data"]')?.textContent).toBe(t.personalData);
    expect(t.personalData).toBe("Datoteka sadrži imena studenata; čuvajte je prema pravilima fakulteta.");
  });
});
