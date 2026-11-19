import { GitHub, identity } from "./workspace-github";
import { proxy } from "./workspace-proxy";
import { workspace, requireCurrent, submit } from "./workspaces";
import {
  clearSessionCookie,
  guardOrigin,
  json,
  sessionToken,
  WorkspaceError,
  type WorkspaceEnv,
} from "./workspace-session";
import { workspaceAuthResponse } from "./github-oauth";
import { editorCookie, requireEditor } from "./workspace-lease";

export async function handleWorkspace(
  request: Request,
  env: WorkspaceEnv,
): Promise<Response> {
  try {
    guardOrigin(request, env);
    if (env.CMS_WORKSPACES_ENABLED !== "true")
      throw new WorkspaceError(
        503,
        "Batch publishing is not enabled. A maintainer must complete the legacy PR migration and workspace setup first.",
      );
    const path = new URL(request.url).pathname;
    if (path === "/workspace/logout" && request.method === "POST") {
      const response = json({ signedOut: true });
      response.headers.set("Set-Cookie", clearSessionCookie);
      return response;
    }
    const token = await sessionToken(request, env);
    const config = await env.ASSETS.fetch(
      new URL("/admin/workspace.json", request.url),
    );
    const { repo } = (await config.json()) as { repo?: string };
    if (
      !repo ||
      repo === "OWNER/REPOSITORY" ||
      !/^[\w.-]+\/[\w.-]+$/.test(repo)
    ) {
      throw new WorkspaceError(
        503,
        "CMS_REPO is unset or invalid in this build. Local development remains disconnected from GitHub.",
      );
    }
    const github = new GitHub(token, repo);
    const user = await identity(github);
    if (path === "/workspace/cms-auth" && request.method === "GET")
      return workspaceAuthResponse(request, env);
    if (path === "/workspace" && ["GET", "POST"].includes(request.method)) {
      const body =
        request.method === "POST"
          ? ((await request.json()) as {
              action?: string;
              branch?: unknown;
              sha?: unknown;
            })
          : {};
      if (
        request.method === "POST" &&
        !["resume", "submit", "editor"].includes(body.action ?? "")
      )
        throw new WorkspaceError(400, "Unknown workspace action.");
      const current = await workspace(github, user, body.action === "resume");
      if (body.action === "editor") {
        if (!current)
          throw new WorkspaceError(
            409,
            "The batch changed. Refresh /admin/ before opening the editor.",
          );
        const editorId = crypto.randomUUID().replaceAll("-", "");
        const response = json({ repo, user, workspace: current, editorId });
        response.headers.set(
          "Set-Cookie",
          await editorCookie(editorId, user.id, repo, current, env),
        );
        return response;
      }
      if (body.action === "submit") {
        if (
          current &&
          current.branch === body.branch &&
          current.sha !== body.sha &&
          current.pull?.state === "open"
        ) {
          return json({ pull: current.pull });
        }
        const pull = await submit(github, user, requireCurrent(current, body));
        return json({ pull });
      }
      return json({
        repo,
        user: { id: user.id, login: user.login },
        workspace: current,
      });
    }
    const match = path.match(
      /^\/workspace\/git\/(batch-\d+)\/([a-f0-9]{32})(\/api\/.*)$/,
    );
    if (match) {
      const current = await workspace(github, user, false);
      if (!current || current.batch !== match[1])
        throw new WorkspaceError(
          409,
          "This editor belongs to an old batch. Saved work is safe; reopen /admin/ before editing.",
        );
      await requireEditor(request, match[2], user.id, repo, current, env);
      const response = await proxy(request, github, current, match[3]);
      if (request.method === "POST") {
        const result = (await response.clone().json()) as {
          data?: { createCommitOnBranch?: { commit?: { oid?: string } } };
        };
        const sha = result.data?.createCommitOnBranch?.commit?.oid;
        if (typeof sha === "string") {
          response.headers.set(
            "Set-Cookie",
            await editorCookie(
              match[2],
              user.id,
              repo,
              { ...current, sha },
              env,
            ),
          );
        }
      }
      return response;
    }
    return json({ message: "Workspace route not found." }, 404);
  } catch (error) {
    if (error instanceof WorkspaceError)
      return json({ message: error.message }, error.status);
    return json(
      {
        message:
          "The workspace service could not complete this request. Retry after refreshing; no work has been discarded.",
      },
      502,
    );
  }
}
