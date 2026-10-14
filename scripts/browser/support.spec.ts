import type { Page } from "@playwright/test";

import { accessibilityFailures, expect, test, visit } from "./fixtures";

const testimonyPath = "/testimonies-of-practice-of-caste-in-the-usa/";
const accountId = "overrepresentation-of-upper-caste-hindus-in-the-tech-sector";

async function expectHeadingClear(page: Page, id: string): Promise<void> {
  const bounds = await page.locator(`#${id}`).evaluate((heading) => {
    const header = document.querySelector("header");
    const menu = document.querySelector("[data-topic-menu]");
    if (!header || !menu)
      throw new Error("The testimony navigation is missing.");
    return {
      top: heading.getBoundingClientRect().top,
      stickyBottom: Math.max(
        header.getBoundingClientRect().bottom,
        menu.getClientRects().length ? menu.getBoundingClientRect().bottom : 0,
      ),
    };
  });
  expect(bounds.top, `${id} clears both sticky layers`).toBeGreaterThanOrEqual(
    bounds.stickyBottom,
  );
}

async function expectNoOverflow(page: Page): Promise<void> {
  const layout = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width + 1);
}

test("main-page helpline contact precedes questions and is actionable in the mobile opening", async ({
  page,
}) => {
  for (const width of [320, 375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await visit(page, "/helpline/");
    const contact = page.locator('main [aria-labelledby="contact-title"]');
    const phone = contact.locator('a[href="tel:+18446686483"]');
    const email = contact.locator('a[href="mailto:helpline@akscusa.org"]');
    await expect(phone).toHaveCount(1);
    await expect(email).toHaveCount(1);
    for (const link of [phone, email]) {
      const bounds = await link.boundingBox();
      if (!bounds)
        throw new Error("The helpline contact method is not rendered.");
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(20);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 20);
    }
    if (width <= 768) {
      const bounds = await phone.boundingBox();
      if (!bounds)
        throw new Error("The helpline phone number is not rendered.");
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(800);
    }
    expect(
      await contact.evaluate((element) => {
        const questions = element.parentElement?.querySelector("ul");
        return (
          questions !== undefined &&
          questions !== null &&
          Boolean(
            element.compareDocumentPosition(questions) &
            Node.DOCUMENT_POSITION_FOLLOWING,
          )
        );
      }),
    ).toBe(true);
    await expect(
      page.getByRole("region", { name: "Emergency information" }),
    ).toBeVisible();
    await expect(page.locator("main img")).toHaveCount(2);
    await expectNoOverflow(page);
  }
});

