import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CheckActionList, type CheckActionListLabels } from "./CheckActionList";
import { orderFindings, selectionOf, type CheckFinding } from "./list-logic";

const labels: CheckActionListLabels = { list: "Nalazi provjere", empty: "Nema nalaza.", required: "Obvezno", advisory: "Savjetodavno" };
const findings: CheckFinding[] = [
  { id: "f-adv", severity: "advisory", title: "Provjeri duljinu", detail: "Rad je kraći od preporuke.", actions: [{ id: "view", label: "Pogledaj" }] },
  { id: "f-req", severity: "required", title: "Dodaj izvor", actions: [{ id: "fix", label: "Dodaj" }, { id: "skip", label: "Preskoči" }] },
];
const noop = () => undefined;

describe("check action list rules", () => {
  it("orders required before advisory and keeps ids stable", () => {
    expect(orderFindings(findings).map((f) => f.id)).toEqual(["f-req", "f-adv"]);
    expect(findings[0]!.id).toBe("f-adv");
  });
  it("returns the stable ids, and null for unknown ones", () => {
    expect(selectionOf(findings, "f-req", "skip")).toEqual({ findingId: "f-req", actionId: "skip" });
    expect(selectionOf(findings, "f-req", "view")).toBeNull();
    expect(selectionOf(findings, "nope", "fix")).toBeNull();
  });
});

describe("CheckActionList markup", () => {
  it("shows the empty state and no list", () => {
    const html = renderToStaticMarkup(<CheckActionList findings={[]} labels={labels} onAction={noop} />);
    expect(html).toContain("Nema nalaza.");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("<ul");
  });
  it("shows required and advisory findings, required first, with their labels", () => {
    const html = renderToStaticMarkup(<CheckActionList findings={findings} labels={labels} onAction={noop} />);
    expect(html).toContain('aria-label="Nalazi provjere"');
    expect(html).toContain('data-severity="required"');
    expect(html).toContain('data-severity="advisory"');
    expect(html.indexOf("Obvezno")).toBeLessThan(html.indexOf("Savjetodavno"));
    expect(html.indexOf("Dodaj izvor")).toBeLessThan(html.indexOf("Provjeri duljinu"));
  });
  it("actions are native buttons, so Tab, Enter and Space reach them", () => {
    const html = renderToStaticMarkup(<CheckActionList findings={findings} labels={labels} onAction={noop} />);
    expect(html.match(/<button type="button"/g)).toHaveLength(3);
    expect(html).not.toContain("tabindex");
  });
  it("a click reports the stable finding and action id", () => {
    const onAction = vi.fn();
    const tree = CheckActionList({ findings, labels, onAction }) as ReactElement<{ children: ReactNode }>;
    const buttons: ReactElement<{ onClick: () => void; children: ReactNode }>[] = [];
    const walk = (node: ReactNode): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!isValidElement(node)) return;
      const element = node as ReactElement<{ onClick?: () => void; children?: ReactNode }>;
      if (element.type === "button") buttons.push(element as ReactElement<{ onClick: () => void; children: ReactNode }>);
      walk(element.props.children);
    };
    walk(tree);
    expect(buttons).toHaveLength(3);
    buttons[1]!.props.onClick();
    expect(onAction).toHaveBeenCalledWith({ findingId: "f-req", actionId: "skip" });
  });
});
