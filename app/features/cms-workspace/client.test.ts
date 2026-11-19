import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionError, workspaceRequest } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("workspace response errors", () => {
  it.each([
    { name: "Cloudflare HTML error", status: 502, type: "text/html" },
    { name: "malformed JSON response", status: 200, type: "application/json" },
  ])(
    "reports a $name without exposing a JSON parser error",
    async ({ status, type }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response("<!DOCTYPE html><title>Bad gateway</title>", {
            status,
            headers: { "Content-Type": type },
          }),
        ),
      );

      await expect(workspaceRequest("resume")).rejects.toThrow(
        `The CMS workspace server returned an invalid response (HTTP ${status})`,
      );
    },
  );

  it("preserves the sign-in action for an expired JSON session response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { message: "Your session expired. Sign in again." },
            { status: 401 },
          ),
        ),
    );

    await expect(workspaceRequest("resume")).rejects.toBeInstanceOf(
      SessionError,
    );
  });
});
