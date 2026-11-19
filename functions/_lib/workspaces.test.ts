import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleWorkspace } from "./workspace-handler";
import {
  sessionCookie,
  sessionToken,
  type WorkspaceEnv,
} from "./workspace-session";
import { handleGitHubCallback } from "./github-oauth";
import type { Pull } from "./workspaces";
import { editorConfig } from "../../app/features/cms-workspace/editor";
import { editorCookie } from "./workspace-lease";

const repo = "example/editorial";
const branch = "content/42/batch-0";
const editorId = "e".repeat(32);
const env: WorkspaceEnv = {
  ALLOWED_DOMAINS: "cms.example",
  CMS_WORKSPACES_ENABLED: "true",
  GITHUB_CLIENT_ID: "client",
  GITHUB_CLIENT_SECRET: "secret",
  ASSETS: { fetch: async () => Response.json({ repo }) },
};
let cookie: string;
let refs: Map<string, string>;
let pulls: Pull[];
let requests: Array<{
  path: string;
  method: string;
  body: Record<string, unknown>;
}>;
let changes: string[];
let conflict: boolean;
let access: boolean;
let userId: number;
let duplicatePull: boolean;
let refRace: boolean;

function pull(state: "open" | "closed" = "open", merged = false): Pull {
  return {
    number: 7,
    state,
    merged_at: merged ? "2026-01-01" : null,
    html_url: "https://github.com/example/editorial/pull/7",
    head: { ref: branch, sha: "saved", repo: { full_name: repo } },
  };
}

async function call(
  action?: string,
  extra: Record<string, unknown> = {},
  options: { origin?: string; cookie?: string; path?: string } = {},
) {
  return handleWorkspace(
    new Request(`https://cms.example${options.path ?? "/workspace"}`, {
      method: action ? "POST" : "GET",
      headers: {
        Cookie: options.cookie ?? cookie,
        Origin: options.origin ?? "https://cms.example",
        "Content-Type": "application/json",
      },
      ...(action ? { body: JSON.stringify({ action, ...extra }) } : {}),
    }),
    env,
  );
}

