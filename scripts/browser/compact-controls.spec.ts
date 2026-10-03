import { expect, test, visit } from "./fixtures";

test("standalone compact controls provide 44px touch targets", async ({
  page,
}) => {
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 800 });
    for (const [path, selector] of [
      ["/", ".btn-sm, [data-carousel-controls] button"],
      ["/book-readings/", ".session-chip"],
      ["/articles/", "[data-filter-value]"],
      [
        "/anti-caste-toolkit/",
        ".panel__transcript summary, .panel__count, [data-transcripts-toggle]",
      ],
    ]) {
      await visit(page, path);
      const targets = await page.locator(selector).evaluateAll((elements) =>
        elements
          .filter((element) => element.checkVisibility())
          .map((element) => ({
            text:
              element.textContent?.trim() || element.getAttribute("aria-label"),
            height: element.getBoundingClientRect().height,
            width: element.getBoundingClientRect().width,
          })),
      );
      expect(targets.length).toBeGreaterThan(0);
      for (const target of targets) {
        expect
          .soft(target.height, `${path} ${target.text}`)
          .toBeGreaterThanOrEqual(44);
        expect
          .soft(target.width, `${path} ${target.text}`)
          .toBeGreaterThanOrEqual(44);
      }
    }
  }
});

for (const noun of ["book", "quotation"]) {
  test(`${noun} position follows controls, native scrolling, wraparound and resize`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await visit(page, "/");
    const carousel = page.locator(`[data-carousel-noun="${noun}"]`);
    const viewport = carousel.locator("[data-carousel-viewport]");
    const position = carousel.locator("[data-carousel-position]");
    const status = carousel.locator("[data-carousel-status]");
    const total = await carousel.locator("[data-carousel-slide]").count();
    await expect(position).toHaveText(`1 of ${total}`);
    await carousel.locator("[data-carousel-next]").click();
    await expect(position).toHaveText(`2 of ${total}`);
    await expect(status).toContainText(`Showing ${noun} 2 of ${total}`);
    await viewport.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(position).toHaveText(`1 of ${total}`);
    await page.keyboard.press("ArrowLeft");
    await expect(position).toHaveText(`${total} of ${total}`);
    await page.keyboard.press("ArrowRight");
    await expect(position).toHaveText(`1 of ${total}`);
    const announcement = await status.textContent();
    await viewport.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expect(position).toHaveText(`${total} of ${total}`);
    expect(await status.textContent()).toBe(announcement);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(position).toHaveText(`${total} of ${total}`);
    await carousel.locator("[data-carousel-next]").click();
    await expect(position).toHaveText(`1 of ${total}`);
    for (let index = 0; index < total; index++) {
      await carousel.locator("[data-carousel-next]").click();
      if ((await position.textContent()) === `${total} of ${total}`) break;
    }
    await expect(position).toHaveText(`${total} of ${total}`);
    await expect(status).toContainText(`Showing ${noun} ${total} of ${total}`);
    await expect(position).not.toHaveAttribute("aria-live", /.+/);

    // A short shelf that fits needs neither position nor inert controls.
    await viewport.locator("[data-carousel-slide]").evaluateAll((slides) => {
      for (const slide of slides.slice(1)) slide.remove();
    });
    await page.setViewportSize({ width: 1920, height: 800 });
    await expect(carousel.locator("[data-carousel-controls]")).toBeHidden();
  });
}
