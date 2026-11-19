import { WorkspaceError } from "./workspace-session";

export class GitHub {
  constructor(
    private token: string,
    public repo: string,
  ) {}

  async request(
    path: string,
    method = "GET",
    body?: unknown,
    accept = "application/vnd.github+json",
  ): Promise<Response> {
    const response = await fetch(`https://api.github.com${path}`, {
      method,
      redirect: "error",
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: accept,
        "Content-Type": "application/json",
        "User-Agent": "AKSC-editorial-workspaces",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const message =
        response.status === 401
          ? "GitHub authorization expired. Sign in again."
          : response.status === 409
            ? "Main conflicts with this workspace. Resolve the conflicts on GitHub without resetting the branch, then refresh."
            : `GitHub rejected the workspace operation (${response.status}). Check repository access and branch rules; saved work has not been discarded.`;
      throw new WorkspaceError(response.status, message);
    }
    return response;
  }

  async data<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    return (await this.request(path, method, body)).json() as Promise<T>;
  }

  path(suffix: string): string {
    return `/repos/${this.repo}${suffix}`;
  }

  async list<T>(suffix: string): Promise<T[]> {
    const result: T[] = [];
    for (let page = 1; page <= 100; page++) {
      const items = await this.data<T[]>(
        this.path(
          `${suffix}${suffix.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
        ),
      );
      result.push(...items);
      if (items.length < 100) return result;
    }
    throw new WorkspaceError(
      503,
      "Repository history is too large to inspect safely. Contact a maintainer.",
    );
  }
}

export interface Identity {
  id: number;
  login: string;
}

export async function identity(github: GitHub): Promise<Identity> {
  const user = await github.data<Identity>("/user");
  const repo = await github.data<{
    permissions?: { push?: boolean };
    full_name: string;
  }>(github.path(""));
  if (
    !Number.isSafeInteger(user.id) ||
    !repo.permissions?.push ||
    repo.full_name.toLowerCase() !== github.repo.toLowerCase()
  ) {
    throw new WorkspaceError(
      403,
      "This GitHub account needs write access to the configured repository.",
    );
  }
  return user;
}
