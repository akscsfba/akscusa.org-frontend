import { accessibilityFailures, expect, test, visit } from "./fixtures";

const longStatement =
  "/press-releases/a-right-to-oppress-santa-clara-county-hrc-on-caste-discrimination/";
const historicalConference = "/conferences/aksc-1st-annual-conference-2018/";
const widths = [320, 375, 768, 1280, 1920];

test("book covers introduce the entry before its summary and edition facts", async ({
  page,
}) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    await visit(page, "/books/the-will-to-change/");
    const layout = await page.locator("main article").evaluate((article) => {
      const bounds = (selector: string) => {
        const element = article.querySelector(selector);
        if (!element) throw new Error(`Missing book element: ${selector}`);
        return element.getBoundingClientRect().toJSON();
      };
      return {
        title: bounds("h1"),
        byline: bounds("header p:last-child"),
        cover: bounds("figure img"),
        facts: bounds("dl"),
        summary: bounds("figure + p"),
      };
    });
    if (width < 1024) {
      expect(layout.cover.top).toBeGreaterThan(layout.byline.bottom);
      expect(layout.cover.bottom).toBeLessThan(layout.summary.top);
      if (width === 375) expect(layout.cover.bottom).toBeLessThanOrEqual(800);
    } else {
      expect(layout.cover.left).toBeGreaterThan(layout.title.right);
      expect(layout.cover.top).toBeLessThan(layout.title.top);
    }
    expect(layout.facts.top).toBeGreaterThan(layout.summary.bottom);
    await expect(page.locator("main h1")).toHaveText("The Will to Change");
    await expect(
      page.locator("main a", { hasText: "bell hooks" }),
    ).toBeVisible();
    await expect(page.locator('main a[href*="openlibrary.org"]')).toHaveCount(
      2,
    );
  }
});

test("long entry openings expose their date without shrinking ordinary titles", async ({
  page,
}) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    await visit(page, longStatement);
    const date = page.locator("main header p", {
      hasText: "Released: April 30, 2021",
    });
    const heading = page.locator("main h1");
    await expect(date).toBeVisible();
    const titleBounds = await heading.boundingBox();
    const dateBounds = await date.boundingBox();
    if (!titleBounds || !dateBounds)
      throw new Error("Missing statement opening");
    expect(dateBounds.y + dateBounds.height).toBeLessThan(titleBounds.y);
    const compactSize = await heading.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    );
    await visit(page, "/books/the-will-to-change/");
    const ordinarySize = await page
      .locator("h1")
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    expect(ordinarySize).toBeGreaterThan(compactSize);
  }
});

test("program identity precedes an uncropped lead poster on mobile", async ({
  page,
}) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    await visit(page, "/programs/");
    const lead = page.locator("main article").first();
    const title = await lead.locator("h2").boundingBox();
    const image = await lead.locator("img").boundingBox();
    if (!title || !image) throw new Error("Missing program lead");
    if (width < 1024) expect(title.y + title.height).toBeLessThan(image.y);
    else expect(image.x).toBeGreaterThan(title.x + title.width);
    const shape = await lead
      .locator("img")
      .evaluate((image: HTMLImageElement) => ({
        rendered: image.clientWidth / image.clientHeight,
        original:
          Number(image.getAttribute("width")) /
          Number(image.getAttribute("height")),
        fit: getComputedStyle(image).objectFit,
      }));
    expect(shape.rendered).toBeCloseTo(shape.original, 2);
    expect(shape.fit).not.toBe("cover");
    await expect(lead).toContainText("Concluded");
  }
});

test("masthead credits retain complete readable attribution", async ({
  page,
}) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    await visit(page, "/programs/");
    const credit = page.locator('main a[rel="license"]').locator("..");
    await expect(credit).toContainText("Wander-earth / Wikimedia Commons");
    await expect(credit).toContainText("CC BY-SA 4.0");
    await expect(credit).toContainText("cropped and recolored");
    const size = await credit.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    );
    expect(size).toBeGreaterThanOrEqual(12);
    const photoLabel = page.locator("main p", { hasText: /^Pictured:/ });
    expect(
      await photoLabel.evaluate(
        (element) => getComputedStyle(element).textTransform,
      ),
    ).toBe("none");
    const heading = await page.locator("main h1").boundingBox();
    const label = await photoLabel.boundingBox();
    if (!heading || !label) throw new Error("Missing masthead metadata");
    expect(label.y).toBeGreaterThan(heading.y + heading.height);
  }
});

test("archive context distinguishes historical actions without changing destinations", async ({
  page,
}) => {
  await visit(page, historicalConference);
  const notice = page.getByRole("complementary", { name: "Archive context" });
  await expect(notice).toContainText("historical, not current offers");
  await expect(notice).toContainText("2018");
  const registration = page
    .locator('main a[href="https://tinyurl.com/ClickAKSC2018"]')
    .first();
  const noticeBox = await notice.boundingBox();
  const registrationBox = await registration.boundingBox();
  if (!noticeBox || !registrationBox)
    throw new Error("Missing archive context or original link");
  expect(noticeBox.y + noticeBox.height).toBeLessThan(registrationBox.y);
  await expect(page.locator("main")).not.toContainText(
    "This slideshow requires JavaScript",
  );
  await expect(page.locator("main")).toContainText(
    "The original slideshow is not available in this record.",
  );
  await visit(page, "/interventions/misrepresentation-of-sb-403-explained/");
  await expect(page.locator('main img[src*="dotcompatterns"]')).toHaveCount(0);
  await expect(
    page.getByAltText("America Against Caste Discrimination"),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("Misrepresentation #7");
  await visit(page, "/");
  const writing = page.locator('section[aria-labelledby="latest-title"]');
  await expect(writing).toContainText("From the writing archive");
  await expect(writing).toContainText("Recent action");
  await expect(writing).toContainText("August 10, 2020");
});

test("P2 entry surfaces reflow with enlarged text and in short landscape", async ({
  page,
}) => {
  test.setTimeout(120_000);
  for (const viewport of [
    { width: 320, height: 800 },
    { width: 375, height: 800 },
    { width: 768, height: 800 },
    { width: 1280, height: 800 },
    { width: 1920, height: 800 },
    { width: 667, height: 375 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of [
      "/books/buffalo-nationalism/",
      "/books/the-will-to-change/",
      longStatement,
      "/programs/",
      "/book-readings/",
      "/",
    ]) {
      await visit(page, path);
      await page.addStyleTag({
        content: "html { font-size: 200% !important; }",
      });
      const layout = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect
        .soft(layout.scroll, `${path} at ${viewport.width}`)
        .toBeLessThanOrEqual(layout.width + 1);
    }
  }
});

test("affected entry layouts retain automated accessibility", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 375, height: 800 });
  for (const path of [
    "/books/the-will-to-change/",
    longStatement,
    "/programs/",
    historicalConference,
  ]) {
    await visit(page, path);
    expect.soft(await accessibilityFailures(page), path).toEqual([]);
  }
});
