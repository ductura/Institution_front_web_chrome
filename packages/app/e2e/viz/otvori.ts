// VIZ alat: opens an app screen over the fake server of a scenario
// (test-fakes/viz-scenariji.ts) with the page clock fixed to the prototype's
// "today", so the shots of the app and of the prototype use the same data and date.
import { expect, type Page } from "@playwright/test";

import { FIKSNI_DATUM, generatedServer, type Scenarij } from "../../test-fakes/viz-scenariji";
import type { Screen } from "../a11y/screens";

export async function otvori(page: Page, screen: Screen, scenarij: Scenarij) {
  const server = generatedServer(scenarij);
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/auth/login**", (route) => route.fulfill({
    status: 200, contentType: "text/html; charset=utf-8",
    body: "<!doctype html><html lang=\"hr\"><title>AAI@EduHr</title><main><h1>Lažni AAI@EduHr</h1></main></html>",
  }));
  await page.route("**/api/v1/**", (route) => {
    const request = route.request();
    if (request.url().includes("/api/v1/auth/login")) return route.fallback();
    const result = server.answer(screen.role, request.method(), new URL(request.url()).pathname);
    // "hang": the request is never answered, so the loading state stays on screen.
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
  await page.goto(`/app/web${screen.path}`);
  if (scenarij === "ucitavanje") {
    await expect(page.locator("main, body").first()).toBeVisible();
    await page.waitForTimeout(500);
    return;
  }
  await page.waitForLoadState("networkidle");
  await expect(page.locator("main").first()).toBeVisible();
  await expect(page.getByRole("status", { name: /Učitavam|Prijavljujem/ })).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
}
