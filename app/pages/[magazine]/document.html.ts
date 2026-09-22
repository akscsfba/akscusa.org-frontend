import type { APIRoute, GetStaticPaths } from "astro";

import document from "~/features/magazine/assets/aksc-10th-year-magazine.html?raw";
import { magazineSlug } from "~/features/magazine/routes";

export const getStaticPaths = (() => [
  { params: { magazine: magazineSlug } },
]) satisfies GetStaticPaths;

export const GET: APIRoute = () =>
  new Response(document, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