beforeEach(async () => {
  cookie = (await sessionCookie("private-github-token", env)).split(";")[0];
  cookie += `; ${(await editorCookie(editorId, 42, repo, { branch, sha: "saved", batch: "batch-0", status: "editing", pull: null }, env)).split(";")[0]}`;
  refs = new Map([["main", "main-head"]]);
  pulls = [];
  requests = [];
  changes = [];
  conflict = false;
  access = true;
  userId = 42;
  duplicatePull = false;
  refRace = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input);
      expect(url.origin).toBe("https://api.github.com");
      const path = url.pathname;
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      requests.push({ path, method, body });
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        "Bearer private-github-token",
      );
      if (path === "/user")
        return Response.json({ id: userId, login: "editor" });
      if (path === `/repos/${repo}`)
        return Response.json({
          full_name: repo,
          permissions: { push: access },
        });
      if (path.includes("/git/matching-refs/heads/")) {
        const prefix = path.split("/git/matching-refs/heads/")[1];
        return Response.json(
          [...refs]
            .filter(([name]) => name.startsWith(prefix))
            .map(([name, sha]) => ({
              ref: `refs/heads/${name}`,
              object: { sha },
            })),
        );
      }
      if (path.endsWith("/pulls") && method === "GET")
        return Response.json(pulls);
      if (path.includes("/git/ref/heads/")) {
        const sha = refs.get(path.split("/git/ref/heads/")[1]);
        return sha
          ? Response.json({ object: { sha } })
          : new Response(null, { status: 404 });
      }
      if (path.endsWith("/git/refs")) {
        const name = body.ref.replace("refs/heads/", "");
        if (refRace) {
          refs.set(name, body.sha);
          return new Response(null, { status: 422 });
        }
        if (refs.has(name)) return new Response(null, { status: 422 });
        refs.set(name, body.sha);
        return Response.json({});
      }
      if (path.endsWith("/merges")) {
        if (conflict) return new Response(null, { status: 409 });
        return new Response(null, { status: 204 });
      }
      if (path.includes("/compare/"))
        return Response.json({
          files: changes.map((filename) => ({ filename })),
          total_commits: changes.length,
        });
      if (path.endsWith("/pulls") && method === "POST") {
        pulls.push(pull());
        return duplicatePull
          ? new Response(null, { status: 422 })
          : Response.json(pulls[0]);
      }
      if (path === "/graphql") {
        if (!String(body.query).includes("createCommitOnBranch"))
          return Response.json({ data: { repository: {} } });
        refs.set(branch, "next");
        return Response.json({
          data: { createCommitOnBranch: { commit: { oid: "next" } } },
        });
      }
      if (path.includes("/git/trees/") || path.includes("/git/blobs/"))
        return Response.json({});
      throw new Error(`Unexpected mock request: ${path}`);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("editorial workspace lifecycle", () => {
  it("creates once from main and resumes the same user on another session/device", async () => {
    const first = await (await call("resume")).json();
    expect(first).toMatchObject({
      workspace: { branch, sha: "main-head", status: "editing" },
    });
    const secondCookie = (
      await sessionCookie("private-github-token", env)
    ).split(";")[0];
    expect(
      await (await call("resume", {}, { cookie: secondCookie })).json(),
    ).toEqual(first);
    expect(
      requests.filter((item) => item.path.endsWith("/git/refs")),
    ).toHaveLength(1);
  });

  it("resolves simultaneous first-login branch creation without a second branch", async () => {
    refRace = true;
    expect((await call("resume")).status).toBe(200);
    expect([...refs.keys()]).toEqual(["main", branch]);
  });

  it("authorizes identity and repository access instead of accepting user/branch/repo input", async () => {
    userId = 99;
    const result = await (
      await call("resume", { user: 42, branch, repo: "other/repo" })
    ).json();
    expect(result).toMatchObject({
      workspace: { branch: "content/99/batch-0" },
    });
    access = false;
    expect((await call("resume")).status).toBe(403);
  });

  it("submits a normal batch PR after non-forced main sync and reuses it", async () => {
    refs.set(branch, "saved");
    changes = [
      "cms/content/authors/new/index.md",
      "cms/content/books/new/index.md",
    ];
    expect((await call("submit", { branch, sha: "saved" })).status).toBe(200);
    expect((await call("submit", { branch, sha: "saved" })).status).toBe(200);
    expect(
      requests.filter(
        (item) => item.path.endsWith("/pulls") && item.method === "POST",
      ),
    ).toHaveLength(1);
    expect(
      requests.find((item) => item.path.endsWith("/merges"))?.body,
    ).toMatchObject({ base: branch, head: "main-head" });
    expect(
      requests.find(
        (item) => item.path.endsWith("/pulls") && item.method === "POST",
      )?.body,
    ).toMatchObject({ draft: false, base: "main", head: branch });
  });

  it("reuses the winner of concurrent PR submissions", async () => {
    refs.set(branch, "saved");
    changes = ["entry"];
    duplicatePull = true;
    expect(
      await (await call("submit", { branch, sha: "saved" })).json(),
    ).toMatchObject({ pull: { number: 7 } });
  });

  it("returns an existing PR when a duplicate submission carries the pre-sync head", async () => {
    refs.set(branch, "synced-head");
    pulls = [pull()];
    expect(
      await (await call("submit", { branch, sha: "saved" })).json(),
    ).toMatchObject({ pull: { number: 7 } });
    expect(requests.some((item) => item.method !== "GET")).toBe(false);
  });

  it("reports empty workspaces and merge conflicts without opening a PR or resetting", async () => {
    refs.set(branch, "saved");
    expect(
      await (await call("submit", { branch, sha: "saved" })).text(),
    ).toContain("no file changes");
    conflict = true;
    changes = ["entry"];
    expect(
      await (await call("submit", { branch, sha: "saved" })).text(),
    ).toContain("conflicts");
    expect(refs.get(branch)).toBe("saved");
    expect(pulls).toEqual([]);
    expect(
      requests.every(
        (item) => item.method !== "PATCH" && item.method !== "DELETE",
      ),
    ).toBe(true);
  });

  it("rejects stale tab submission before syncing or publishing", async () => {
    refs.set(branch, "new-save");
    expect((await call("submit", { branch, sha: "old-save" })).status).toBe(
      409,
    );
    expect(requests.some((item) => item.path.endsWith("/merges"))).toBe(false);
  });

  it("starts a fresh generation after merge, including deleted merged branches", async () => {
    pulls = [pull("closed", true)];
    refs.set(branch, "saved");
    const result = await (await call("resume")).json();
    expect(result).toMatchObject({
      workspace: { branch: "content/42/batch-7", sha: "main-head" },
    });
    expect(refs.get(branch)).toBe("saved");
    refs.delete(branch);
    expect((await call("resume")).status).toBe(200);
  });

  it("preserves closed-without-merge work and requires explicit reopening", async () => {
    pulls = [pull("closed")];
    refs.set(branch, "saved");
    expect(await (await call("resume")).json()).toMatchObject({
      workspace: { branch, status: "closed" },
    });
    expect(
      await (await call("submit", { branch, sha: "saved" })).text(),
    ).toContain("closed without merging");
  });

  it("fails closed for missing unpublished branches, multiple active batches, and post-merge saves", async () => {
    pulls = [pull("closed")];
    expect((await call("resume")).status).toBe(409);
    refs.set(branch, "saved");
    refs.set("content/42/batch-9", "other");
    expect((await call("resume")).status).toBe(409);
    refs.delete("content/42/batch-9");
    pulls = [pull("closed", true)];
    refs.set(branch, "post-merge");
    expect(await (await call("resume")).text()).toContain("commits after");
  });

  it("blocks cutover for legacy branches and legacy open PRs without touching them", async () => {
    refs.set("cms/authors/legacy", "legacy");
    expect(await (await call("resume")).text()).toContain("Cutover blocked");
    refs.delete("cms/authors/legacy");
    pulls = [{ ...pull(), head: { ...pull().head, ref: "cms/books/legacy" } }];
    expect((await call("resume")).status).toBe(409);
    expect(requests.every((item) => item.method === "GET")).toBe(true);
  });
});

