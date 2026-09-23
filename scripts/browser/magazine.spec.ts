import { readFile } from "node:fs/promises";

import {
  documentPath,
  downloadName,
  magazinePath,
} from "../../app/features/magazine/routes";
import { accessibilityFailures, expect, test, visit } from "./fixtures";

for (const width of [320, 375, 768, 1440]) {
  test(`magazine fits and displays its document at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, magazinePath);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

    const viewer = page.locator("iframe");
    await expect(viewer).toHaveAttribute("title", "AKSC 10th Year Magazine");
    await expect(viewer).toHaveAttribute("sandbox", "allow-same-origin");
    await viewer.scrollIntoViewIfNeeded();
    const document = page.frameLocator("iframe");
    await expect(document.locator("main")).toBeVisible();
    await expect(document.locator("img")).toHaveCount(9);
    await expect
      .poll(() =>
        document
          .locator("img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                image instanceof HTMLImageElement &&
                image.complete &&
                image.naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);

    for (const root of [page.locator("html"), document.locator("html")]) {
      const layout = await root.evaluate((element) => ({
        width: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width + 1);
    }
    const bounds = await viewer.boundingBox();
    expect(bounds?.height).toBeGreaterThan(400);

    const contentsLink = document.locator(".contents-list a").first();
    const fragment = await contentsLink.getAttribute("href");
    if (!fragment?.startsWith("#")) {
      throw new Error("The magazine contents link has no document fragment.");
    }
    await contentsLink.click();
    await expect(document.locator(fragment)).toBeInViewport();
  });
}

test("keyboard users can download the unchanged magazine and open it full-page", async ({
  page,
}) => {
  await visit(page, magazinePath);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  const downloadLink = page.getByRole("link", { name: "Download HTML" });
  await downloadLink.focus();
  await expect(downloadLink).toBeFocused();
  const downloading = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(downloadName);
  expect(await download.failure()).toBeNull();
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error("The magazine download was not saved.");
  const original = await readFile(
    new URL(
      "../../app/features/magazine/assets/aksc-10th-year-magazine.html",
      import.meta.url,
    ),
  );
  expect((await readFile(downloadedPath)).equals(original)).toBe(true);

  await page.keyboard.press("Tab");
  const openLink = page.getByRole("link", { name: "Open full-page" });
  await expect(openLink).toBeFocused();
  await expect(openLink).toHaveAttribute("href", documentPath);
  await page.keyboard.press("Enter");
  await expect(page).toHaveTitle("AKSC 10th Year Magazine");
  await expect(page.locator(".contents-list")).toBeVisible();
});

test("the magazine page is accessible and reflows with enlarged text", async ({
  page,
}) => {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, magazinePath);
    expect(await accessibilityFailures(page)).toEqual([]);
    await page.addStyleTag({
      content: "html { font-size: 200% !important; }",
    });
    const layout = await page.locator("html").evaluate((element) => ({
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width + 1);
    await page
      .getByRole("link", { name: "Download HTML" })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("link", { name: "Download HTML" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open full-page" }),
    ).toBeVisible();
    const bounds = await page.locator("iframe").boundingBox();
    expect(bounds?.height).toBeGreaterThan(200);
  }
});
