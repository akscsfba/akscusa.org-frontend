import type { GitHubOAuthEnv } from "./github-oauth";

export interface WorkspaceEnv extends GitHubOAuthEnv {
  CMS_WORKSPACES_ENABLED?: string;
  ASSETS: { fetch: typeof fetch };
}

type SessionEnv = Pick<WorkspaceEnv, "GITHUB_CLIENT_SECRET">;

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

async function key(env: SessionEnv) {
  if (!env.GITHUB_CLIENT_SECRET) {
    throw new WorkspaceError(503, "GitHub OAuth is not configured.");
  }
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.GITHUB_CLIENT_SECRET),
    "HKDF",
    false,
    ["deriveKey"],
  );
  // Domain separation reuses the provisioned OAuth secret without using it
  // directly as an encryption key or requiring another deployment secret.
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode("akscusa.org/cms"),
      info: encoder.encode("workspace-session-v1"),
    },
    material,
    { name: "AES-GCM", length: 256 },
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
  env: SessionEnv,
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
  env: SessionEnv,
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
  env: SessionEnv,
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
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
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
