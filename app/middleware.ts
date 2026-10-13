import { defineMiddleware } from "astro:middleware";

import { loadShortLinks } from "~/features/short-links/queries/links";
import { shortLinkLocation } from "~/features/short-links/redirects";

export const onRequest = defineMiddleware(async (context, next) => {
  const requested = new URL(context.request.url);
  const response = await next();
  // Production redirects are handled by Pages before static files are served.
  // In dev, only replace a 404 so a short code cannot hide a real route.
  if (!import.meta.env.DEV || response.status !== 404) return response;
  const code = requested.pathname.replace(/^\/|\/$/g, "");
  const link = (await loadShortLinks()).find((entry) => entry.code === code);
  return link
    ? context.redirect(
        shortLinkLocation(link.destination, requested.search),
        302,
      )
    : response;
});
