// WEB-NUZ-SCENARIJI NZ-18 (NF-4), PG-15 (NF-5), MK-16 (NF-6): the VIZ "puno" teacher clicks
// through the course cards, the aggregate, the work and its review, and the mentorship, on the
// scenario's own server with no answer faked in the test (test-fakes/viz-nastavnik.ts,
// viz-mentorstvo.ts). Every person, course, text and identifier is invented.
import { axe, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { DOKUMENT_T1 } from "../test-fakes/viz-predaja";
import { FIKSNI_DATUM, T1 } from "../test-fakes/viz-scenariji";
import { PREDANI_RAD } from "../test-fakes/viz-nastavnik";
import { generatedServer } from "./viz/server";

async function teacher(page: Page) {
  const server = generatedServer("puno");
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    const result = server.answer("teacher", req.method(), new URL(req.url()).pathname, req.postData());
    return result === "hang" ? undefined : route.fulfill(result);
  });
}

const main = (page: Page) => page.locator("main");
/** Follows a link by keyboard: focus, then Enter. */
async function follow(page: Page, name: string | RegExp, nth = 0) {
  const link = main(page).getByRole("link", { name }).nth(nth);
  await link.focus();
  await page.keyboard.press("Enter");
}

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`NZ-18: the course card names the role and the students, and opens the submitted work (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await teacher(page);
      await page.goto("/app/web/nastavnik");
      await setTheme(page, theme);
      await expect(main(page).getByText("nositelj (Vi)").first()).toBeVisible();
      await expect(main(page).getByText("Vrijedi do 31. 12. 2026. u 23:59.").first()).toBeVisible();
      await expect(main(page).getByText("Zbroj: predano 1, u pisanju 1.")).toBeVisible();
      await expect(main(page).getByText("Uloga nedostupno")).toHaveCount(0);
      await axe(page, info, `kolegiji-${width}-${theme}`);
      await follow(page, "Otvori rad");
      await expect(page).toHaveURL(new RegExp(`/nastavnik/rad/${PREDANI_RAD}$`));
      // The live text is read with its ETag: no "unavailable", the work's own words.
      await expect(main(page).getByText("Veza radi")).toBeVisible();
      await expect(main(page).getByText("Na kraju, izmišljeni odlomak teksta rada.")).toBeVisible();
      await expect(main(page).getByText(/Tekst rada trenutačno nije dostupan/)).toHaveCount(0);
      await axe(page, info, `rad-${width}-${theme}`);
    });

    test(`PG-15: the review names its course and task, and the interview shows the student's explanation (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await teacher(page);
      await page.goto(`/app/web/nastavnik/rad/${PREDANI_RAD}/pregled`);
      await setTheme(page, theme);
      await expect(main(page).getByText("Kolegij A · zadatak „Lokalni mediji i izborna kampanja”").first()).toBeVisible();
      await expect(main(page).getByText(/nije dostupan · Naziv zadatka nije dostupan/)).toHaveCount(0);
      await expect(main(page).getByRole("link", { name: "Natrag na zadatak" })).toHaveAttribute("href", `/app/web/nastavnik/zadatak/${T1}/predaje`);
      await axe(page, info, `pregled-${width}-${theme}`);
      await page.goto(`/app/web/nastavnik/rad/${PREDANI_RAD}/priprema-razgovora`);
      await setTheme(page, theme);
      await expect(main(page).getByText("Izmišljeno objašnjenje: odlomak je nastao nakon razgovora s mentorom.")).toBeVisible();
      await axe(page, info, `priprema-${width}-${theme}`);
    });

    test(`MK-16: the mentorship lists its own key dates and opens T1's work, the document the student writes (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await teacher(page);
      await page.goto("/app/web/nastavnik/mentorstva");
      await setTheme(page, theme);
      await expect(main(page).getByText("Rok predaje: 8. 11. 2026. u 23:59")).toBeVisible();
      await expect(main(page).getByText("Za ovo mentorstvo još nema rokova ni termina.")).toBeVisible();
      await axe(page, info, `mentorstva-${width}-${theme}`);
      await follow(page, "Otvori rad");
      await expect(page).toHaveURL(new RegExp(`/nastavnik/rad/${DOKUMENT_T1}$`));
      await expect(main(page).getByText("Student A · Rad").first()).toBeVisible();
      await expect(main(page).getByText(/^U pisanju/).first()).toBeVisible();
      await axe(page, info, `mentorski-rad-${width}-${theme}`);
    });
  }
}

test("NZ-18: the aggregate links each submitted work, and the extension lists the students by name", async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await teacher(page);
  await page.goto("/app/web/nastavnik/zbirni");
  await expect(main(page).getByRole("link", { name: "Demo Kompost" }).first()).toHaveAttribute("href", `/app/web/nastavnik/rad/${PREDANI_RAD}`);
  await expect(main(page).getByRole("link", { name: "Produljenje" }).first()).toBeVisible();
  await axe(page, info, "zbirni");
  await page.goto(`/app/web/nastavnik/zadatak/${T1}/produljenje`);
  await expect(main(page).getByText(/^Demo Kompost · novi rok 28\. 12\. 2026\./)).toBeVisible();
  await axe(page, info, "produljenje");
});

test("MK-16: a slot is confirmed by keyboard, and the page records the server's answer for that slot", async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await teacher(page);
  await page.goto(`/app/web/nastavnik/rad/${DOKUMENT_T1}/konzultacije`);
  await expect(main(page).getByText("Tema: Metoda istraživanja")).toBeVisible();
  const confirm = main(page).getByRole("button", { name: "Potvrdi", exact: true });
  await confirm.focus();
  await page.keyboard.press("Enter");
  await expect(main(page).getByText(/Nije poznato je li promjena zabilježena/)).toHaveCount(0);
  await expect(confirm).toHaveCount(0);
  await expect(main(page).getByText(/potvrđen/i).first()).toBeVisible();
  await axe(page, info, "termin-potvrden");
});
