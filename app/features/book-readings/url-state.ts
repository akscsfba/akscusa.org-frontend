export interface ReadingFacet {
  key: string;
  values: readonly string[];
}

export function readReadingFilters(
  params: URLSearchParams,
  facets: readonly ReadingFacet[],
) {
  const selected: Record<string, string> = {};
  const unavailable: string[] = [];
  for (const facet of facets) {
    const requested = params.get(facet.key) ?? "";
    selected[facet.key] = facet.values.includes(requested) ? requested : "";
    if (requested && selected[facet.key] === "") unavailable.push(facet.key);
  }
  return { query: params.get("q") ?? "", selected, unavailable };
}

export function writeReadingFilters(
  url: URL,
  query: string,
  selected: Readonly<Record<string, string>>,
): URL {
  const result = new URL(url);
  for (const [key, value] of Object.entries({ q: query, ...selected })) {
    if (value.trim()) result.searchParams.set(key, value);
    else result.searchParams.delete(key);
  }
  return result;
}
