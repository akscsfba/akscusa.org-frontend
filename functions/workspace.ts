import { handleWorkspace } from "./_lib/workspace-handler";
import type { WorkspaceEnv } from "./_lib/workspace-session";

export const onRequest: PagesFunction<WorkspaceEnv> = ({ request, env }) =>
  handleWorkspace(request, env);
