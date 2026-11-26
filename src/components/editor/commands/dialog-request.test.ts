// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { dialogOffered, offerDialog, requestDialog } from "./dialog-request";

// ED-60: the view menu asks the page for a dialog by name; only the host of that dialog answers.
describe("dialog-request", () => {
  it("is not taken while no host offers the dialog", () => {
    expect(dialogOffered("rules")).toBe(false);
    expect(requestDialog("rules")).toBe(false);
  });

  it("counts the hosts per dialog, and a withdrawal counts once", () => {
    const one = offerDialog("marks");
    const two = offerDialog("marks");
    expect(dialogOffered("marks")).toBe(true);
    expect(dialogOffered("import")).toBe(false);
    one();
    one();
    expect(dialogOffered("marks")).toBe(true);
    two();
    expect(dialogOffered("marks")).toBe(false);
  });

  it("reaches only the listener that takes it", () => {
    const target = new EventTarget();
    const heard: string[] = [];
    target.addEventListener("ductura:editor-dialog", (event) => {
      const name = (event as CustomEvent<string>).detail;
      heard.push(name);
      if (name === "import") event.preventDefault();
    });
    expect(requestDialog("import", target)).toBe(true);
    expect(requestDialog("rules", target)).toBe(false);
    expect(heard).toEqual(["import", "rules"]);
  });
});
