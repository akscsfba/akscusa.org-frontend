import { accessibilityFailures, expect, test, visit } from "./fixtures";

test("direct giving is in the opening with matching context and one approved destination", async ({
  page,
}) => {
  for (const width of [320, 375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await visit(page, "/donate/");
    const action = page.getByRole("link", {
      name: "Donate to AKSC",
      exact: true,
    });
    await expect(action).toHaveCount(1);
    await expect(action).toHaveAttribute("href", "https://bit.ly/donate-aksc");
    const bounds = await action.boundingBox();
    if (!bounds) throw new Error("The donation action is not rendered.");
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(800);
    expect(bounds.x).toBeGreaterThanOrEqual(20);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 20);
    const guidance = page.getByText(
      "If your employer offers matching gifts, donate through its company portal. Otherwise, use AKSC's direct donation link.",
      { exact: true },
    );
    await expect(guidance).toHaveCount(1);
    const guidanceBounds = await guidance.boundingBox();
    if (!guidanceBounds) throw new Error("The giving guidance is missing.");
    expect(guidanceBounds.y + guidanceBounds.height).toBeLessThan(bounds.y);
    await expect(
      page.getByRole("complementary", { name: "Membership" }),
    ).toContainText("A stronger commitment");
    await expect(page.locator('main a[href="/join/"]')).toHaveCount(1);
    expect(await page.locator("main .prose-editorial p").count()).toBe(4);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
});

test("giving remains readable at enlarged text and in short landscape", async ({
  page,
}) => {
  for (const [width, height, fontSize] of [
    [320, 800, 32],
    [667, 375, 16],
  ]) {
    await page.setViewportSize({ width, height });
    await visit(page, "/donate/");
    await page.evaluate((size) => {
      document.documentElement.style.fontSize = `${size}px`;
    }, fontSize);
    await page.keyboard.press("Tab");
    const action = page.getByRole("link", {
      name: "Donate to AKSC",
      exact: true,
    });
    await action.focus();
    await expect(action).toBeFocused();
    expect(
      await action.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const header = document.querySelector("header");
        if (!header) throw new Error("The site header is missing.");
        return {
          visible:
            bounds.top >= header.getBoundingClientRect().bottom &&
            bounds.bottom <= window.innerHeight,
          focus: element.matches(":focus-visible"),
          outline: getComputedStyle(element).outlineStyle,
          overflow:
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        };
      }),
    ).toEqual({
      visible: true,
      focus: true,
      outline: "solid",
      overflow: false,
    });
  }
});

test("donation opening passes automated accessibility checks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await visit(page, "/donate/");
  expect(await accessibilityFailures(page)).toEqual([]);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("giving and membership remain ordinary links", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/donate/", { waitUntil: "load" });
    const action = page.getByRole("link", {
      name: "Donate to AKSC",
      exact: true,
    });
    const bounds = await action.boundingBox();
    if (!bounds) throw new Error("The donation action is not rendered.");
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(800);
    await expect(action).toHaveAttribute("href", "https://bit.ly/donate-aksc");
    await expect(page.locator('main a[href="/join/"]')).toBeVisible();
  });
});