test("testimony contribution and support appear before browsing, with the closing action retained", async ({
  page,
}) => {
  for (const width of [320, 375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await visit(page, testimonyPath);
    const actions = page.getByRole("link", {
      name: "Share your testimony",
      exact: true,
    });
    await expect(actions).toHaveCount(2);
    for (const action of await actions.all()) {
      await expect(action).toHaveAttribute("href", "https://bit.ly/CasteInUsa");
    }
    const support = page.getByRole("link", {
      name: "Get confidential support",
      exact: true,
    });
    await expect(support).toHaveAttribute("href", "/helpline/");
    expect(
      await actions.first().evaluate((element) => {
        const menu = document.querySelector("[data-topic-menu]");
        const content = document.querySelector(".testimonies-content");
        const note = element.parentElement?.previousElementSibling;
        if (!menu || !content || !note)
          throw new Error("Testimony opening is incomplete.");
        return {
          beforeTopics: Boolean(
            element.compareDocumentPosition(menu) &
            Node.DOCUMENT_POSITION_FOLLOWING,
          ),
          beforeAccounts: Boolean(
            element.compareDocumentPosition(content) &
            Node.DOCUMENT_POSITION_FOLLOWING,
          ),
          afterPrivacyNote: note.textContent?.includes("Pseudonyms"),
        };
      }),
    ).toEqual({
      beforeTopics: true,
      beforeAccounts: true,
      afterPrivacyNote: true,
    });
    await actions.first().focus();
    await page.keyboard.press("Tab");
    await expect(support).toBeFocused();
    await expectNoOverflow(page);
  }
});

for (const scale of [100, 200]) {
  test(`testimony fragments and keyboard topic jumps clear both sticky layers at ${scale}% text`, async ({
    page,
  }) => {
    if (scale === 200) {
      // The reading scale must be in place before native fragment layout.
      await page.route(`**${testimonyPath}`, async (route) => {
        const response = await route.fetch();
        const html = await response.text();
        expect(html).toContain("<head>");
        await route.fulfill({
          response,
          body: html.replace(
            "<head>",
            "<head><style>html { font-size: 200% !important; }</style>",
          ),
        });
      });
    }
    for (const width of [320, 375, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("about:blank");
      await visit(page, `${testimonyPath}#${accountId}`);
      await expectHeadingClear(page, accountId);
      await expectNoOverflow(page);

      const topicMenu = page.locator("[data-topic-menu]");
      const navigation =
        width < 1024
          ? topicMenu
          : page.getByRole("navigation", { name: "Testimony topics" }).last();
      const summary = topicMenu.locator("summary");
      if (width < 1024) {
        await summary.focus();
        await page.keyboard.press("Enter");
      }
      const link = navigation.locator("a").first();
      const href = await link.getAttribute("href");
      if (!href?.startsWith("#"))
        throw new Error("A testimony topic has no fragment.");
      await link.focus();
      await page.keyboard.press("Enter");
      await expectHeadingClear(page, href.slice(1));
      if (width < 1024) await expect(topicMenu).not.toHaveAttribute("open", "");
    }
  });
}

test("topic navigation preserves Escape focus return, outside dismissal, and desktop reset", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await visit(page, `${testimonyPath}#${accountId}`);
  const menu = page.locator("[data-topic-menu]");
  const summary = menu.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  const navigation = menu.getByRole("navigation", { name: "Testimony topics" });
  if (
    await navigation.evaluate((element) => element === document.activeElement)
  ) {
    await page.keyboard.press("Tab");
  }
  await expect(menu.locator("a").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(summary).toBeFocused();
  await summary.click();
  await page.mouse.click(2, 450);
  await expect(menu).not.toHaveAttribute("open", "");
  await summary.click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(menu).not.toHaveAttribute("open", "");
});

test("support journeys reflow with enlarged text and in short landscape viewports", async ({
  page,
}) => {
  for (const viewport of [
    { width: 320, height: 900 },
    { width: 375, height: 900 },
    { width: 768, height: 900 },
    { width: 800, height: 375 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of ["/helpline/", testimonyPath]) {
      await visit(page, path);
      await page.addStyleTag({
        content: "html { font-size: 200% !important; }",
      });
      await expectNoOverflow(page);
    }
    await page.goto("about:blank");
    await visit(page, `${testimonyPath}#${accountId}`);
    await expectHeadingClear(page, accountId);
  }
});

test("changed support surfaces meet automated accessibility rules", async ({
  page,
}) => {
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/helpline/", testimonyPath]) {
      await visit(page, path);
      expect(
        await accessibilityFailures(page),
        `${path} at ${width}px`,
      ).toEqual([]);
    }
  }
});

test.describe("support without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("contact, contribution, and direct testimony fragments remain usable", async ({
    page,
  }) => {
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/helpline/", { waitUntil: "load" });
      await expect(
        page.locator('main a[href="tel:+18446686483"]'),
      ).toBeVisible();
      await page.goto(testimonyPath, { waitUntil: "load" });
      await expect(
        page
          .getByRole("link", { name: "Share your testimony", exact: true })
          .first(),
      ).toHaveAttribute("href", "https://bit.ly/CasteInUsa");
      await page.goto("about:blank");
      await page.goto(`${testimonyPath}#${accountId}`, { waitUntil: "load" });
      await expectHeadingClear(page, accountId);
      await page.locator("[data-topic-menu] > summary").click();
      await expect(page.locator("[data-topic-menu]")).toHaveAttribute(
        "open",
        "",
      );
      await expectNoOverflow(page);
    }
  });
});
