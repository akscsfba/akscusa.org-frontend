import type { Locator, Page } from "@playwright/test";
import { accessibilityFailures, expect, test, visit } from "./fixtures";

async function expectClearTarget(page: Page, target: Locator) {
  await expect(target).toBeFocused();
  const top = await target.evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  const headerBottom = await page
    .locator("header")
    .first()
    .evaluate((element) => element.getBoundingClientRect().bottom);
  expect(top).toBeGreaterThanOrEqual(headerBottom);
}

for (const javaScriptEnabled of [true, false]) {
  test.describe(`reader navigation with JavaScript ${javaScriptEnabled ? "on" : "off"}`, () => {
    test.use({ javaScriptEnabled });

    test("a long comic can jump directly to its last panel without changing the strip", async ({
      page,
    }) => {
      for (const width of [320, 375, 768, 1280, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/comics/caste-has-a-cost/", { waitUntil: "load" });
        const panels = page.locator("[data-panel]");
        await expect(panels).toHaveCount(37);
        const transcripts = await page.locator(".panel__transcript").count();
        const index = page.locator(".panel-sequence__index");
        await index.locator("summary").click();
        const link = index.getByRole("link", {
          name: "Panel 37 of 37",
          exact: true,
        });
        await link.focus();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/#comic-37$/);
        await expectClearTarget(page, panels.last());
        await expect(page.locator(".panel__transcript")).toHaveCount(
          transcripts,
        );
        await expect(panels).toHaveCount(37);
        if (javaScriptEnabled) {
          const open = panels.last().locator("[data-panel-open]");
          await open.click();
          const viewer = page.locator("[data-panel-dialog]");
          await expect(viewer).toBeVisible();
          await page.keyboard.press("ArrowLeft");
          await expect(page.locator("[data-panel-counter]")).toContainText(
            "36",
          );
          await page.keyboard.press("Escape");
          await expect(viewer).not.toBeVisible();
          await expect(
            panels.nth(35).locator("[data-panel-open]"),
          ).toBeFocused();
        }
      }
      await page.goto("/anti-caste-toolkit/", { waitUntil: "load" });
      await expect(page.locator(".panel-sequence__index")).toHaveCount(0);
    });

    test("next-question and finish links navigate without answering or clearing choices", async ({
      page,
    }) => {
      for (const width of [320, 375, 768, 1280, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/who-said-what/", { waitUntil: "load" });
        const questions = page.locator("[data-game-question]");
        await questions.first().locator("[data-game-choice]").first().check();
        for (let index = 0; index < 5; index++) {
          const question = questions.nth(index);
          const onward = question.getByRole("link", {
            name: index < 4 ? "Next question" : "Finish: view progress",
            exact: true,
          });
          await onward.focus();
          await page.keyboard.press("Enter");
          await expectClearTarget(
            page,
            index < 4
              ? questions.nth(index + 1)
              : page.locator("#game-results"),
          );
          await expect(page.locator("[data-game-choice]:checked")).toHaveCount(
            1,
          );
          await expect(page.locator("[data-answer-feedback]")).toHaveText([
            "",
            "",
            "",
            "",
            "",
          ]);
        }
        await expect(page.locator("#game-results")).toBeVisible();
        if (!javaScriptEnabled) {
          await expect(page.locator("[data-game-actions]")).toBeHidden();
          await expect(page.locator("#game-results noscript p")).toBeVisible();
        }
        await expect(
          page.getByRole("link", {
            name: "Back to the questions",
            exact: true,
          }),
        ).toBeVisible();
      }
    });
  });
}

test("reader controls reflow at 200% text and remain accessible", async ({
  page,
}) => {
  for (const path of ["/comics/caste-has-a-cost/", "/who-said-what/"]) {
    await page.setViewportSize({ width: 320, height: 800 });
    await visit(page, path);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    if (path.startsWith("/comics")) {
      await page.locator(".panel-sequence__index > summary").click();
      const last = page.locator(".panel-sequence__jumps a").last();
      const bounds = await last.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
      await last.click();
      await expectClearTarget(page, page.locator("[data-panel]").last());
    }
    expect(
      await page
        .locator("html")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    expect(await accessibilityFailures(page)).toEqual([]);
  }
});
