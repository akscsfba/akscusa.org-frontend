import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";
import { serveWorkspaceOrigin, workspaceOrigin } from "./workspace-harness";

const bundle = readFileSync(
  new URL(
    "../../node_modules/@sveltia/cms/dist/sveltia-cms.js",
    import.meta.url,
  ),
  "utf8",
);

test("local checkout bootstrap isolates remote writes even with CMS_REPO configured", async ({
  page,
  browserName,
}) => {
  const remoteRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname.startsWith("/workspace") ||
      url.hostname === "api.github.com" ||
      url.hostname === "github.com"
    )
      remoteRequests.push(request.url());
  });
  await page.route(
    "https://unpkg.com/@sveltia/cms@0.201.1/dist/sveltia-cms.js",
    (route) =>
      route.fulfill({ contentType: "application/javascript", body: bundle }),
  );
  await page.route("**/admin/config.yml", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      contentType: "application/yaml",
      body: (await response.text()).replace(
        /^ {2}repo: .*$/m,
        "  repo: configured-owner/configured-repository",
      ),
    });
  });
  await page.goto("/admin/");
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await expect(
      page.getByRole("link", { name: "Edit local checkout" }),
    ).toBeVisible();
  }
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Edit local checkout" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Work with Local Repository",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Sign In with.*GitHub/i }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "Sign In Using Access Token",
      exact: true,
    }),
  ).toHaveCount(0);
  if (browserName === "chromium")
    await expect(
      page.getByRole("button", {
        name: "Work with Local Repository",
        exact: true,
      }),
    ).toBeEnabled();
  else
    await expect(
      page.getByRole("button", {
        name: "Work with Local Repository",
        exact: true,
      }),
    ).toBeDisabled();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: /Sign In with.*GitHub/i }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/admin\/local\/remote-disabled\/auth\?/);
  await popup.close();
  expect(remoteRequests).toEqual([]);
});

test("local checkout uses the native filesystem backend to save without workspace secrets", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "The pinned CMS's local filesystem mode requires File System Access support.",
  );
  const requests: string[] = [];
  page.on("request", (request) => {
    if (
      /\/workspace(?:\/|$)|api\.github\.com|remote-disabled/.test(request.url())
    )
      requests.push(request.url());
  });
  await page.route(
    "https://unpkg.com/@sveltia/cms@0.201.1/dist/sveltia-cms.js",
    (route) =>
      route.fulfill({ contentType: "application/javascript", body: bundle }),
  );
  // Replace only the OS picker: real browser filesystem handles, Sveltia file
  // loading, serialization and writing run against an isolated OPFS checkout.
  await page.addInitScript(() => {
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: async () => {
        const root = await navigator.storage.getDirectory();
        await root.getDirectoryHandle(".git", { create: true });
        return root;
      },
    });
  });
  await page.goto("/admin/local/");
  await page
    .getByRole("button", { name: "Work with Local Repository", exact: true })
    .click();
  await page.getByRole("option", { name: /^Authors / }).click();
  await page
    .getByRole("button", { name: "Create New Entry", exact: true })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText(
    "now creating a new entry",
  );
  await page.evaluate(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await Promise.all(
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Local Author");
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("Local Author");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("option", { name: /^Authors \(1/ }),
  ).toBeVisible();
  const content = await page.evaluate(async () => {
    let directory = await navigator.storage.getDirectory();
    for (const segment of ["cms", "content", "authors", "local-author"])
      directory = await directory.getDirectoryHandle(segment);
    return (await (await directory.getFileHandle("index.md")).getFile()).text();
  });
  expect(content).toContain("name: Local Author");
  expect(requests).toEqual([]);
});

test("local checkout entry cannot start on the production workspace origin", async ({
  page,
  context,
  baseURL,
}) => {
  await serveWorkspaceOrigin(page, context, baseURL!);
  let bundleRequests = 0;
  await page.route("https://unpkg.com/**", (route) => {
    bundleRequests++;
    return route.abort();
  });
  await page.goto(`${workspaceOrigin}/admin/local/`);
  await expect(page.getByRole("alert")).toContainText("only on localhost");
  expect(bundleRequests).toBe(0);
});
