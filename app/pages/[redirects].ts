import type { APIRoute, GetStaticPaths } from "astro";

import { loadShortLinks } from "~/features/short-links/queries/links";
import { shortLinkRules } from "~/features/short-links/redirects";

// Astro ignores route filenames beginning with "_"; emit Pages' filename
// through a static parameter instead.
export const getStaticPaths = (() => [
  { params: { redirects: "_redirects" } },
]) satisfies GetStaticPaths;

export const GET: APIRoute = async () =>
  new Response(shortLinkRules(await loadShortLinks()), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
