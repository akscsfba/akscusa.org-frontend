import { describe, expect, it } from "vitest";

import { validateShortLinkPaths } from "./integration";

describe("short-link build checks", () => {
  it("allows unused root paths", () => {
    expect(() =>
      validateShortLinkPaths(
        "/ptitfm https://example.org/ 302\n",
        new Set(["books"]),
      ),
    ).not.toThrow();
  });

  it.each(["books", "admin", "auth", "callback", "magazine", "media"])(
    "rejects a link that would shadow /%s",
    (code) => {
      expect(() =>
        validateShortLinkPaths(
          `/${code}/ https://example.org/ 302\n`,
          new Set([code]),
        ),
      ).toThrow("conflicts");
    },
  );

  it("enforces the exact Pages line-length limit", () => {
    const prefix = "/book https://example.org/";
    const rule = `${prefix}${"a".repeat(1_000 - prefix.length - 4)} 302`;
    expect(() => validateShortLinkPaths(rule, new Set())).not.toThrow();
    expect(() => validateShortLinkPaths(`${rule}x`, new Set())).toThrow(
      "1,000",
    );
  });
});
