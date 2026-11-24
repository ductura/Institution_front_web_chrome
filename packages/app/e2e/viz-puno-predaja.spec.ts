// WEB-NUZ-SCENARIJI PR-19 (NF-3): the VIZ "puno" scenario walks the whole submission of T1 by
// itself, with no answer faked in the test: the declaration confirmed for the text evidence.open
// gives, the submission and its signed receipt, the withdrawal, and each 409 outcome of a run
// (test-fakes/viz-predaja.ts). Every person, course, text and identifier is invented.
import { axe, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import type { IshodPredaje } from "../test-fakes/viz-predaja";
import { FIKSNI_DATUM, T1 } from "../test-fakes/viz-scenariji";
import { generatedServer } from "./viz/server";

/** The "puno" student over the scenario's own server, for one run of the submission. */
async function student(page: Page, predaja: IshodPredaje = "predano") {
  const server = generatedServer("puno", { predaja });
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    const result = server.answer("student", req.method(), new URL(req.url()).pathname, req.postData());
    return result === "hang" ? undefined : route.fulfill(result);
  });
}

const main = (page: Page) => page.locator("main");
const pressOn = async (page: Page, name: string) => {
  const button = main(page).getByRole("button", { name, exact: true });
  await expect(button).not.toHaveAttribute("aria-disabled", "true");
  await button.focus();
  await page.keyboard.press("Enter");
};

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`PR-19: puno walks steps 2 to 5 by keyboard, then withdraws (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await student(page);
      await page.goto(`/app/web/rad/${T1}/predaja`);
      await setTheme(page, theme);
      // E-8: the declaration the scenario confirmed for this text.
      await expect(page.getByText("Potvrda izjave je spremljena na poslužitelju.", { exact: false })).toBeVisible();
      await axe(page, info, `izjava-${width}-${theme}`);
      await pressOn(page, "Dalje");
      // E-9: nothing blocks, and the summary of the process is read.
      await expect(page).toHaveURL(new RegExp(`/rad/${T1}/predaja/pregled(\\?|$)`));
      await expect(page.getByText("Ništa ne blokira predaju.")).toBeVisible();
      await expect(page.getByText(/^Potvrđena 4\. 11\. 2026\. u 11:00\./)).toBeVisible();
      await expect(page.getByText("1 sesija", { exact: true })).toBeVisible();
      await axe(page, info, `pregled-${width}-${theme}`);
      await pressOn(page, "Dalje");
      // E-10: the dialog, then the receipt for what was sent.
      await expect(page).toHaveURL(new RegExp(`/rad/${T1}/predaja/slanje(\\?|$)`));
      await axe(page, info, `slanje-${width}-${theme}`);
      await pressOn(page, "Predaj rad");
      const dialog = page.getByRole("dialog", { name: "Predati rad?" });
      await expect(dialog.getByText(/spremljen na poslužitelju, s izjavom\. Riječi: 10\./)).toBeVisible();
      await dialog.getByRole("button", { name: "Predaj rad" }).click();
      await expect(page).toHaveURL(new RegExp(`/rad/${T1}/predaja/potvrda(\\?|$)`));
      await expect(main(page).getByText("Predano 5. 11. 2026. u 23:59", { exact: true })).toBeVisible();
      await expect(main(page).getByText("Verzija teksta: V1")).toBeVisible();
      await axe(page, info, `potvrda-${width}-${theme}`);
      // E-11: the withdrawal while the deadline runs, recorded by the server.
      await pressOn(page, "Povuci predaju");
      const withdraw = page.getByRole("dialog", { name: "Povući predaju?" });
      await expect(withdraw.getByText(/Povlačenje se bilježi/)).toBeVisible();
      await axe(page, info, `povuci-${width}-${theme}`);
      await withdraw.getByRole("button", { name: "Povuci predaju" }).click();
      await expect(withdraw).toHaveCount(0);
      await expect(main(page).getByRole("button", { name: "Povuci predaju", exact: true })).toHaveCount(0);
    });
  }
}

const OUTCOMES: readonly { ishod: IshodPredaje; heading?: string; text: RegExp | string }[] = [
  { ishod: "nije-otvoreno", heading: "Predaja nije otvorena", text: "Predaja za ovaj zadatak trenutačno nije otvorena. Obratite se nastavniku kolegija." },
  { ishod: "odbijeno", heading: "Predaja nije prihvaćena", text: "Predaja nije prihvaćena: na poslužitelju nema zapisa ovog rada." },
  { ishod: "vec-zatrazeno", text: /^Predaja ovog rada već je zatražena 5\. 11\. 2026\. u 23:59\./ },
  { ishod: "izjava", text: /^Ovaj zadatak traži izjavu, a poslužitelj nema potvrđenu izjavu za ovu verziju teksta\./ },
  { ishod: "nepoznato", text: "Odgovor poslužitelja nije stigao, pa ishod predaje nije poznat. Rad je možda predan." },
];

for (const { ishod, heading, text } of OUTCOMES) {
  test(`PR-19: puno answers the submission with "${ishod}" and the page says it`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await student(page, ishod);
    await page.goto(`/app/web/rad/${T1}/predaja/slanje`);
    await pressOn(page, "Predaj rad");
    await page.getByRole("dialog", { name: "Predati rad?" }).getByRole("button", { name: "Predaj rad" }).click();
    if (heading !== undefined) await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(main(page).getByText(text).first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/rad/${T1}/predaja/slanje$`));
    await axe(page, info, `ishod-${ishod}`);
  });
}