describe("workspace session and CMS boundary", () => {
  it("uses the existing OAuth secret and invalidates sessions when it rotates", async () => {
    const request = new Request("https://cms.example/workspace", {
      headers: { Cookie: cookie },
    });
    await expect(sessionToken(request, env)).resolves.toBe(
      "private-github-token",
    );
    await expect(
      sessionToken(request, {
        ...env,
        GITHUB_CLIENT_SECRET: "rotated-client-secret",
      }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      sessionToken(request, { ...env, GITHUB_CLIENT_SECRET: undefined }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("expires sessions and leaves disabled or unconfigured builds disconnected", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 9 * 60 * 60 * 1000);
    expect((await call("resume")).status).toBe(401);
    vi.useRealTimers();
    const request = new Request("https://cms.example/workspace", {
      headers: { Cookie: cookie },
    });
    expect(
      (
        await handleWorkspace(request, {
          ...env,
          CMS_WORKSPACES_ENABLED: "false",
        })
      ).status,
    ).toBe(503);
    expect(
      (
        await handleWorkspace(request, {
          ...env,
          ASSETS: {
            fetch: async () => Response.json({ repo: "OWNER/REPOSITORY" }),
          },
        })
      ).status,
    ).toBe(503);
    expect(requests).toEqual([]);
  });
  it("requires a valid session and same-origin mutation, with no-store responses", async () => {
    expect((await call("resume", {}, { cookie: "" })).status).toBe(401);
    expect(
      (await call("resume", {}, { cookie: `${cookie.split(";")[0]}tampered` }))
        .status,
    ).toBe(401);
    expect(
      (await call("resume", {}, { origin: "https://evil.example" })).status,
    ).toBe(403);
    expect((await call("resume")).headers.get("Cache-Control")).toBe(
      "no-store",
    );
    expect(cookie).not.toContain("private-github-token");
    await expect(
      sessionToken(
        new Request("https://cms.example", { headers: { Cookie: cookie } }),
        env,
      ),
    ).resolves.toBe("private-github-token");
  });

  it("keeps the OAuth token server-side and returns only the inert CMS handshake token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ access_token: "private-github-token" }),
      ),
    );
    const response = await handleGitHubCallback(
      new Request(
        `https://cms.example/callback?code=code&state=${"a".repeat(32)}`,
        {
          headers: { Cookie: `github-oauth-state=${"a".repeat(32)}.workspace` },
        },
      ),
      env,
    );
    expect(await response.text()).not.toContain("private-github-token");
    expect(response.headers.get("Set-Cookie")).toContain(
      "__Host-cms-workspace=",
    );
  });

  it("pins simple-mode init, every collection, and all media to the same gateway branch", () => {
    const config = editorConfig(
      {
        repo,
        editorId,
        user: { id: 42, login: "editor" },
        workspace: {
          branch,
          sha: "saved",
          batch: "batch-0",
          status: "editing",
          pull: null,
        },
      },
      "https://cms.example",
    );
    expect(config).toMatchObject({
      publish_mode: "simple",
      backend: {
        branch,
        repo,
        api_root: `https://cms.example/workspace/git/batch-0/${editorId}/api/v3`,
      },
    });
    expect(config).not.toHaveProperty("collections");
    expect(() =>
      editorConfig(
        { repo, editorId, user: { id: 42, login: "editor" }, workspace: null },
        "https://cms.example",
      ),
    ).toThrow();
  });

  async function save(
    path: string,
    targetBranch = branch,
    targetRepo = repo,
    sha = refs.get(targetBranch) ?? "saved",
  ) {
    const response = await handleWorkspace(
      new Request(
        `https://cms.example/workspace/git/batch-0/${editorId}/api/graphql`,
        {
          method: "POST",
          headers: {
            Cookie: cookie,
            Origin: "https://cms.example",
            Authorization: "token workspace-session",
          },
          body: JSON.stringify({
            query:
              "mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }",
            variables: {
              input: {
                branch: {
                  repositoryNameWithOwner: targetRepo,
                  branchName: targetBranch,
                },
                expectedHeadOid: sha,
                message: { headline: "Save" },
                fileChanges: {
                  additions: [{ path, contents: "YQ==" }],
                  deletions: [{ path }],
                },
              },
            },
          }),
        },
      ),
      env,
    );
    const updated = response.headers.get("Set-Cookie");
    if (updated) cookie = `${cookie.split(";")[0]}; ${updated.split(";")[0]}`;
    return response;
  }

  it("issues private per-editor snapshots and blocks another tab even if it refetches the latest head", async () => {
    refs.set(branch, "saved");
    const snapshot = await call("editor");
    expect(snapshot.status).toBe(200);
    expect(snapshot.headers.get("Set-Cookie")).toContain("HttpOnly; Secure");
    expect(snapshot.headers.get("Set-Cookie")).toContain(
      "Path=/workspace/git/batch-0/",
    );
    const staleCookie = cookie;
    expect((await save("cms/content/authors/new/index.md")).status).toBe(200);
    const advancedCookie = cookie;
    expect(advancedCookie).not.toBe(staleCookie);
    cookie = staleCookie;
    // Pinned Sveltia refetches the head immediately before saving; the lease
    // must reject an old form even when its expectedHeadOid is now up to date.
    const stale = await save(
      "cms/content/authors/new/index.md",
      branch,
      repo,
      "next",
    );
    expect(stale.status).toBe(409);
    expect(await stale.text()).toContain("snapshot is stale");
    cookie = advancedCookie;
    expect((await save("cms/content/books/new/index.md")).status).toBe(200);
  });

  it("allows related entries, uploads and deletions only on the current workspace", async () => {
    refs.set(branch, "saved");
    for (const path of [
      "cms/content/authors/new/index.md",
      "cms/content/books/new/index.md",
      "cms/content/book-readings/new/index.md",
      "cms/content/books/new/cover.jpg",
      "cms/public/media/shared/file.pdf",
    ]) {
      expect((await save(path)).status, path).toBe(200);
    }
    expect((await save("app/pages/index.astro")).status).toBe(403);
    expect((await save("cms/content/../config.yml")).status).toBe(403);
    expect((await save("cms/content/books/new/index.md", "main")).status).toBe(
      403,
    );
    expect(
      (await save("cms/content/books/new/index.md", branch, "other/repo"))
        .status,
    ).toBe(403);
    expect(
      (await save("cms/content/books/new/index.md", branch, repo, "stale"))
        .status,
    ).toBe(409);
    pulls = [
      { ...pull("closed", true), head: { ...pull().head, sha: "next" } },
    ];
    expect((await save("cms/content/books/new/index.md")).status).toBe(409);
  });

  it("scopes native collection reads to the active branch and rejects fallback or arbitrary mutations", async () => {
    refs.set(branch, "saved");
    async function query(
      text: string,
      variables: Record<string, unknown> = {},
    ) {
      return handleWorkspace(
        new Request(
          `https://cms.example/workspace/git/batch-0/${editorId}/api/graphql`,
          {
            method: "POST",
            headers: {
              Cookie: cookie,
              Origin: "https://cms.example",
              Authorization: "token workspace-session",
            },
            body: JSON.stringify({
              query: text,
              variables: {
                owner: "example",
                repo: "editorial",
                branch,
                ...variables,
              },
            }),
          },
        ),
        env,
      );
    }
    const read =
      "query($owner: String!, $repo: String!, $branch: String!) { repository(owner: $owner, name: $repo) { ref(qualifiedName: $branch) { target { oid } } } }";
    expect((await query(read)).status).toBe(200);
    expect((await query(read, { branch: "main" })).status).toBe(403);
    expect((await query(read, { owner: "elsewhere" })).status).toBe(403);
    expect(
      (
        await query(
          "query($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { defaultBranchRef { name } } }",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await query(
          'mutation { deleteRef(input: { refId: "main" }) { clientMutationId } }',
        )
      ).status,
    ).toBe(403);
  });
});
