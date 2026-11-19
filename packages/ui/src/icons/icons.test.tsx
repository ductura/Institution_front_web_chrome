import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { Icon, ICON_NAMES, type IconName } from "./icons";

type SvgProps = Record<string, unknown> & { children?: unknown };
const draw = (props: Parameters<typeof Icon>[0]) => Icon(props) as ReactElement<SvgProps>;

describe("toolbar icons (WEB-03)", () => {
  it("has the icons the static toolbar needs (WEB-15)", () => {
    expect([...ICON_NAMES].sort()).toEqual(
      ["bold", "bulletList", "chevronDown", "heading", "italic", "paragraph", "quote", "redo", "undo"],
    );
  });

  it.each(ICON_NAMES)("%s is decorative and drawn in currentColor", (name) => {
    const svg = draw({ name });
    expect(svg.type).toBe("svg");
    expect(svg.props).toMatchObject({ "aria-hidden": "true", focusable: "false", stroke: "currentColor", width: 16, height: 16 });
    expect(svg.props.children).toBeTruthy();
  });

  it("cannot be made visible to assistive technology by a caller", () => {
    const svg = draw({ name: "bold", size: 20, "aria-hidden": false } as never);
    expect(svg.props).toMatchObject({ "aria-hidden": "true", width: 20, height: 20 });
  });

  it("draws nothing for a name outside the set", () => {
    expect(draw({ name: "toString" as IconName }).props.children).toBeNull();
  });
});
