import { describe, expect, it } from "vitest";

import {
  isShortLinkDestination,
  shortLinkLocation,
  shortLinkRules,
} from "./redirects";

describe("short-link redirects", () => {
  it("matches Pages query forwarding while keeping destination fragments", () => {
    expect(
      shortLinkLocation("https://example.org/book.pdf#page=10", "?ref=reading"),
    ).toBe("https://example.org/book.pdf?ref=reading#page=10");
    expect(
      shortLinkLocation(
        "https://example.org/book.pdf?edition=2#page=10",
        "?ref=reading",
      ),
    ).toBe("https://example.org/book.pdf?edition=2#page=10");
  });
  it("generates editable HTTP redirects with a trailing-slash alias", () => {
    expect(
      shortLinkRules([
        { code: "ptitfm", destination: "https://example.org/book.pdf" },
      ]),
    ).toBe(
      "/ptitfm https://example.org/book.pdf 302\n/ptitfm/ https://example.org/book.pdf 302\n",
    );
    expect(shortLinkRules([])).toBe("");
  });

  it.each([
    "javascript:alert(1)",
    "//example.org/book.pdf",
    "/books/",
    "https://akscusa.org/another",
    "https://www.akscusa.org./another",
    "https://user:password@example.org/",
    "https://example.org/a b",
    "https://example.org/\\book",
    "https://example.org/\n/other 301",
    "https://example.org/\u0000",
    "https://",
  ])("rejects unsafe or looping destination %j", (destination) => {
    expect(isShortLinkDestination(destination)).toBe(false);
    expect(() => shortLinkRules([{ code: "book", destination }])).toThrow();
  });

  it.each([
    "https://example.org/book.pdf?a=1&b=2#page=10",
    "http://example.org/",
  ])("preserves destination %s", (destination) => {
    expect(isShortLinkDestination(destination)).toBe(true);
    expect(shortLinkRules([{ code: "book-1", destination }])).toContain(
      destination,
    );
  });

  it.each(["Books", "a/b", "a b", "-a", "a--b", "", "a*"])(
    "rejects invalid code %j",
    (code) => {
      expect(() =>
        shortLinkRules([{ code, destination: "https://example.org/" }]),
      ).toThrow();
    },
  );

  it("rejects duplicates and enforces the exact Pages rule limit", () => {
    const link = { code: "book", destination: "https://example.org/" };
    expect(() => shortLinkRules([link, link])).toThrow("Duplicate");
    const links = Array.from({ length: 1_000 }, (_, index) => ({
      ...link,
      code: `book-${index}`,
    }));
    expect(shortLinkRules(links).trim().split("\n")).toHaveLength(2_000);
    expect(() => shortLinkRules([...links, link])).toThrow("2,000");
  });
});
