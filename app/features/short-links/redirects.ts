export const shortCodePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isShortLinkDestination(value: string): boolean {
  if (!/^https?:\/\/[^\s\\\p{Cc}]+$/u.test(value)) return false;
  try {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !["akscusa.org", "www.akscusa.org"].includes(
        url.hostname.toLowerCase().replace(/\.$/, ""),
      )
    );
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return false;
  }
}

export interface ShortLink {
  code: string;
  destination: string;
}

export function shortLinkLocation(destination: string, search: string): string {
  const url = new URL(destination);
  // Pages forwards the incoming query only when the destination has none.
  if (!url.search) url.search = search;
  return url.href;
}

export function shortLinkRules(links: readonly ShortLink[]): string {
  // Pages allows 2,000 static rules; each code has a trailing-slash alias.
  if (links.length > 1_000) {
    throw new Error(
      "Short links exceed Cloudflare Pages' 2,000 redirect limit.",
    );
  }
  const codes = new Set<string>();
  for (const { code, destination } of links) {
    if (!shortCodePattern.test(code) || !isShortLinkDestination(destination)) {
      throw new Error(`Invalid short link: ${code} -> ${destination}`);
    }
    if (codes.has(code)) throw new Error(`Duplicate short link: ${code}`);
    codes.add(code);
  }
  return links
    .flatMap(({ code, destination }) => [
      `/${code} ${destination} 302\n`,
      `/${code}/ ${destination} 302\n`,
    ])
    .join("");
}
