import { readFileSync } from "node:fs";
import { expect, test, accessibilityFailures } from "./fixtures";
import { handleGitHubAuth } from "../../functions/_lib/github-oauth";
import {
  installWorkspaceGateway,
  serveWorkspaceOrigin,
  workspaceOrigin,
} from "./workspace-harness";
import { unseal } from "../../functions/_lib/workspace-session";

const state = {
  repo: "example/editorial",
  editorId: "e".repeat(32),
  user: { id: 42, login: "editor" },
  workspace: {
    branch: "content/42/batch-0",
    sha: "saved",
    batch: "batch-0",
    status: "editing",
    pull: null,
  },
};
const bundle = readFileSync(
  new URL(
    "../../node_modules/@sveltia/cms/dist/sveltia-cms.js",
    import.meta.url,
  ),
  "utf8",
);

test.beforeEach(async ({ page, context, baseURL }) => {
  await serveWorkspaceOrigin(page, context, baseURL!);
});

for (const width of [320, 375, 768, 1440]) {
  test(`workspace controls are usable at ${width}px`, async ({ page }) => {
    const gates = Array.from({ length: 3 }, () =>
      Promise.withResolvers<void>(),
    );
    let requests = 0;
    await page.route("**/workspace", async (route) => {
      const request = requests++;
      if (request > 0) await gates[request - 1]?.promise;
      await route.fulfill({ json: state });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${workspaceOrigin}/admin/`);
    await expect(
      page.getByRole("button", { name: "Open editor", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveText("Open editor");
    expect(await accessibilityFailures(page)).toEqual([]);
    const submit = page.getByRole("button", { name: "Submit for review" });
    await submit.focus();
    const bounds = await submit.boundingBox();
    await page.keyboard.press("Enter");
    const pending = page.getByRole("button", { name: "Submitting…" });
    for (let phase = 0; phase < gates.length; phase++) {
      await expect.poll(() => requests).toBe(phase + 2);
      await expect(pending).toBeVisible();
      await expect(pending).toBeDisabled();
      await expect(pending).toBeFocused();
      expect(await pending.boundingBox()).toEqual(bounds);
      await expect(page.locator("[data-progress]")).toHaveText(
        "Submitting saved changes…",
      );
      expect(
        await page
          .locator("[data-progress]")
          .evaluate(
            (element) => element.closest('[aria-busy="true"]') === null,
          ),
      ).toBe(true);
      for (const name of ["Open editor", "Refresh status", "Sign out"])
        await expect(
          page.getByRole("button", { name, exact: true }),
        ).toBeDisabled();
      await page.keyboard.press("Enter");
      await pending.dispatchEvent("click");
      await page
        .getByRole("button", { name: "Refresh status" })
        .dispatchEvent("click");
      expect(requests).toBe(phase + 2);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      gates[phase].resolve();
    }
    await expect(submit).toBeEnabled();
    await expect(submit).toBeFocused();
    await expect(page.locator("[data-progress]")).toBeEmpty();
    for (const name of ["Open editor", "Refresh status", "Sign out"])
      await expect(
        page.getByRole("button", { name, exact: true }),
      ).toBeEnabled();
  });
}

for (const failedPhase of [1, 2, 3]) {
  test(`submission restores controls after request ${failedPhase} fails and allows retry`, async ({
    page,
  }) => {
    const gate = Promise.withResolvers<void>();
    let requests = 0;
    await page.route("**/workspace", async (route) => {
      const request = requests++;
      if (request === failedPhase) {
        await gate.promise;
        return route.fulfill({
          status: 503,
          json: { message: "Workspace unavailable. Try again." },
        });
      }
      return route.fulfill({ json: state });
    });
    await page.route("**/admin/editor/", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<textarea aria-label="Draft">Unsaved text</textarea>',
      }),
    );
    await page.goto(`${workspaceOrigin}/admin/`);
    await page
      .getByRole("button", { name: "Open editor", exact: true })
      .click();
    const draft = page
      .frameLocator("[data-editor]")
      .getByRole("textbox", { name: "Draft" });
    await draft.fill("Keep my unsaved changes");
    const submit = page.getByRole("button", { name: "Submit for review" });
    await submit.click();
    await expect.poll(() => requests).toBe(failedPhase + 1);
    await expect(
      page.getByRole("button", { name: "Submitting…" }),
    ).toBeDisabled();
    gate.resolve();
    await expect(page.getByRole("alert")).toHaveText(
      "Workspace unavailable. Try again.",
    );
    await expect(page.getByRole("alert")).toBeFocused();
    await expect(submit).toBeEnabled();
    await expect(page.locator("[data-progress]")).toBeEmpty();
    await expect(draft).toHaveValue("Keep my unsaved changes");
    await submit.click();
    await expect.poll(() => requests).toBe(failedPhase + 4);
    await expect(submit).toBeEnabled();
    await expect(page.getByRole("alert")).toBeHidden();
    await expect(draft).toHaveValue("Keep my unsaved changes");
  });
}

for (const width of [320, 375, 768, 1440]) {
  test(`full-screen editor preserves unsaved work at ${width}px`, async ({
    page,
  }) => {
    let editorLoads = 0;
    await page.route("**/workspace", (route) => route.fulfill({ json: state }));
    await page.route("**/admin/editor/", (route) => {
      editorLoads++;
      return route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html lang="en"><head><title>Editor</title></head><body><label>Draft<textarea></textarea></label><button onclick="document.querySelector(\'dialog\').showModal()">Open note</button><dialog aria-label="Editor note"><button>Note action</button></dialog></body></html>',
      });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${workspaceOrigin}/admin/`);
    const fullScreen = page.getByRole("button", {
      name: "Full screen",
      exact: true,
    });
    await expect(fullScreen).toBeHidden();
    await page
      .getByRole("button", { name: "Open editor", exact: true })
      .click();
    const editor = page.locator("[data-editor]");
    const draft = page
      .frameLocator("[data-editor]")
      .getByRole("textbox", { name: "Draft" });
    await draft.fill("Keep these unsaved edits");
    const embedded = await editor.boundingBox();
    await fullScreen.click();
    const panel = page.getByRole("dialog", { name: "Editorial workspace" });
    await expect
      .poll(() => panel.evaluate((element) => element.matches(":modal")))
      .toBe(true);
    expect(await panel.boundingBox()).toEqual({
      x: 0,
      y: 0,
      width,
      height: 900,
    });
    const expanded = await editor.boundingBox();
    expect(expanded!.width).toBeGreaterThan(embedded!.width);
    expect(expanded!.height).toBeGreaterThan(450);
    expect(expanded!.y + expanded!.height).toBeLessThanOrEqual(900);
    if (width >= 768)
      expect(expanded!.height).toBeGreaterThan(embedded!.height);
    await expect(
      page.getByRole("button", { name: "Submit for review" }),
    ).toBeVisible();
    await expect(draft).toHaveValue("Keep these unsaved edits");
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(await accessibilityFailures(page)).toEqual([]);
    const frame = page.frameLocator("[data-editor]");
    await frame.getByRole("button", { name: "Open note" }).click();
    await expect(
      frame.getByRole("dialog", { name: "Editor note" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      frame.getByRole("dialog", { name: "Editor note" }),
    ).toBeHidden();
    expect(await panel.evaluate((element) => element.matches(":modal"))).toBe(
      true,
    );
    await draft.focus();
    await page.keyboard.press("Escape");
    await expect
      .poll(() => panel.evaluate((element) => element.matches(":modal")))
      .toBe(false);
    await expect(fullScreen).toBeFocused();
    await expect(draft).toHaveValue("Keep these unsaved edits");
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
    await fullScreen.click();
    await page.getByRole("button", { name: "Exit full screen" }).click();
    await expect(fullScreen).toBeFocused();
    await expect(draft).toHaveValue("Keep these unsaved edits");
    expect(editorLoads).toBe(1);
  });
}

test("full-screen editor keeps submission feedback usable without closing the editor", async ({
  page,
}) => {
  const gate = Promise.withResolvers<void>();
  let submissions = 0;
  await page.route("**/workspace", async (route) => {
    if (route.request().postDataJSON()?.action === "submit") {
      submissions++;
      await gate.promise;
    }
    return route.fulfill({ json: state });
  });
  await page.route("**/admin/editor/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<label>Draft<textarea></textarea></label>",
    }),
  );
  await page.setViewportSize({ width: 900, height: 375 });
  await page.goto(`${workspaceOrigin}/admin/`);
  await page.getByRole("button", { name: "Open editor", exact: true }).click();
  const draft = page
    .frameLocator("[data-editor]")
    .getByRole("textbox", { name: "Draft" });
  await draft.fill("Still editing");
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect.poll(() => submissions).toBe(1);
  await expect(
    page.getByRole("button", { name: "Submitting…" }),
  ).toBeDisabled();
  await expect(page.locator("[data-progress]")).toHaveText(
    "Submitting saved changes…",
  );
  await expect(
    page.getByRole("button", { name: "Exit full screen" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Exit full screen" }).click();
  await expect(
    page.getByRole("button", { name: "Submitting…" }),
  ).toBeDisabled();
  await expect(draft).toHaveValue("Still editing");
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Editorial workspace" });
  expect(await panel.boundingBox()).toEqual({
    x: 0,
    y: 0,
    width: 900,
    height: 375,
  });
  gate.resolve();
  await expect(
    page.getByRole("button", { name: "Submit for review" }),
  ).toBeEnabled();
  await expect
    .poll(() => panel.evaluate((element) => element.matches(":modal")))
    .toBe(true);
  await expect(draft).toHaveValue("Still editing");
});

test("a closed preflight keeps submission disabled after cleanup and refresh", async ({
  page,
}) => {
  const gate = Promise.withResolvers<void>();
  let requests = 0;
  await page.route("**/workspace", async (route) => {
    const request = requests++;
    if (request === 1) await gate.promise;
    expect(route.request().postDataJSON()?.action).not.toBe("submit");
    await route.fulfill({
      json:
        request === 0
          ? state
          : {
              ...state,
              workspace: { ...state.workspace, status: "closed" },
            },
    });
  });
  await page.goto(`${workspaceOrigin}/admin/`);
  const submit = page.getByRole("button", { name: "Submit for review" });
  await submit.click();
  await expect(
    page.getByRole("button", { name: "Submitting…" }),
  ).toBeDisabled();
  gate.resolve();
  await expect(page.getByRole("alert")).toContainText("pull request is closed");
  await expect(submit).toBeDisabled();
  await expect(page.locator("[data-progress]")).toBeEmpty();
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect.poll(() => requests).toBe(3);
  await expect(
    page.getByRole("button", { name: "Refresh status" }),
  ).toBeEnabled();
  await expect(submit).toBeDisabled();
});

test("workspace handles expired sessions, submission errors and fresh status without hiding work", async ({
  page,
}) => {
  let expired = true;
  await page.route("**/workspace", (route) => {
    if (expired)
      return route.fulfill({
        status: 401,
        json: { message: "Your session expired. Saved work is safe." },
      });

    if (route.request().postDataJSON()?.action === "submit")
      return route.fulfill({
        status: 409,
        json: {
          message: "Main conflicts with this workspace. Saved work is safe.",
        },
      });
    return route.fulfill({ json: state });
  });
  await page.goto(`${workspaceOrigin}/admin/`);
  await expect(page.getByRole("alert")).toContainText("session expired");
  await expect(
    page.getByRole("button", { name: "Sign in with GitHub", exact: true }),
  ).toBeVisible();
  await expect(page.locator("iframe")).not.toHaveAttribute("src");
  expired = false;
  await page.reload();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByRole("alert")).toContainText("conflicts");
  await expect(page.getByRole("alert")).toBeFocused();
});

test("workspace login failures are visible and an expired editor never loads Sveltia", async ({
  page,
  context,
}) => {
  let bundleRequests = 0;
  await page.route("**/workspace", (route) =>
    route.fulfill({
      status: 401,
      json: { message: "Workspace session expired." },
    }),
  );
  await page.route("https://unpkg.com/**", (route) => {
    bundleRequests++;
    return route.abort();
  });
  await context.route("**/auth?**", async (route) => {
    const response = handleGitHubAuth(new Request(route.request().url()), {
      ALLOWED_DOMAINS: "cms.example",
    });
    await route.fulfill({
      contentType: "text/html",
      body: await response.text(),
    });
  });
  await page.goto(`${workspaceOrigin}/admin/`);
  await page
    .getByRole("button", { name: "Sign in with GitHub", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("GitHub sign-in failed");
  await page.goto(`${workspaceOrigin}/admin/editor/`);
  await expect(page.getByRole("alert")).toContainText("session expired");
  expect(bundleRequests).toBe(0);
});

test("workspace Pages routes fail closed outside the canonical host", async ({
  request,
}) => {
  for (const path of ["/workspace", "/workspace/git/batch-0/api/v3/user"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(403);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(await response.text()).toContain("canonical");
  }
});

test("workspace submission shows the same review PR and preserves an open editor when switching is cancelled", async ({
  page,
}) => {
  const pull = {
    number: 7,
    html_url: "https://github.com/example/editorial/pull/7",
  };
  let review = false;
  let merged = false;
  await page.route("**/workspace", (route) => {
    if (route.request().postDataJSON()?.action === "submit") {
      review = true;
      return route.fulfill({ json: { pull } });
    }
    return route.fulfill({
      json: {
        ...state,
        workspace: {
          ...state.workspace,
          branch: merged ? "content/42/batch-7" : state.workspace.branch,
          batch: merged ? "batch-7" : "batch-0",
          pull: review ? pull : null,
          status: review ? "review" : "editing",
        },
      },
    });
  });
  await page.route("**/admin/editor/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<p>Unsaved editor text</p>",
    }),
  );
  await page.goto(`${workspaceOrigin}/admin/`);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(
    page.getByRole("link", { name: "View pull request" }),
  ).toHaveAttribute("href", pull.html_url);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(
    page.getByRole("link", { name: "View pull request" }),
  ).toHaveAttribute("href", pull.html_url);
  await page.getByRole("button", { name: "Open editor", exact: true }).click();
  merged = true;
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(page.getByRole("status")).toContainText("Copy unsaved edits");
  await expect(
    page.frameLocator("[data-editor]").getByText("Unsaved editor text"),
  ).toBeVisible();
});

test("pinned Sveltia saves related entries and media through the real workspace gateway and leases", async ({
  page,
  context,
  baseURL,
}) => {
  const harness = await installWorkspaceGateway(page, context, baseURL!);
  const { github, leases } = harness;
  const writes = github.writes;
  try {
    await page.route(
      "https://unpkg.com/@sveltia/cms@0.201.1/dist/sveltia-cms.js",
      (route) =>
        route.fulfill({ contentType: "application/javascript", body: bundle }),
    );
    await page.goto(`${workspaceOrigin}/admin/`);
    await page
      .getByRole("button", { name: "Sign in with GitHub", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Open editor", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Full screen", exact: true })
      .click();
    const frame = page.frameLocator("[data-editor]");
    await expect(
      frame.getByRole("button", { name: /Sign in with.*GitHub/i }),
    ).toBeVisible();
    await frame.getByRole("button", { name: /Sign in with.*GitHub/i }).click();
    await frame.getByRole("option", { name: /^Authors / }).click();
    await frame
      .getByRole("button", { name: "Create New Entry", exact: true })
      .first()
      .click();
    await fillReadyField("Name", "Workspace Author");
    await frame
      .getByRole("button", { name: "Save", exact: true })
      .first()
      .click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].branch.branchName).toBe(state.workspace.branch);
    expect(writes[0].fileChanges.additions[0].path).toBe(
      "cms/content/authors/workspace-author/index.md",
    );
    expect(
      Buffer.from(
        writes[0].fileChanges.additions[0].contents,
        "base64",
      ).toString(),
    ).toContain("Workspace Author");
    await frame.getByRole("option", { name: /^Books / }).click();
    await frame
      .getByRole("button", { name: "Create New Entry", exact: true })
      .first()
      .click();
    await fillReadyField("Title", "Workspace Book");
    await frame
      .getByRole("checkbox", { name: "Workspace Author", exact: true })
      .check();
    await frame.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[1].branch.branchName).toBe(state.workspace.branch);
    expect(
      Buffer.from(
        writes[1].fileChanges.additions[0].contents,
        "base64",
      ).toString(),
    ).toContain("workspace-author");
    await frame.getByRole("option", { name: /^Book Readings / }).click();
    await frame
      .getByRole("button", { name: "Create New Entry", exact: true })
      .first()
      .click();
    await frame
      .getByRole("radio", {
        name: "Workspace Book workspace-author",
        exact: true,
      })
      .check();
    await fillReadyField("Title", "Workspace Reading");
    await frame
      .getByRole("textbox", { name: "Date and time (Pacific)", exact: true })
      .fill("2026-11-20T18:00");
    await frame
      .getByRole("textbox", { name: "Location", exact: true })
      .fill("Online");
    await frame
      .getByRole("textbox", { name: "Summary", exact: true })
      .fill("A shared reading.");
    await frame.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => writes.length).toBe(3);
    expect(writes[2].branch.branchName).toBe(state.workspace.branch);
    expect(
      Buffer.from(
        writes[2].fileChanges.additions[0].contents,
        "base64",
      ).toString(),
    ).toContain("workspace-book");
    await frame.getByRole("radio", { name: "Assets", exact: true }).click();
    await expect(
      frame.getByRole("radio", { name: "Assets", exact: true }),
    ).toBeChecked();
    const chooser = page.waitForEvent("filechooser");
    await frame
      .getByRole("button", { name: "Upload New Assets", exact: true })
      .first()
      .click();
    await frame
      .getByRole("button", { name: "Choose Files", exact: true })
      .click();
    await (
      await chooser
    ).setFiles({
      name: "workspace.png",
      mimeType: "image/png",
      buffer: readFileSync(
        new URL("../../app/assets/brand/favicon.png", import.meta.url),
      ),
    });
    await frame.getByRole("button", { name: "Upload", exact: true }).click();
    await expect.poll(() => writes.length).toBe(4);
    expect(writes[3].branch.branchName).toBe(state.workspace.branch);
    expect(writes[3].fileChanges.additions[0].path).toBe(
      "cms/public/media/shared/workspace.png",
    );
    await expect.poll(() => leases.length).toBe(5);
    expect(writes.map((write) => write.expectedHeadOid)).toEqual(
      leases.slice(0, -1).map((lease) => lease.sha),
    );
    expect(writes.map((write) => write.sha)).toEqual(
      leases.slice(1).map((lease) => lease.sha),
    );
    expect(new Set(leases.map((lease) => lease.sha)).size).toBe(5);
    const [cookie] = (await context.cookies()).filter(
      (value) => value.name === "__Secure-cms-editor",
    );
    expect(cookie).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
    });
    expect(await unseal(cookie.value, harness.env)).toMatchObject({
      sha: github.head,
      branch: github.branch,
    });
    expect([...github.files.keys()]).toEqual([
      "cms/content/authors/workspace-author/index.md",
      "cms/content/books/workspace-book/index.md",
      "cms/content/book-readings/workspace-reading/index.md",
      "cms/public/media/shared/workspace.png",
    ]);
    const submit = page.getByRole("button", {
      name: "Submit for review",
      exact: true,
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      await submit.click();
      // The PR link stays visible on retries, even while submission is pending.
      await expect(submit).toBeEnabled();
      await expect(
        page.getByRole("link", { name: "View pull request" }),
      ).toHaveAttribute("href", `https://github.com/${github.repo}/pull/7`);
    }
    expect(github.pullCreates).toBe(1);
    expect(github.mainSyncs).toBe(2);
    await settleEditor();
    expect(harness.failures).toEqual([]);
    expect(github.unexpected).toEqual([]);
  } finally {
    harness.restore();
  }

  async function fillReadyField(name: string, value: string) {
    const field = page
      .frameLocator("[data-editor]")
      .getByRole("textbox", { name, exact: true });
    await expect(field).toBeVisible();
    // The CMS transition must finish before the new form accepts input.
    await settleEditor();
    await field.fill(value);
    await expect(field).toHaveValue(value);
  }

  async function settleEditor() {
    await expect
      .poll(() =>
        page
          .frameLocator("[data-editor]")
          .locator("html")
          .evaluate(
            (element) =>
              CSS.supports("selector(:active-view-transition)") &&
              element.matches(":active-view-transition"),
          ),
      )
      .toBe(false);
  }
});
