import { Script } from "node:vm";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  handleGitHubAuth,
  handleGitHubCallback,
  type GitHubOAuthEnv,
} from "./github-oauth";

const env: GitHubOAuthEnv = {
  ALLOWED_DOMAINS: "akscusa.org",
  GITHUB_CLIENT_ID: "client-id",
  GITHUB_CLIENT_SECRET: "client-secret",
};

function executePopup(html: string) {
  const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

  if (!source) {
    throw new Error("The OAuth response is missing its popup script.");
  }

  type Message = { data: unknown; origin: string };
  const listeners = new Map<string, (message: Message) => void>();
  const postMessage = vi.fn<(message: string, targetOrigin: string) => void>();
  const window = {
    opener: { postMessage },
    addEventListener(type: string, listener: (message: Message) => void) {
      listeners.set(type, listener);
    },
  };

  new Script(source).runInNewContext({ window, URL }, { timeout: 1000 });

  const receive = listeners.get("message");

  if (!receive) {
    throw new Error("The popup did not register its handshake listener.");
  }

  expect(postMessage).toHaveBeenCalledExactlyOnceWith(
    "authorizing:github",
    "*",
  );
  postMessage.mockClear();

  return { postMessage, receive };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("handleGitHubAuth", () => {
  it("redirects an allowed CMS to GitHub with a CSRF cookie", () => {
    const response = handleGitHubAuth(
      new Request(
        "https://akscusa.org/auth?provider=github&site_id=akscusa.org&scope=repo%2Cuser",
      ),
      env,
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("Location") ?? "");
    expect(location.origin + location.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(location.searchParams.get("client_id")).toBe("client-id");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://akscusa.org/callback",
    );
    expect(location.searchParams.get("scope")).toBe("repo,user");
    expect(response.headers.get("Set-Cookie")).toMatch(
      /^github-oauth-state=[0-9a-f]{32};/,
    );
  });

  it("rejects a caller outside the Pages site's allowed domains", async () => {
    const response = handleGitHubAuth(
      new Request(
        "https://akscusa.org/auth?provider=github&site_id=attacker.example",
      ),
      env,
    );

    expect(await response.text()).toContain("UNSUPPORTED_DOMAIN");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each(["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"] as const)(
    "reports a missing %s through an executable popup response",
    async (missing) => {
      const response = handleGitHubAuth(
        new Request(
          "https://akscusa.org/auth?provider=github&site_id=akscusa.org",
        ),
        { ...env, [missing]: undefined },
      );
      const { postMessage, receive } = executePopup(await response.text());

      receive({
        data: "authorizing:github",
        origin: "https://akscusa.org",
      });

      expect(postMessage).toHaveBeenCalledExactlyOnceWith(
        `authorization:github:error:${JSON.stringify({
          provider: "github",
          error: "The GitHub OAuth client is not configured.",
          errorCode: "MISCONFIGURED_CLIENT",
        })}`,
        "https://akscusa.org",
      );
    },
  );
});

describe("handleGitHubCallback", () => {
  it.each([
    { name: "ordinary token", token: "github-access-token" },
    {
      name: "value containing JavaScript and HTML delimiters",
      token:
        'token "quoted" \\\n</script><script>throw new Error("injected")</script>',
    },
  ])("completes the popup handshake with $name", async ({ token }) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ access_token: token })),
    );
    const state = "0123456789abcdef0123456789abcdef";
    const response = await handleGitHubCallback(
      new Request(
        `https://akscusa.org/callback?code=github-code&state=${state}`,
        { headers: { Cookie: `github-oauth-state=${state}` } },
      ),
      env,
    );
    const html = await response.text();

    expect(fetch).toHaveBeenCalledWith(
      "https://github.com/login/oauth/access_token",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: "github-code",
          redirect_uri: "https://akscusa.org/callback",
        }),
      }),
    );
    expect(html.match(/<script>/g)).toHaveLength(1);
    expect(html).not.toContain("client-secret");

    const { postMessage, receive } = executePopup(html);

    receive({
      data: "authorizing:github",
      origin: "https://attacker.example",
    });
    receive({ data: "authorizing:github", origin: "null" });
    receive({ data: "unrelated message", origin: "https://akscusa.org" });
    expect(postMessage).not.toHaveBeenCalled();

    receive({
      data: "authorizing:github",
      origin: "https://akscusa.org",
    });
    expect(postMessage).toHaveBeenCalledExactlyOnceWith(
      `authorization:github:success:${JSON.stringify({
        provider: "github",
        token,
      })}`,
      "https://akscusa.org",
    );
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects a callback whose state does not match its cookie", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await handleGitHubCallback(
      new Request(
        "https://akscusa.org/callback?code=github-code&state=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        {
          headers: {
            Cookie: "github-oauth-state=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          },
        },
      ),
      env,
    );

    const { postMessage, receive } = executePopup(await response.text());

    receive({
      data: "authorizing:github",
      origin: "https://akscusa.org",
    });

    expect(postMessage).toHaveBeenCalledExactlyOnceWith(
      `authorization:github:error:${JSON.stringify({
        provider: "github",
        error: "The authorization state did not match.",
        errorCode: "CSRF_DETECTED",
      })}`,
      "https://akscusa.org",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
