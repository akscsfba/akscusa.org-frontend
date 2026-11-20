import { expect, test, visit } from "./fixtures";

test("reading filters survive sharing and reload without growing browser history", async ({
  page,
}) => {
  await visit(page, "/book-readings/?source=home#reading-log");
  const historyLength = await page.evaluate(() => history.length);
  const search = page.locator("[data-log-search]");
  await search.fill("Ambedkar");
  const visible = page.locator("[data-log-entry]:visible");
  const matching = await visible.count();
  expect(matching).toBeGreaterThan(0);
  expect(new URL(page.url()).searchParams.get("q")).toBe("Ambedkar");
  const facets = page.locator("[data-log-facet]");
  for (const select of await facets.all()) {
    const key = await select.getAttribute("data-log-facet");
    if (!key) throw new Error("Missing facet key");
    await select.selectOption({ index: 1 });
    expect(new URL(page.url()).searchParams.get(key)).toBe(
      await select.inputValue(),
    );
  }
  const shared = page.url();
  const count = await visible.count();
  const status = await page.locator("[data-log-status]").textContent();
  await page.reload();
  await expect(search).toHaveValue("Ambedkar");
  await expect(visible).toHaveCount(count);
  await expect(page.locator("[data-log-status]")).toHaveText(status ?? "");
  expect(page.url()).toBe(shared);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await page.locator("[data-log-clear]").click();
  await expect(search).toBeFocused();
  expect(new URL(page.url()).search).toBe("?source=home");
  expect(new URL(page.url()).hash).toBe("#reading-log");
  await expect(visible).toHaveCount(
    await page.locator("[data-log-entry]").count(),
  );
});

test("retired reading facets are explicitly cleared and history restores controls", async ({
  page,
}) => {
  await visit(page, "/book-readings/?book=retired&year=1900&q=Ambedkar");
  await expect(page.locator("[data-log-status]")).toContainText(
    "Some saved filters are no longer available and were cleared.",
  );
  await expect(page.locator('[data-log-facet="book"]')).toHaveValue("");
  await expect(page.locator('[data-log-facet="year"]')).toHaveValue("");
  expect(new URL(page.url()).search).toBe("?q=Ambedkar");
  await page.evaluate(() => {
    history.pushState(null, "", "?q=hooks&author=bell-hooks");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.locator("[data-log-search]")).toHaveValue("hooks");
  await expect(page.locator('[data-log-facet="author"]')).toHaveValue(
    "bell-hooks",
  );
  await expect(page.locator("[data-log-entry]:visible")).toHaveCount(1);
  await page.locator("[data-log-search]").fill("__no_match__");
  await expect(page.locator("[data-log-empty]")).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-log-empty]")).toBeVisible();
});

for (const javaScriptEnabled of [true, false]) {
  test.describe(`reading record with JavaScript ${javaScriptEnabled}`, () => {
    test.use({ javaScriptEnabled });
    test("the native jump exposes and focuses the record below the sticky header", async ({
      page,
    }) => {
      test.setTimeout(60_000);
      for (const width of [320, 375, 768, 1280, 1920]) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto("/book-readings/?q=Ambedkar", { waitUntil: "load" });
        const jump = page.getByRole("link", {
          name: "Browse past readings",
          exact: true,
        });
        await expect(jump).toHaveCount(1);
        await jump.focus();
        await page.keyboard.press("Enter");
        const heading = page.locator("#reading-log");
        await expect(heading).toBeFocused();
        const bounds = await heading.boundingBox();
        const header = await page
          .locator("body > header, body header.sticky")
          .first()
          .boundingBox();
        if (!bounds || !header)
          throw new Error("Missing heading or sticky header");
        expect(bounds.y).toBeGreaterThanOrEqual(header.y + header.height);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(800);
        if (!javaScriptEnabled) {
          await expect(page.locator("[data-log-controls]")).toBeHidden();
          await expect(page.locator("[data-log-entry]:visible")).toHaveCount(
            await page.locator("[data-log-entry]").count(),
          );
        }
      }
    });
  });
}
