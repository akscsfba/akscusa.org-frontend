import { readFile, readdir } from "node:fs/promises";

import type { AstroIntegration } from "astro";

export function validateShortLinkPaths(
  rules: string,
  occupied: ReadonlySet<string>,
): void {
  for (const line of rules.trim().split("\n").filter(Boolean)) {
    const code = line.split(" ")[0]!.replace(/^\/|\/$/g, "");
    if (occupied.has(code)) {
      throw new Error(
        `Short link /${code} conflicts with an existing site path. Choose another short code in the CMS.`,
      );
    }
    if (line.length > 1_000) {
      throw new Error(
        `Short link /${code} exceeds Pages' 1,000-character rule limit.`,
      );
    }
  }
}

export function shortLinks(): AstroIntegration {
  const routeRoots = new Set([
    "auth",
    "callback",
    "blog",
    "anti-caste-helpline",
  ]);
  return {
    name: "short-link-collisions",
    hooks: {
      "astro:routes:resolved": ({ routes }) => {
        for (const { pattern } of routes) {
          const root = pattern.split("/")[1];
          if (root && !root.startsWith("[")) routeRoots.add(root);
        }
      },
      "astro:build:done": async ({ dir }) => {
        const output = await readdir(dir, { withFileTypes: true });
        const occupied = new Set([
          ...routeRoots,
          ...output.map((entry) =>
            entry.isDirectory()
              ? entry.name
              : entry.name.replace(/\.html$/, ""),
          ),
        ]);
        const rules = await readFile(new URL("_redirects", dir), "utf8");
        validateShortLinkPaths(rules, occupied);
      },
    },
  };
}
