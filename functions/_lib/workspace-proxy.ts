import { Kind, parse, visit } from "graphql";
import type { GitHub } from "./workspace-github";
import type { Workspace } from "./workspaces";
import { WorkspaceError, privateHeaders } from "./workspace-session";

function reject(): never {
  throw new WorkspaceError(
    403,
    "The CMS may only read and save this active workspace. Reload /admin/ if this tab is stale.",
  );
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return reject();
  return value as Record<string, unknown>;
}

export async function proxy(
  request: Request,
  github: GitHub,
  current: Workspace,
  suffix: string,
): Promise<Response> {
  if (request.headers.get("Authorization") !== "token workspace-session")
    reject();
  let upstream: Response;
  if (suffix === "/api/graphql" && request.method === "POST") {
    const body = record(await request.json());
    if (typeof body.query !== "string" || body.query.length > 200_000) reject();
    const variables = record(body.variables);
    const document = parse(body.query);
    if (document.definitions.length !== 1) reject();
    const operation = document.definitions[0];
    if (
      operation.kind !== Kind.OPERATION_DEFINITION ||
      operation.directives?.length
    )
      reject();
    const selections = operation.selectionSet.selections;
    if (selections.length !== 1 || selections[0].kind !== Kind.FIELD) reject();
    const root = selections[0];
    if (operation.operation === "mutation") {
      if (
        root.name.value !== "createCommitOnBranch" ||
        root.alias ||
        root.arguments?.length !== 1 ||
        root.arguments[0].name.value !== "input" ||
        root.arguments[0].value.kind !== Kind.VARIABLE ||
        root.arguments[0].value.name.value !== "input"
      )
        reject();
      const input = record(variables.input);
      const branch = record(input.branch);
      if (
        branch.repositoryNameWithOwner !== github.repo ||
        branch.branchName !== current.branch ||
        Object.keys(branch).length !== 2
      )
        reject();
      if (input.expectedHeadOid !== current.sha) {
        throw new WorkspaceError(
          409,
          "Another tab saved newer changes. Reload this editor before saving; your older request was not applied.",
        );
      }
      const changes = record(input.fileChanges);
      for (const kind of ["additions", "deletions"]) {
        const files = changes[kind];
        if (files === undefined) continue;
        if (!Array.isArray(files)) reject();
        for (const value of files) {
          const file = record(value);
          if (
            typeof file.path !== "string" ||
            !/^(cms\/content\/|cms\/public\/media\/shared\/)/.test(file.path) ||
            file.path
              .split("/")
              .some((part) => part === ".." || part === "." || !part) ||
            file.path.includes("\\")
          )
            reject();
        }
      }
      // Reconstruct the mutation input; never forward alternate branch IDs.
      body.variables = {
        input: {
          branch,
          expectedHeadOid: current.sha,
          message: input.message,
          fileChanges: changes,
        },
      };
    } else if (operation.operation === "query") {
      if (
        root.name.value !== "repository" ||
        root.alias ||
        root.arguments?.length !== 2
      )
        reject();
      const [owner, repo] = github.repo.split("/");
      if (
        variables.owner !== owner ||
        variables.repo !== repo ||
        (variables.branch !== undefined && variables.branch !== current.branch)
      )
        reject();
      for (const argument of root.arguments) {
        if (
          argument.value.kind !== Kind.VARIABLE ||
          !(
            (argument.name.value === "owner" &&
              argument.value.name.value === "owner") ||
            (argument.name.value === "name" &&
              argument.value.name.value === "repo")
          )
        )
          reject();
      }
      visit(document, {
        FragmentSpread: reject,
        Directive: reject,
        Field(node) {
          // A configured branch must never fall back to the default branch.
          if (node.name.value === "defaultBranchRef") reject();
          if (node.name.value === "ref") {
            const argument = node.arguments?.find(
              (item) => item.name.value === "qualifiedName",
            );
            if (
              argument?.value.kind !== Kind.VARIABLE ||
              argument.value.name.value !== "branch" ||
              variables.branch !== current.branch
            )
              reject();
          }
        },
      });
    } else reject();
    upstream = await github.request("/graphql", "POST", body);
  } else {
    if (request.method !== "GET" || !suffix.startsWith("/api/v3/")) reject();
    const path = suffix.slice("/api/v3".length);
    const base = github.path("");
    const allowed =
      path === "/user" ||
      path.startsWith(`${base}/collaborators/`) ||
      path.startsWith(`${base}/git/trees/`) ||
      path.startsWith(`${base}/git/blobs/`);
    if (!allowed || path.includes("..") || path.includes("%")) reject();
    upstream = await github.request(
      path + new URL(request.url).search,
      "GET",
      undefined,
      request.headers.get("Accept") ?? undefined,
    );
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...privateHeaders,
      "Content-Type":
        upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}
