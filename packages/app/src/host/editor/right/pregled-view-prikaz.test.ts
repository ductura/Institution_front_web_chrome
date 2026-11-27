// ED-71: "Prikaz › Prvi redovi" asks the Pregled group for its Nacrt view.
import { describe, expect, it } from "vitest";

import { onPregledView, requestPregledView, takePregledView } from "./pregled-view";

describe("pregled-view for Prikaz", () => {
  it("shows each request while the group is mounted, and leaves nothing waiting", () => {
    const target = new EventTarget();
    const seen: string[] = [];
    const stop = onPregledView((view) => seen.push(view), target);
    requestPregledView("nacrt", target);
    requestPregledView("pojmovnik", target);
    expect(seen).toEqual(["nacrt", "pojmovnik"]);
    expect(takePregledView()).toBeNull();
    stop();
    requestPregledView("provjere", target);
    expect(seen).toEqual(["nacrt", "pojmovnik"]);
  });

  it("keeps a request made before the group is shown, read once", () => {
    requestPregledView("nacrt", new EventTarget());
    expect(takePregledView()).toBe("nacrt");
    expect(takePregledView()).toBeNull();
  });
});
