import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

import {
  isShortLinkDestination,
  shortCodePattern,
} from "~/features/short-links/redirects";

export const shortLinks = defineCollection({
  loader: glob({
    base: "./cms/content/short-links",
    pattern: "*.md",
    generateId: ({ entry }) =>
      z.string().regex(shortCodePattern).parse(entry.replace(/\.md$/, "")),
  }),
  schema: z.object({
    title: z.string().min(1),
    destination: z.string().refine(isShortLinkDestination, {
      message:
        "Use a full external HTTP(S) URL without spaces or credentials. Links to akscusa.org would risk redirect loops.",
    }),
    draft: z.boolean().default(false),
  }),
});
