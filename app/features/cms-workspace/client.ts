export interface WorkspaceState {
  repo: string;
  user: { id: number; login: string };
  workspace: {
    branch: string;
    sha: string;
    batch: string;
    status: "editing" | "review" | "closed";
    pull: { html_url: string; number: number } | null;
  } | null;
}

export interface EditorState extends WorkspaceState {
  editorId: string;
}

export class SessionError extends Error {}

export async function workspaceRequest<T>(
  action?: string,
  expected?: { branch: string; sha: string },
): Promise<T> {
  const response = await fetch("/workspace", {
    method: action ? "POST" : "GET",
    cache: "no-store",
    ...(action
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...expected }),
        }
      : {}),
  });
  const invalidResponse = () =>
    new Error(
      `The CMS workspace server returned an invalid response (HTTP ${response.status}). Please try again; saved work is safe.`,
    );
  if (
    response.headers.get("Content-Type")?.split(";")[0].trim() !==
    "application/json"
  ) {
    throw invalidResponse();
  }
  let result: unknown;
  try {
    result = await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) throw invalidResponse();
    throw error;
  }
  if (!response.ok) {
    const message =
      typeof result === "object" &&
      result !== null &&
      "message" in result &&
      typeof result.message === "string"
        ? result.message
        : "The workspace is unavailable.";
    if (response.status === 401) throw new SessionError(message);
    throw new Error(message);
  }
  return result as T;
}
