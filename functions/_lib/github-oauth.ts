export interface GitHubOAuthEnv {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  ALLOWED_DOMAINS?: string;
}

const allowedScopes = new Set([
  "repo",
  "public_repo",
  "user",
  "read:user",
  "user:email",
]);

const responseHeaders = {
  "Cache-Control": "no-store",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  "Content-Type": "text/html; charset=UTF-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function domains(env: GitHubOAuthEnv, request: Request): string[] {
  const configured = env.ALLOWED_DOMAINS?.split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  return configured?.length
    ? configured
    : [new URL(request.url).hostname.toLowerCase()];
}

function scriptLiteral(value: string | string[]): string {
  // HTML recognizes </script> even inside a JavaScript string.
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function oauthResponse(
  request: Request,
  env: GitHubOAuthEnv,
  result: { token: string } | { error: string; errorCode: string },
): Response {
  const payload = JSON.stringify({ provider: "github", ...result });
  const state = "token" in result ? "success" : "error";
  const message = scriptLiteral(`authorization:github:${state}:${payload}`);
  const allowedDomains = scriptLiteral(domains(env, request));

  return new Response(
    `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>GitHub authorization</title></head>
  <body>
    <script>
      (() => {
        const allowedDomains = ${allowedDomains};
        const isAllowed = (origin) => {
          try {
            return allowedDomains.includes(new URL(origin).hostname.toLowerCase());
          } catch {
            return false;
          }
        };

        window.addEventListener("message", ({ data, origin }) => {
          if (data !== "authorizing:github" || !isAllowed(origin)) return;
          window.opener?.postMessage(
            ${message},
            origin,
          );
        });
        window.opener?.postMessage("authorizing:github", "*");
      })();
    </script>
  </body>
</html>`,
    {
      headers: {
        ...responseHeaders,
        "Set-Cookie":
          "github-oauth-state=deleted; HttpOnly; Max-Age=0; Path=/; SameSite=Lax; Secure",
      },
    },
  );
}

function errorResponse(
  request: Request,
  env: GitHubOAuthEnv,
  error: string,
  errorCode: string,
): Response {
  return oauthResponse(request, env, { error, errorCode });
}

function requestedScope(value: string | null): string {
  const scopes = (value ?? "").split(/[\s,]+/).filter(Boolean);

  return scopes.length && scopes.every((scope) => allowedScopes.has(scope))
    ? scopes.join(",")
    : "repo,user";
}

export function handleGitHubAuth(
  request: Request,
  env: GitHubOAuthEnv,
): Response {
  const url = new URL(request.url);

  if (url.searchParams.get("provider") !== "github") {
    return errorResponse(
      request,
      env,
      "This authenticator supports only the GitHub backend.",
      "UNSUPPORTED_BACKEND",
    );
  }

  const siteId = url.searchParams.get("site_id")?.toLowerCase();

  if (!siteId || !domains(env, request).includes(siteId)) {
    return errorResponse(
      request,
      env,
      "This site is not allowed to use the authenticator.",
      "UNSUPPORTED_DOMAIN",
    );
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return errorResponse(
      request,
      env,
      "The GitHub OAuth client is not configured.",
      "MISCONFIGURED_CLIENT",
    );
  }

  const state = crypto.randomUUID().replaceAll("-", "");
  const redirectUri = `${url.origin}/callback`;
  const authorizationUrl = new URL("https://github.com/login/oauth/authorize");

  authorizationUrl.search = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: requestedScope(url.searchParams.get("scope")),
    state,
  }).toString();

  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": "no-store",
      Location: authorizationUrl.toString(),
      "Referrer-Policy": "no-referrer",
      "Set-Cookie":
        `github-oauth-state=${state}; HttpOnly; Max-Age=600; ` +
        "Path=/; SameSite=Lax; Secure",
    },
  });
}

function stateCookie(request: Request): string | undefined {
  return request.headers
    .get("Cookie")
    ?.match(/(?:^|;\s*)github-oauth-state=([0-9a-f]{32})(?:;|$)/)?.[1];
}

function isTokenResponse(
  value: unknown,
): value is { access_token?: string; error?: string } {
  return typeof value === "object" && value !== null;
}

export async function handleGitHubCallback(
  request: Request,
  env: GitHubOAuthEnv,
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return errorResponse(
      request,
      env,
      "GitHub did not return an authorization code.",
      "AUTH_CODE_REQUEST_FAILED",
    );
  }

  if (stateCookie(request) !== state) {
    return errorResponse(
      request,
      env,
      "The authorization state did not match.",
      "CSRF_DETECTED",
    );
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return errorResponse(
      request,
      env,
      "The GitHub OAuth client is not configured.",
      "MISCONFIGURED_CLIENT",
    );
  }

  let response: Response;

  try {
    response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${url.origin}/callback`,
      }),
    });
  } catch {
    return errorResponse(
      request,
      env,
      "GitHub could not be reached to complete authorization.",
      "TOKEN_REQUEST_FAILED",
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return errorResponse(
      request,
      env,
      "GitHub returned an invalid authorization response.",
      "MALFORMED_RESPONSE",
    );
  }

  if (!isTokenResponse(payload) || !payload.access_token) {
    return errorResponse(
      request,
      env,
      payload && isTokenResponse(payload) && payload.error
        ? `GitHub authorization failed: ${payload.error}.`
        : "GitHub did not return an access token.",
      "TOKEN_REQUEST_FAILED",
    );
  }

  return oauthResponse(request, env, { token: payload.access_token });
}
