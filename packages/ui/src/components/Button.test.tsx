import type { MouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

// QA FAIL on aa4b3c5: a busy submit button must not submit its form nor call
// onClick, and must stay focusable (aria-disabled, never disabled).
describe("Button busy", () => {
  const click = (element: ReturnType<typeof Button>) => {
    const event = { preventDefault: vi.fn() } as unknown as MouseEvent<HTMLButtonElement>;
    (element.props as { onClick?: (e: MouseEvent<HTMLButtonElement>) => void }).onClick?.(event);
    return event.preventDefault as ReturnType<typeof vi.fn>;
  };

  it("cancels the click of a busy submit button and never calls onClick", () => {
    const onClick = vi.fn();
    const element = Button({ busy: true, type: "submit", onClick, children: "Predaj" });
    expect(click(element)).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
    expect(element.props).toMatchObject({ type: "submit", "aria-busy": true, "aria-disabled": true });
    expect((element.props as { disabled?: boolean }).disabled).toBeUndefined();
  });

  it("passes the click through when not busy", () => {
    const onClick = vi.fn();
    const element = Button({ type: "submit", onClick, children: "Predaj" });
    expect(click(element)).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledOnce();
    expect(element.props).toMatchObject({ "aria-busy": undefined, "aria-disabled": undefined });
  });
});
