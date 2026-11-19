import type { BrowserContext, Page, Route } from "@playwright/test";
import { handleWorkspace } from "../../functions/_lib/workspace-handler";
import {
  handleGitHubAuth,
  handleGitHubCallback,
} from "../../functions/_lib/github-oauth";
import {
  unseal,
  type WorkspaceEnv,
} from "../../functions/_lib/workspace-session";
import { WorkspaceGitHub } from "./workspace-github";

export const workspaceOrigin = "https://cms.example";

async function staticResponse(route: Route, baseURL: string) {
  const url = new URL(route.request().url());
  return route.fulfill({
    response: await route.fetch({
      url: `${baseURL}${url.pathname}${url.search}`,
    }),
  });
}

export async function serveWorkspaceOrigin(
  page: Page,
  context: BrowserContext,
  baseURL: string,
): Promise<void> {
  const handler = (route: Route) => staticResponse(route, baseURL);
  await context.route(`${workspaceOrigin}/**`, handler);
  await page.route(`${workspaceOrigin}/**`, handler);
}

export async function installWorkspaceGateway(
  page: Page,
  context: BrowserContext,
  baseURL: string,
) {
  const github = new WorkspaceGitHub(workspaceOrigin);
  const originalFetch = globalThis.fetch;
  // Only external GitHub/OAuth transport is replaced. All workspace, auth,
  // authorization, proxy and lease code below is the production implementation.
  globalThis.fetch = github.fetch;
  const env: WorkspaceEnv = {
    ALLOWED_DOMAINS: "cms.example",
    CMS_WORKSPACES_ENABLED: "true",
    GITHUB_CLIENT_ID: "test-client",
    GITHUB_CLIENT_SECRET: "test-secret",
    // Equivalent to a test deployment built with CMS_REPO=example/editorial.
    ASSETS: {
      fetch: async (input) => {
        const url = new URL(
          input instanceof Request ? input.url : String(input),
        );
        if (url.pathname !== "/admin/workspace.json")
          throw new Error("Unexpected ASSETS request");
        return Response.json({ repo: github.repo });
      },
    },
  };
  const leases: Array<{ editorId: unknown; sha: unknown }> = [];
  const failures: string[] = [];

  async function send(route: Route, response: Response) {
    // Playwright's Record<string,string> response headers cannot reliably carry
    // multiple Set-Cookie fields. Apply each real header with its original
    // cookie scope/flags, then let the browser supply Cookie on later requests.
    for (const header of response.headers.getSetCookie()) {
      const [pair, ...attributes] = header
        .split(";")
        .map((part) => part.trim());
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      const attribute = (key: string) =>
        attributes
          .find((part) => part.toLowerCase().startsWith(`${key}=`))
          ?.slice(key.length + 1);
      const maxAge = attribute("max-age");
      await context.addCookies([
        {
          name,
          value,
          domain: new URL(workspaceOrigin).hostname,
          path: attribute("path") ?? "/",
          httpOnly: attributes.includes("HttpOnly"),
          secure: attributes.includes("Secure"),
          sameSite: attribute("samesite") === "Strict" ? "Strict" : "Lax",
          ...(maxAge === undefined
            ? {}
            : {
                expires:
                  Number(maxAge) === 0 ? 1 : Date.now() / 1000 + Number(maxAge),
              }),
        },
      ]);
      if (name === "__Secure-cms-editor") {
        const payload = await unseal(value, env);
        leases.push({ editorId: payload.editorId, sha: payload.sha });
      }
    }
    const headers = Object.fromEntries(response.headers);
    delete headers["set-cookie"];
    if (response.status >= 400 && response.status !== 401)
      failures.push(
        `${route.request().method()} ${new URL(route.request().url()).pathname}: ${response.status}`,
      );
    await route.fulfill({
      status: response.status,
      headers,
      body: Buffer.from(await response.arrayBuffer()),
    });
  }

  async function handler(route: Route) {
    const source = route.request();
    const url = new URL(source.url());
    const request = new Request(source.url(), {
      method: source.method(),
      headers: await source.allHeaders(),
      ...(source.postDataBuffer()
        ? { body: new Uint8Array(source.postDataBuffer()!) }
        : {}),
    });
    if (url.pathname === "/auth") {
      const response = handleGitHubAuth(request, env);
      if (response.status !== 302) return send(route, response);
      const provider = new URL(response.headers.get("Location")!);
      if (provider.origin !== "https://github.com")
        throw new Error("Unexpected OAuth provider");
      const callback = `${workspaceOrigin}/callback?code=mock-code&state=${provider.searchParams.get("state")}`;
      const headers = new Headers(response.headers);
      headers.delete("Location");
      headers.set("Content-Type", "text/html");
      // Emulate the upstream authorization page, not our callback. A script
      // navigation starts a new intercepted request; Playwright may otherwise
      // follow a fulfilled HTTP redirect outside the route interception chain.
      return send(
        route,
        new Response(
          `<script>location.replace(${JSON.stringify(callback)})</script>`,
          { headers },
        ),
      );
    }
    if (url.pathname === "/callback")
      return send(route, await handleGitHubCallback(request, env));
    if (url.pathname === "/workspace" || url.pathname.startsWith("/workspace/"))
      return send(route, await handleWorkspace(request, env));
    return staticResponse(route, baseURL);
  }
  await context.route(`${workspaceOrigin}/**`, handler);
  await page.route(`${workspaceOrigin}/**`, handler);
  await context.route("https://github.com/**", (route) => route.abort());
  await context.route("https://api.github.com/**", (route) => route.abort());
  return {
    github,
    leases,
    failures,
    env,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}
