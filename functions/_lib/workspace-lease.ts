import {
  cookieValue,
  seal,
  unseal,
  WorkspaceError,
  type WorkspaceEnv,
} from "./workspace-session";
import type { Workspace } from "./workspaces";

const name = "__Secure-cms-editor";

// Sveltia refetches the head before a save, so expectedHeadOid alone cannot
// detect a stale form. Each editor gets its own cookie path and snapshot;
// only that editor's successful writes advance it, never another tab's writes.
export async function editorCookie(
  editorId: string,
  userId: number,
  repo: string,
  current: Workspace,
  env: WorkspaceEnv,
): Promise<string> {
  const value = await seal(
    {
      kind: "editor",
      editorId,
      userId,
      repo,
      branch: current.branch,
      sha: current.sha,
    },
    env,
  );
  return `${name}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/workspace/git/${current.batch}/${editorId}/; Max-Age=28800`;
}

export async function requireEditor(
  request: Request,
  editorId: string,
  userId: number,
  repo: string,
  current: Workspace,
  env: WorkspaceEnv,
): Promise<void> {
  try {
    const value = cookieValue(request, name);
    if (!value) throw new Error();
    const lease = await unseal(value, env);
    if (
      lease.kind !== "editor" ||
      lease.editorId !== editorId ||
      lease.userId !== userId ||
      lease.repo !== repo ||
      lease.branch !== current.branch ||
      lease.sha !== current.sha
    )
      throw new Error();
  } catch {
    throw new WorkspaceError(
      409,
      "This editor snapshot is stale or expired. Copy unsaved edits, then use Reload editor. Another tab or a main sync may have changed the workspace; nothing was overwritten.",
    );
  }
}
