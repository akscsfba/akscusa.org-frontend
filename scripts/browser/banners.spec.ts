import { accessibilityFailures, expect, test, visit } from "./fixtures";

const logoPaths = ["/", "/contact/", "/donate/", "/comics/"];
const photoPaths = ["/articles/", "/actions/", "/join/", "/book-readings/"];

for (const path of [...logoPaths, ...photoPaths]) {
  test(`${path} contains its banner image without distortion`, async ({
    page,
  }) => {
    for (const width of [320, 375, 768, 1024, 1440, 1920, 2560, 3840]) {
      await page.setViewportSize({ width, height: 900 });
      await visit(page, path);
      await page.waitForLoadState("load");
      const image = page.locator("main [data-banner-background] img");
      await expect(image).toBeVisible();
      await expect(image).toHaveAttribute("alt", "");
      if (logoPaths.includes(path)) {
        await expect(image).toHaveAttribute("src", /aksc-logo/);
      } else {
        await expect(image).not.toHaveAttribute("src", /aksc-logo/);
      }
      const layout = await image.evaluate((image: HTMLImageElement) => {
        const band = image.closest(".on-dark");
        if (!band) throw new Error("The image must be inside its banner.");
        const imageBox = image.getBoundingClientRect();
        const bandBox = band.getBoundingClientRect();
        return {
          viewportWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          topSpace: imageBox.top - bandBox.top,
          bottomSpace: bandBox.bottom - imageBox.bottom,
          leftSpace: imageBox.left - bandBox.left,
          rightSpace: bandBox.right - imageBox.right,
          imageWidth: imageBox.width,
          imageHeight: imageBox.height,
          loaded: image.naturalWidth > 0,
          sourceRatio:
            Number(image.getAttribute("width")) /
            Number(image.getAttribute("height")),
          maskImage: getComputedStyle(image).maskImage,
        };
      });
      expect(
        layout.scrollWidth,
        `${width}px page overflow`,
      ).toBeLessThanOrEqual(layout.viewportWidth + 1);
      expect(layout.loaded).toBe(true);
      // Responsive candidates and density-corrected natural sizes round to pixels.
      expect(
        Math.abs(layout.imageHeight - layout.imageWidth / layout.sourceRatio),
      ).toBeLessThanOrEqual(1);
      for (const space of [
        layout.topSpace,
        layout.bottomSpace,
        layout.rightSpace,
      ]) {
        expect(space, `${width}px image containment`).toBeGreaterThanOrEqual(
          -1,
        );
      }
      if (width >= 1024) {
        expect(layout.maskImage).toContain("90deg");
        expect(layout.maskImage).toContain("34%");
        expect(layout.topSpace).toBeCloseTo(0, 1);
        expect(layout.bottomSpace).toBeCloseTo(0, 1);
        expect(layout.rightSpace).toBeCloseTo(0, 1);
        if (logoPaths.includes(path)) {
          expect(layout.leftSpace).toBeGreaterThanOrEqual(-1);
        }
      }
    }
  });
}

for (const width of [320, 1440]) {
  test(`shared banners retain accessible text at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    for (const path of [...logoPaths, ...photoPaths]) {
      await visit(page, path);
      await page.waitForLoadState("load");
      expect.soft(await accessibilityFailures(page), path).toEqual([]);
    }
  });
}
