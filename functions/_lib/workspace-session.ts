import type { GitHubOAuthEnv } from "./github-oauth";

export interface WorkspaceEnv extends GitHubOAuthEnv {
  CMS_SESSION_KEY?: string;
  CMS_WORKSPACES_ENABLED?: string;
  ASSETS: { fetch: typeof fetch };
}

export class WorkspaceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const privateHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

const cookieName = "__Host-cms-workspace";

async function key(env: Pick<WorkspaceEnv, "CMS_SESSION_KEY">) {
  if (!env.CMS_SESSION_KEY?.match(/^[a-f0-9]{64}$/i)) {
    throw new WorkspaceError(
      503,
      "Workspace session encryption is not configured.",
    );
  }
  return crypto.subtle.importKey(
    "raw",
    Uint8Array.from(env.CMS_SESSION_KEY.match(/../g)!, (byte) =>
      parseInt(byte, 16),
    ),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decode(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(
    atob(text.replaceAll("-", "+").replaceAll("_", "/")),
    (char) => char.charCodeAt(0),
  );
}

export async function seal(
  payload: Record<string, unknown>,
  env: Pick<WorkspaceEnv, "CMS_SESSION_KEY">,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(
    JSON.stringify({ ...payload, expires: Date.now() + 8 * 60 * 60 * 1000 }),
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(env),
    data,
  );
  return `${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}

export function cookieValue(
  request: Request,
  name: string,
): string | undefined {
  return request.headers
    .get("Cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function unseal(
  value: string,
  env: Pick<WorkspaceEnv, "CMS_SESSION_KEY">,
): Promise<Record<string, unknown>> {
  const encryptionKey = await key(env);
  const [iv, encrypted] = value.split(".");
  const data = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decode(iv) },
    encryptionKey,
    decode(encrypted),
  );
  const payload = JSON.parse(new TextDecoder().decode(data));
  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof payload.expires !== "number" ||
    payload.expires <= Date.now()
  )
    throw new Error();
  return payload;
}

export async function sessionCookie(
  token: string,
  env: Pick<WorkspaceEnv, "CMS_SESSION_KEY">,
): Promise<string> {
  return `${cookieName}=${await seal({ kind: "session", token }, env)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`;
}

export const clearSessionCookie = `${cookieName}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;

export async function sessionToken(
  request: Request,
  env: WorkspaceEnv,
): Promise<string> {
  const value = cookieValue(request, cookieName);
  if (!value)
    throw new WorkspaceError(401, "Sign in to your editorial workspace.");
  try {
    const payload = await unseal(value, env);
    if (payload.kind !== "session" || typeof payload.token !== "string")
      throw new Error();
    return payload.token;
  } catch {
    throw new WorkspaceError(
      401,
      "Your workspace session expired. Sign in again; saved work is safe.",
    );
  }
}

export function guardOrigin(
  request: Request,
  env: Pick<WorkspaceEnv, "ALLOWED_DOMAINS">,
): void {
  const url = new URL(request.url);
  const allowed = env.ALLOWED_DOMAINS?.split(",").map((domain) =>
    domain.trim(),
  );
  if (url.protocol !== "https:" || !allowed?.includes(url.hostname)) {
    throw new WorkspaceError(
      403,
      "Use the canonical site's /admin/ workspace, not a preview or local server.",
    );
  }
  if (
    request.method !== "GET" &&
    request.headers.get("Origin") !== url.origin
  ) {
    throw new WorkspaceError(
      403,
      "Workspace requests must originate from this site.",
    );
  }
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") {
    throw new WorkspaceError(
      403,
      "Cross-site workspace requests are not allowed.",
    );
  }
}

export function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: privateHeaders });
}
