import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { Steps } from "./index";

it("marks the current step in the ordered list of five steps", () => {
  const markup = renderToStaticMarkup(<Steps currentStep={3} />);
  const steps = markup.match(/<li\b[^>]*>.*?<\/li>/g);
  expect(markup).toMatch(/^<ol\b/);
  expect(steps?.map((step) => step.replace(/<.*?>/g, ""))).toEqual([
    "1Tekst", "2Izjava", "3Prije predaje", "4Predaja", "5Potvrda",
  ]);
  expect(steps?.filter((step) => step.includes('aria-current="step"'))).toEqual([steps?.[2]]);
});
