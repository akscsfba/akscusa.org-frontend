import { describe, expect, it } from "vitest";
import { readReadingFilters, writeReadingFilters } from "./url-state";

const facets = [
  { key: "book", values: ["", "the-will-to-change"] },
  { key: "author", values: ["", "bell-hooks"] },
  { key: "year", values: ["", "2026"] },
];

describe("reading filter URLs", () => {
  it("round-trips the query and every facet without losing unrelated state", () => {
    const selected = {
      book: "the-will-to-change",
      author: "bell-hooks",
      year: "2026",
    };
    const url = writeReadingFilters(
      new URL("https://example.test/book-readings/?source=home#reading-log"),
      "love & liberation",
      selected,
    );
    expect(readReadingFilters(url.searchParams, facets)).toEqual({
      query: "love & liberation",
      selected,
      unavailable: [],
    });
    expect(url.searchParams.get("source")).toBe("home");
    expect(url.hash).toBe("#reading-log");
  });

  it("reports retired or unavailable facets without hiding the whole log", () => {
    expect(
      readReadingFilters(
        new URLSearchParams(
          "book=retired&year=1900&author=bell-hooks&q=Ambedkar",
        ),
        facets,
      ),
    ).toEqual({
      query: "Ambedkar",
      selected: { book: "", author: "bell-hooks", year: "" },
      unavailable: ["book", "year"],
    });
    expect(
      readReadingFilters(new URLSearchParams("book=retired"), [
        { key: "book", values: [] },
      ]).unavailable,
    ).toEqual(["book"]);
  });

  it("removes empty filters and canonicalizes repeated parameters", () => {
    const url = writeReadingFilters(
      new URL("https://example.test/?q=a&q=b&year=2026&author=old"),
      "  ",
      { year: "", author: "bell-hooks" },
    );
    expect(url.search).toBe("?author=bell-hooks");
  });
});
