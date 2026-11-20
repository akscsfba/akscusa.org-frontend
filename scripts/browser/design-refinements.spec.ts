import { accessibilityFailures, expect, test, visit } from "./fixtures";

test("contact actions follow their text instead of stretching into an empty well", async ({
  page,
}) => {
  for (const width of [320, 375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, "/contact/");
    const cards = page.locator("main ul > .card");
    const email = cards.first();
    const gap = await email.evaluate((element) => {
      const description = element.querySelector("p");
      const link = element.querySelector(".btn");
      if (!description || !link)
        throw new Error("Missing contact description or action.");
      return (
        link.getBoundingClientRect().top -
        description.getBoundingClientRect().bottom
      );
    });
    expect(gap).toBeGreaterThanOrEqual(20);
    expect(gap).toBeLessThanOrEqual(28);
    if (width >= 1024) {
      const heights = await cards.evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().height),
      );
      expect(heights[0]).toBeLessThan(heights[1] - 100);
    }
    await expect(email.locator("a")).toHaveAttribute(
      "href",
      "mailto:ec@akscusa.org",
    );
    await expect(cards.last()).toContainText("911");
    await expect(cards.last()).toContainText("988");
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    expect(
      await page
        .locator("html")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
  }
  expect(await accessibilityFailures(page)).toEqual([]);
});

test("application panels and document links use small corners with structural borders intact", async ({
  page,
}) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/testimonies-of-practice-of-caste-in-the-usa/",
      "/organization/general-body/",
      "/books/the-will-to-change/",
      "/contact/",
      "/conferences/aksc-7th-annual-conference-2026/",
    ]) {
      await visit(page, path);
      await expect(
        page.locator(
          'main [class*="rounded-2xl"], main [class*="rounded-r-2xl"]',
        ),
      ).toHaveCount(0);
      expect(
        await page
          .locator("html")
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
    }
  }
  await visit(page, "/organization/general-body/");
  const document = page.locator('main a[href$=".pdf"]').first();
  await expect(document).toHaveCSS("border-top-width", "1px");
  await document.focus();
  await expect(document).toBeFocused();
});
