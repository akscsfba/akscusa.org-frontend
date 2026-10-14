import { accessibilityFailures, expect, test, visit } from "./fixtures";

const indexes = [
  {
    path: "/articles/",
    key: "category",
    term: "ambedkarite-thought",
    label: "Ambedkarite Thought",
    one: "article",
    other: "articles",
  },
  {
    path: "/interventions/",
    key: "kind",
    term: "legal",
    label: "Legal",
    one: "intervention",
    other: "interventions",
  },
];
const archiveSelector = "[data-filter-term]:not([data-filter-lead])";

for (const index of indexes) {
  test(`${index.path} has local archive-only feedback and a clearly unfiltered lead`, async ({
    page,
  }) => {
    for (const width of [320, 375, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      await visit(page, index.path);
      const archive = page.locator(archiveSelector);
      const total = await archive.count();
      const expected = await page
        .locator(`${archiveSelector}[data-filter-term="${index.term}"]`)
        .count();
      expect(expected).toBeGreaterThan(0);
      const lead = page.locator("[data-filter-lead]");
      const leadHref = await lead.locator("h2 a").getAttribute("href");
      if (!leadHref) throw new Error("The latest entry has no link.");
      const meta = page.locator("[data-page-meta]");
      await expect(meta).toHaveText(`${total + 1} ${index.other}`);
      const status = page.locator("[data-filter-status]");
      await expect(status).toHaveText(`${total} earlier ${index.other}.`);
      await expect(page.locator("[data-filter-lead-note]")).toContainText(
        "stays visible across all filters",
      );
      const controls = page.locator("[data-filter-controls]");
      await expect(controls).toContainText(
        `The latest ${index.one} above is not counted here.`,
      );
      const chip = page.locator(`[data-filter-value="${index.term}"]`);
      await chip.focus();
      await page.keyboard.press("Enter");
      await expect(chip).toBeFocused();
      await expect(chip).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator('[data-filter-value="all"]')).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await expect(status).toHaveText(
        `${expected} earlier ${expected === 1 ? index.one : index.other} in ${index.label}.`,
      );
      await expect(page.locator(`${archiveSelector}:visible`)).toHaveCount(
        expected,
      );
      await expect(meta).toHaveText(`${total + 1} ${index.other}`);
      await expect(meta).not.toHaveAttribute("aria-live");
      await expect(
        page.locator('main [role="status"], main [aria-live]'),
      ).toHaveCount(1);
      await expect(status).toHaveAttribute("aria-atomic", "true");
      await expect(lead).toBeVisible();
      await expect(page.locator(`main a[href="${leadHref}"]`)).toHaveCount(1);
      expect(new URL(page.url()).searchParams.get(index.key)).toBe(index.term);
      if (width === 375) {
        await expect(status).toBeInViewport({ ratio: 1 });
        await expect(
          page.locator(`${archiveSelector}:visible h2`).first(),
        ).toBeInViewport({ ratio: 1 });
      }
      await controls.evaluate((element) => {
        window.scrollTo(
          0,
          window.scrollY + element.getBoundingClientRect().top - 100,
        );
      });
      const statusBounds = await status.boundingBox();
      const firstHeading = await page
        .locator(`${archiveSelector}:visible h2`)
        .first()
        .boundingBox();
      if (!statusBounds || !firstHeading)
        throw new Error("The local status or first result is not rendered.");
      expect(statusBounds.y).toBeGreaterThanOrEqual(100);
      expect(statusBounds.y + statusBounds.height).toBeLessThan(firstHeading.y);
      expect(firstHeading.y + firstHeading.height).toBeLessThanOrEqual(800);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
  });

  test(`${index.path} preserves shared URLs, singular counts, and clearing`, async ({
    page,
  }) => {
    await visit(page, `${index.path}?${index.key}=${index.term}&keep=1`);
    const status = page.locator("[data-filter-status]");
    await expect(status).toContainText(index.label);
    const filtered = await status.innerText();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(status).toHaveText(filtered);
    await expect(
      page.locator(`[data-filter-value="${index.term}"]`),
    ).toHaveAttribute("aria-pressed", "true");
    const chips = page.locator(
      '[data-filter-value]:not([data-filter-value="all"])',
    );
    for (const chip of await chips.all()) {
      const value = await chip.getAttribute("data-filter-value");
      const label = (await chip.innerText()).trim();
      const count = await page
        .locator(`${archiveSelector}[data-filter-term="${value}"]`)
        .count();
      await chip.click();
      await expect(status).toHaveText(
        count === 0
          ? `No earlier ${index.other} in ${label}. Choose another filter or show all.`
          : `${count} earlier ${count === 1 ? index.one : index.other} in ${label}.`,
      );
    }
    await page.locator('[data-filter-value="all"]').click();
    const total = await page.locator(archiveSelector).count();
    await expect(page.locator(`${archiveSelector}:visible`)).toHaveCount(total);
    await expect(status).toHaveText(`${total} earlier ${index.other}.`);
    expect(new URL(page.url()).searchParams.has(index.key)).toBe(false);
    expect(new URL(page.url()).searchParams.get("keep")).toBe("1");
    await visit(page, `${index.path}?${index.key}=__retired_term__`);
    await expect(page.locator('[data-filter-value="all"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(status).toHaveText(`${total} earlier ${index.other}.`);
  });

  test(`${index.path} explains an empty archive even when the lead matches`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await visit(page, index.path);
    const lead = page.locator("[data-filter-lead]");
    const term = await lead.getAttribute("data-filter-term");
    if (!term) throw new Error("The latest entry has no term.");
    // Model a category whose sole published entry is the retained lead.
    await page
      .locator(`${archiveSelector}[data-filter-term="${term}"]`)
      .evaluateAll((entries) => {
        for (const entry of entries)
          entry.setAttribute("data-filter-term", "__other_fixture_term__");
      });
    const chip = page.locator(`[data-filter-value="${term}"]`);
    const label = (await chip.innerText()).trim();
    await chip.click();
    await expect(page.locator(`${archiveSelector}:visible`)).toHaveCount(0);
    await expect(page.locator("[data-filter-status]")).toHaveText(
      `No earlier ${index.other} in ${label}. Choose another filter or show all.`,
    );
    await expect(lead).toBeVisible();
    await expect(chip).toBeFocused();
    await page.locator('[data-filter-value="all"]').click();
    await expect(page.locator(`${archiveSelector}:visible`)).toHaveCount(
      await page.locator(archiveSelector).count(),
    );
  });
}

test("filter feedback reflows at 200% text and in short landscape", async ({
  page,
}) => {
  for (const [width, height, fontSize] of [
    [320, 800, 32],
    [667, 375, 16],
  ]) {
    await page.setViewportSize({ width, height });
    await visit(page, "/articles/");
    await page.evaluate((size) => {
      document.documentElement.style.fontSize = `${size}px`;
    }, fontSize);
    await page.locator('[data-filter-value="ambedkarite-thought"]').click();
    await expect(page.locator("[data-filter-status]")).toContainText(
      "earlier articles in Ambedkarite Thought",
    );
    const layout = await page
      .locator("[data-filter-status]")
      .evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          width: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          left: bounds.left,
          right: bounds.right,
          fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        };
      });
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);
    expect(layout.left).toBeGreaterThanOrEqual(20);
    expect(layout.right).toBeLessThanOrEqual(width - 20);
    expect(layout.fontSize).toBe(fontSize * 0.875);
  }
});

test("filtered indexes pass automated accessibility checks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  for (const index of indexes) {
    await visit(page, `${index.path}?${index.key}=${index.term}`);
    expect(await accessibilityFailures(page)).toEqual([]);
  }
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the full archive remains available without filter-only messaging", async ({
    page,
  }) => {
    for (const index of indexes) {
      await page.goto(`${index.path}?${index.key}=${index.term}`, {
        waitUntil: "load",
      });
      await expect(page.locator("[data-filter-controls]")).toBeHidden();
      await expect(page.locator("[data-filter-status]")).toBeHidden();
      await expect(page.locator("[data-filter-lead-note]")).toBeHidden();
      const total = await page.locator(archiveSelector).count();
      await expect(page.locator(`${archiveSelector}:visible`)).toHaveCount(
        total,
      );
      await expect(page.locator("[data-page-meta]")).toHaveText(
        `${total + 1} ${index.other}`,
      );
    }
  });
});
