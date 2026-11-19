import { GitHub, type Identity } from "./workspace-github";
import { WorkspaceError } from "./workspace-session";

interface Ref {
  ref: string;
  object: { sha: string };
}

export interface Pull {
  number: number;
  state: "open" | "closed";
  merged_at: string | null;
  html_url: string;
  head: { ref: string; sha: string; repo: { full_name: string } | null };
}

export interface Workspace {
  branch: string;
  sha: string;
  batch: string;
  status: "editing" | "review" | "closed";
  pull: Pull | null;
}

export async function head(github: GitHub, branch: string): Promise<string> {
  const ref = await github.data<Ref>(github.path(`/git/ref/heads/${branch}`));
  return ref.object.sha;
}

export async function workspace(
  github: GitHub,
  user: Identity,
  create: boolean,
): Promise<Workspace | null> {
  const prefix = `content/${user.id}/`;
  const [refs, pulls, legacy] = await Promise.all([
    github.list<Ref>(`/git/matching-refs/heads/${prefix}`),
    github.list<Pull>("/pulls?state=all&base=main"),
    github.list<Ref>("/git/matching-refs/heads/cms/"),
  ]);
  if (
    legacy.length ||
    pulls.some(
      (pull) => pull.state === "open" && pull.head.ref.startsWith("cms/"),
    )
  ) {
    throw new WorkspaceError(
      409,
      "Cutover blocked: complete or explicitly migrate existing cms/ entry branches and pull requests before using batch workspaces. No legacy work was changed.",
    );
  }
  const ownPulls = pulls.filter(
    (pull) =>
      pull.head.repo?.full_name.toLowerCase() === github.repo.toLowerCase() &&
      pull.head.ref.startsWith(prefix),
  );
  if (
    ownPulls.some(
      (pull) =>
        !pull.merged_at &&
        !refs.some((ref) => ref.ref === `refs/heads/${pull.head.ref}`),
    )
  ) {
    throw new WorkspaceError(
      409,
      "An unmerged batch PR has a missing branch. Restore or explicitly migrate that work with a maintainer before starting another batch.",
    );
  }
  const active: Workspace[] = [];
  for (const ref of refs) {
    const branch = ref.ref.replace(/^refs\/heads\//, "");
    const related = ownPulls.filter((pull) => pull.head.ref === branch);
    const merged = related.find((pull) => pull.merged_at);
    if (merged) {
      if (merged.head.sha !== ref.object.sha) {
        throw new WorkspaceError(
          409,
          `Workspace ${branch} has commits after its PR was merged. A maintainer must recover those commits into a fresh batch; this branch will not be reset or deleted.`,
        );
      }
      continue;
    }
    const pull =
      related.find((pull) => pull.state === "open") ?? related[0] ?? null;
    if (!/^batch-\d+$/.test(branch.slice(prefix.length))) {
      throw new WorkspaceError(
        409,
        "An unrecognized personal workspace branch needs maintainer review. No branches were changed.",
      );
    }
    active.push({
      branch,
      sha: ref.object.sha,
      batch: branch.slice(prefix.length),
      status: pull ? (pull.state === "open" ? "review" : "closed") : "editing",
      pull,
    });
  }
  if (active.length > 1)
    throw new WorkspaceError(
      409,
      "Multiple unpublished workspaces exist. Ask a maintainer to reconcile them; none will be silently discarded.",
    );
  if (active[0]) return active[0];
  if (!create) return null;
  // GitHub's atomic ref creation elects one batch across simultaneous devices.
  // A merged PR number gives the next batch a stable, never-reused generation.
  const generation = Math.max(
    0,
    ...ownPulls.filter((pull) => pull.merged_at).map((pull) => pull.number),
  );
  const batch = `batch-${generation}`;
  const branch = `${prefix}${batch}`;
  const sha = await head(github, "main");
  try {
    await github.data(github.path("/git/refs"), "POST", {
      ref: `refs/heads/${branch}`,
      sha,
    });
  } catch (error) {
    if (!(error instanceof WorkspaceError) || error.status !== 422) throw error;
    const resumed = await workspace(github, user, false);
    if (!resumed) throw error;
    return resumed;
  }
  return { branch, sha, batch, status: "editing", pull: null };
}

export function requireCurrent(
  current: Workspace | null,
  expected: { branch?: unknown; sha?: unknown },
): Workspace {
  if (
    !current ||
    current.branch !== expected.branch ||
    current.sha !== expected.sha
  ) {
    throw new WorkspaceError(
      409,
      "The workspace changed in another tab or device. Refresh the workspace status and review all saved changes before trying again.",
    );
  }
  return current;
}

export async function submit(
  github: GitHub,
  user: Identity,
  current: Workspace,
): Promise<Pull> {
  if (current.status === "closed")
    throw new WorkspaceError(
      409,
      "This PR was closed without merging. Your work is preserved. Explicitly reopen it on GitHub, then refresh; it is not a new batch.",
    );
  const main = await head(github, "main");
  await github.request(github.path("/merges"), "POST", {
    base: current.branch,
    head: main,
    commit_message: "Merge main into editorial workspace",
  });
  const comparison = await github.data<{
    files?: unknown[];
    total_commits: number;
  }>(github.path(`/compare/${main}...${current.branch}`));
  if (!comparison.files?.length)
    throw new WorkspaceError(
      409,
      "This workspace has no file changes compared with main. Save some changes before submitting.",
    );
  if (current.pull?.state === "open") return current.pull;
  try {
    return await github.data<Pull>(github.path("/pulls"), "POST", {
      title: `Editorial batch by @${user.login}`,
      head: current.branch,
      base: "main",
      draft: false,
      body: "All saved entries and media in this user's workspace are included. Subsequent saves update this same PR. Frontmatter `draft: true` remains hidden in production-style previews.",
    });
  } catch (error) {
    if (!(error instanceof WorkspaceError) || error.status !== 422) throw error;
    const resumed = await workspace(github, user, false);
    if (resumed?.branch === current.branch && resumed.pull?.state === "open")
      return resumed.pull;
    throw error;
  }
}
