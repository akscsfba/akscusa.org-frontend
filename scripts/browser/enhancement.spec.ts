import { expect, publishedPaths, test, visit } from "./fixtures";

test("the shelf starts still, opts into rotation, and respects focus and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install();
  await visit(page, "/");
  const shelf = page.locator('[data-carousel-noun="book"]');
  const viewport = shelf.locator("[data-carousel-viewport]");
  const toggle = shelf.locator("[data-carousel-toggle]");
  const position = shelf.locator("[data-carousel-position]");
  const total = await shelf.locator("[data-carousel-slide]").count();
  await expect(toggle).toHaveAttribute("aria-label", "Play the shelf");
  await expect(
    page.locator('[data-carousel-noun="quotation"] [data-carousel-toggle]'),
  ).toHaveAttribute("aria-label", "Pause quotations");
  await page.mouse.move(0, 0);
  await page.clock.runFor(11_000);
  await expect(position).toHaveText(`1 of ${total}`);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-label", "Pause the shelf");
  await viewport.focus();
  await page.mouse.move(0, 0);
  await page.clock.runFor(6_000);
  await expect(position).toHaveText(`1 of ${total}`);
  await page.locator("h1").evaluate((element) => {
    element.setAttribute("tabindex", "-1");
    element.focus();
  });
  await page.clock.runFor(6_000);
  await expect(position).toHaveText(`2 of ${total}`);
  await expect
    .poll(() =>
      viewport.evaluate((element) => {
        const slides = element.querySelectorAll<HTMLElement>(
          "[data-carousel-slide]",
        );
        return (
          Math.abs(
            element.scrollLeft - (slides[1].offsetLeft - slides[0].offsetLeft),
          ) < 1
        );
      }),
    )
    .toBe(true);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-label", "Play the shelf");
  await page.clock.runFor(1_000);
  const paused = await position.textContent();
  await page.locator("h1").focus();
  await page.mouse.move(0, 0);
  await page.clock.runFor(6_000);
  await expect(position).toHaveText(paused ?? "");
  await toggle.click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(toggle).toHaveAttribute("aria-label", "Play the shelf");
  await page.clock.runFor(1_000);
  const reduced = await position.textContent();
  await page.locator("h1").focus();
  await page.mouse.move(0, 0);
  await page.clock.runFor(6_000);
  await expect(position).toHaveText(reduced ?? "");
});

test("a focused carousel stays paused after the pointer leaves", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install();
  await visit(page, "/");
  const carousel = page.locator('[data-carousel-noun="quotation"]');
  await carousel.scrollIntoViewIfNeeded();
  const viewport = carousel.locator("[data-carousel-viewport]");
  await viewport.focus();
  await carousel.hover();
  const before = await viewport.evaluate((element) => element.scrollLeft);
  await page.mouse.move(0, 0);
  await expect(viewport).toBeFocused();
  await page.clock.runFor(7_000);
  await page.waitForTimeout(500);
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBe(before);
});

test("reduced motion starts carousels without automatic rotation", async ({
  page,
}) => {
  await page.clock.install();
  await visit(page, "/");
  const viewport = page.locator(
    '[data-carousel-noun="quotation"] [data-carousel-viewport]',
  );
  const before = await viewport.evaluate((element) => element.scrollLeft);
  await page.clock.runFor(13_000);
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBe(before);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("navigation, full content, and transcripts remain usable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/", { waitUntil: "load" });
    await page.locator("[data-mobile-nav] > summary").click();
    await expect(
      page.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeVisible();
    const join = page.locator("[data-mobile-nav-sheet] a").first();
    await expect(join).toHaveText("Join AKSC");
    const joinBounds = await join.boundingBox();
    if (!joinBounds) throw new Error("The mobile Join link is not rendered.");
    expect(joinBounds.y + joinBounds.height).toBeLessThanOrEqual(800);
    await expect(page.locator("[data-carousel-controls]:visible")).toHaveCount(
      0,
    );
    await page.goto("/book-readings/", { waitUntil: "load" });
    await expect(page.locator("[data-log-controls]")).toBeHidden();

    const paths = await publishedPaths(page);
    const comic = paths.find((path) => /^\/comics\/[^/]+\/$/.test(path));
    if (comic) {
      await page.goto(comic, { waitUntil: "load" });
      await expect(page.locator("[data-panel-open]:visible")).toHaveCount(0);
      const transcript = page.locator(".panel__transcript").first();
      await transcript.locator("summary").click();
      await expect(transcript).toHaveAttribute("open", "");
    }
  });

  test("editorial filters never appear as dead buttons", async ({ page }) => {
    for (const path of ["/articles/", "/interventions/"]) {
      await page.goto(path, { waitUntil: "load" });
      await expect(page.locator("[data-filter-value]:visible")).toHaveCount(0);
    }
  });
});
