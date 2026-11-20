import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Drawer } from "../drawer";
import { isOutside, placePopover } from "./popover-position";
import { Popover } from "./index";

const viewport = { width: 1000, height: 700 };
const size = { width: 240, height: 120 };

describe("placePopover (UI-6A)", () => {
  it("sits 6 px under the anchor, on its left edge", () => {
    expect(placePopover({ left: 100, right: 140, top: 50, bottom: 80 }, size, viewport)).toEqual({ left: 100, top: 86 });
  });

  it("flips above the anchor when it does not fit below", () => {
    expect(placePopover({ left: 100, right: 140, top: 600, bottom: 630 }, size, viewport)).toEqual({ left: 100, top: 474 });
  });

  it("keeps 8 px from the edges of the viewport", () => {
    expect(placePopover({ left: -30, right: 0, top: 50, bottom: 80 }, size, viewport).left).toBe(8);
    expect(placePopover({ left: 990, right: 1000, top: 50, bottom: 80 }, size, viewport).left).toBe(752);
  });

  it("stays on the page when taller than the room", () => {
    expect(placePopover({ left: 0, right: 10, top: 5, bottom: 20 }, { width: 240, height: 900 }, viewport).top).toBe(8);
  });
});

describe("isOutside (UI-6A)", () => {
  it("is false inside the popover or the anchor, true elsewhere", () => {
    const popover = { contains: (n: Node) => n === inside } as unknown as Node;
    const anchor = { contains: (n: Node) => n === opener } as unknown as Node;
    const inside = {} as Node;
    const opener = {} as Node;
    expect(isOutside(inside, popover, anchor)).toBe(false);
    expect(isOutside(opener, popover, anchor)).toBe(false);
    expect(isOutside({} as Node, popover, anchor)).toBe(true);
    expect(isOutside(null, popover, anchor)).toBe(true);
  });
});

describe("Drawer and Popover markup (UI-6A)", () => {
  it("render nothing while closed", () => {
    expect(renderToStaticMarkup(<Drawer open={false} side="left" title="Struktura" onClose={() => undefined} />)).toBe("");
    expect(renderToStaticMarkup(<Popover open={false} anchor={{ current: null }} label="Izbornik" onClose={() => undefined} />)).toBe("");
  });

  it("the drawer is named by its title and has a labelled close button", () => {
    const html = renderToStaticMarkup(<Drawer open modal={false} side="right" title="Bočni panel" onClose={() => undefined}><p>Sadržaj</p></Drawer>);
    expect(html).toContain("<dialog");
    expect(html).toContain("Bočni panel");
    expect(html).toContain('aria-label="Zatvori"');
    expect(html).toContain("Sadržaj");
  });

  it("the popover is a labelled dialog", () => {
    const html = renderToStaticMarkup(<Popover open floating={false} anchor={{ current: null }} label="Više radnji" onClose={() => undefined}>x</Popover>);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Više radnji"');
  });
});
