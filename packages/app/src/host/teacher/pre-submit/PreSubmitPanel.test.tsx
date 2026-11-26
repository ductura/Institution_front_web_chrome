import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlacesView } from "./PreSubmitPanel";
import { preSubmitMessages as text } from "./messages.hr";

describe("N-07 open places view", () => {
  it("draws the list, the honest none, loading and unavailable apart", () => {
    expect(renderToStaticMarkup(<PlacesView places={{ kind: "places", rows: ["1. Uvod, odlomak 2"] }} />)).toContain("<li>1. Uvod, odlomak 2</li>");
    const none = renderToStaticMarkup(<PlacesView places={{ kind: "none" }} />);
    expect(none).toContain(text.placesNone);
    expect(none).not.toContain(text.placesUnavailable);
    expect(renderToStaticMarkup(<PlacesView places={{ kind: "loading" }} />)).toContain(text.placesLoading);
    expect(renderToStaticMarkup(<PlacesView places={{ kind: "unavailable" }} />)).toContain(text.placesUnavailable);
  });
});
