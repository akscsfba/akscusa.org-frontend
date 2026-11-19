import { workspaceRequest, type EditorState } from "./client";

interface CmsWindow extends Window {
  CMS_MANUAL_INIT?: boolean;
  CMS?: { init(options: { config: Record<string, unknown> }): Promise<void> };
}

export const cmsBundle =
  "https://unpkg.com/@sveltia/cms@0.201.1/dist/sveltia-cms.js";

export function editorConfig(
  state: EditorState,
  origin: string,
): Record<string, unknown> {
  const current = state.workspace;
  if (
    !current ||
    !/^content\/\d+\/batch-\d+$/.test(current.branch) ||
    current.branch !== `content/${state.user.id}/${current.batch}` ||
    state.repo === "OWNER/REPOSITORY" ||
    !/^[\w.-]+\/[\w.-]+$/.test(state.repo) ||
    !/^[a-f0-9]{32}$/.test(state.editorId)
  ) {
    throw new Error("No verified workspace is available. Return to /admin/.");
  }
  return {
    backend: {
      name: "github",
      repo: state.repo,
      branch: current.branch,
      base_url: origin,
      auth_endpoint: "workspace/cms-auth",
      api_root: `${origin}/workspace/git/${current.batch}/${state.editorId}/api/v3`,
      graphql_api_root: `${origin}/workspace/git/${current.batch}/${state.editorId}/api/graphql`,
      include_credentials: true,
    },
    publish_mode: "simple",
  };
}

export async function startEditor(): Promise<void> {
  return initializeEditor(async () => {
    const state = await workspaceRequest<EditorState>("editor");
    return editorConfig(state, location.origin);
  });
}

export async function initializeEditor(
  loadConfig: () => Promise<Record<string, unknown>>,
): Promise<void> {
  const target: CmsWindow = window;
  target.CMS_MANUAL_INIT = true;
  const status = document.getElementById("startup");
  try {
    const config = await loadConfig();
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = cmsBundle;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(
          new Error(
            "The pinned CMS could not load. Check your connection and reload.",
          ),
        );
      document.body.appendChild(script);
    });
    if (!target.CMS)
      throw new Error("The CMS did not initialize. Reload this editor.");
    document.getElementById("nc-root")?.removeAttribute("hidden");
    await target.CMS.init({ config });
    status?.remove();
  } catch (error) {
    document.getElementById("nc-root")?.setAttribute("hidden", "");
    if (status) {
      status.setAttribute("role", "alert");
      status.textContent =
        error instanceof Error ? error.message : "The editor could not start.";
    }
  }
}
