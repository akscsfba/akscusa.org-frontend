import { createHash } from "node:crypto";
import { Kind, parse } from "graphql";

interface CommitInput {
  branch: { repositoryNameWithOwner: string; branchName: string };
  expectedHeadOid: string;
  fileChanges: {
    additions: Array<{ path: string; contents: string }>;
    deletions: Array<{ path: string }>;
  };
}

interface File {
  data: Buffer;
  sha: string;
}

/** Stateful GitHub infrastructure double; never substitutes for our gateway. */
export class WorkspaceGitHub {
  readonly repo = "example/editorial";
  readonly token = "upstream-oauth-test-token";
  readonly branch = "content/42/batch-0";
  readonly refs = new Map([["main", "1".padStart(40, "0")]]);
  readonly files = new Map<string, File>();
  readonly writes: Array<CommitInput & { sha: string }> = [];
  readonly unexpected: string[] = [];
  readonly pulls: Array<{
    number: number;
    state: string;
    merged_at: null;
    html_url: string;
    head: { ref: string; sha: string; repo: { full_name: string } };
  }> = [];
  pullCreates = 0;
  mainSyncs = 0;
  private sequence = 1;

  constructor(private origin: string) {}

  get head(): string {
    return this.refs.get(this.branch) ?? this.refs.get("main")!;
  }

  readonly fetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (
      url.origin === "https://github.com" &&
      url.pathname === "/login/oauth/access_token"
    ) {
      return Response.json({ access_token: this.token });
    }
    if (
      url.origin !== "https://api.github.com" ||
      request.headers.get("Authorization") !== `Bearer ${this.token}`
    ) {
      return this.fail(
        `Unexpected upstream origin/authorization: ${url.origin}${url.pathname}`,
      );
    }
    const body =
      request.method === "POST"
        ? ((await request.json()) as Record<string, unknown>)
        : {};
    const base = `/repos/${this.repo}`;
    if (url.pathname === "/user")
      return Response.json({
        id: 42,
        login: "editor",
        name: "Editor",
        email: "editor@example.test",
        html_url: "https://github.com/editor",
        avatar_url: `${this.origin}/favicon.ico`,
      });
    if (url.pathname === base)
      return Response.json({
        full_name: this.repo,
        permissions: { push: true },
      });
    if (url.pathname === `${base}/collaborators/editor`)
      return new Response(null, { status: 204 });
    if (url.pathname.startsWith(`${base}/git/matching-refs/heads/`)) {
      const prefix = url.pathname.slice(
        `${base}/git/matching-refs/heads/`.length,
      );
      return Response.json(
        [...this.refs]
          .filter(([name]) => name.startsWith(prefix))
          .map(([name, sha]) => ({
            ref: `refs/heads/${name}`,
            object: { sha },
          })),
      );
    }
    if (url.pathname.startsWith(`${base}/git/ref/heads/`)) {
      const sha = this.refs.get(
        url.pathname.slice(`${base}/git/ref/heads/`.length),
      );
      return sha
        ? Response.json({ object: { sha } })
        : new Response(null, { status: 404 });
    }
    if (url.pathname === `${base}/git/refs` && request.method === "POST") {
      if (
        body.ref !== `refs/heads/${this.branch}` ||
        body.sha !== this.refs.get("main")
      )
        return this.fail("Invalid workspace creation");
      if (this.refs.has(this.branch))
        return new Response(null, { status: 422 });
      this.refs.set(this.branch, String(body.sha));
      return Response.json(
        { ref: body.ref, object: { sha: body.sha } },
        { status: 201 },
      );
    }
    if (url.pathname.startsWith(`${base}/git/trees/`)) {
      if (!url.pathname.endsWith(`/${this.head}`))
        return this.fail("CMS read an unexpected tree");
      return Response.json({
        tree: [...this.files].map(([path, file]) => ({
          type: "blob",
          path,
          sha: file.sha,
          size: file.data.length,
        })),
      });
    }
    if (url.pathname.startsWith(`${base}/git/blobs/`)) {
      const sha = url.pathname.split("/").pop();
      const file = [...this.files.values()].find((value) => value.sha === sha);
      return file
        ? new Response(new Uint8Array(file.data), {
            headers: { "Content-Type": "application/octet-stream" },
          })
        : new Response(null, { status: 404 });
    }
    if (url.pathname === `${base}/merges` && request.method === "POST") {
      if (body.base !== this.branch || body.head !== this.refs.get("main"))
        return this.fail("Invalid main synchronization");
      this.mainSyncs++;
      return new Response(null, { status: 204 });
    }
    if (
      url.pathname ===
      `${base}/compare/${this.refs.get("main")}...${this.branch}`
    ) {
      return Response.json({
        total_commits: this.writes.length,
        files: [...this.files.keys()].map((filename) => ({ filename })),
      });
    }
    if (url.pathname === `${base}/pulls`) {
      if (request.method === "GET") return Response.json(this.pulls);
      if (
        body.head !== this.branch ||
        body.base !== "main" ||
        body.draft !== false
      )
        return this.fail("Invalid review PR");
      if (this.pulls.length) return new Response(null, { status: 422 });
      this.pullCreates++;
      const pull = {
        number: 7,
        state: "open",
        merged_at: null,
        html_url: `https://github.com/${this.repo}/pull/7`,
        head: {
          ref: this.branch,
          sha: this.head,
          repo: { full_name: this.repo },
        },
      };
      this.pulls.push(pull);
      return Response.json(pull, { status: 201 });
    }
    if (url.pathname === "/graphql" && typeof body.query === "string") {
      const variables = body.variables as {
        input?: CommitInput;
        branch?: string;
      };
      if (body.query.includes("createCommitOnBranch")) {
        const value = variables.input;
        if (
          !value ||
          value.branch.repositoryNameWithOwner !== this.repo ||
          value.branch.branchName !== this.branch ||
          value.expectedHeadOid !== this.head
        ) {
          return this.fail("Commit did not use the current workspace head");
        }
        for (const { path, contents } of value.fileChanges.additions) {
          const data = Buffer.from(contents, "base64");
          const sha = createHash("sha1")
            .update(`blob ${data.length}\0`)
            .update(data)
            .digest("hex");
          this.files.set(path, { data, sha });
        }
        for (const { path } of value.fileChanges.deletions)
          this.files.delete(path);
        const sha = (++this.sequence).toString(16).padStart(40, "0");
        this.refs.set(this.branch, sha);
        for (const pull of this.pulls) pull.head.sha = sha;
        this.writes.push({ ...value, sha });
        return Response.json({
          data: {
            createCommitOnBranch: {
              commit: {
                oid: sha,
                committedDate: new Date().toISOString(),
                ...Object.fromEntries(
                  value.fileChanges.additions.map(({ path }, index) => [
                    `file_${index}`,
                    { oid: this.files.get(path)!.sha },
                  ]),
                ),
              },
            },
          },
        });
      }
      if (variables.branch !== undefined && variables.branch !== this.branch)
        return this.fail("Read escaped workspace branch");
      const operation = parse(body.query).definitions[0];
      if (operation.kind !== Kind.OPERATION_DEFINITION)
        return this.fail("Unknown GraphQL operation");
      const root = operation.selectionSet.selections[0];
      if (root.kind !== Kind.FIELD || root.name.value !== "repository")
        return this.fail("Unknown GraphQL query root");
      const repository: Record<string, unknown> = {};
      for (const field of root.selectionSet?.selections ?? []) {
        if (field.kind !== Kind.FIELD)
          return this.fail("Unknown repository selection");
        const name = field.alias?.value ?? field.name.value;
        if (field.name.value === "ref") {
          repository[name] = {
            target: {
              history: {
                nodes: [
                  {
                    oid: this.head,
                    message: "Workspace save",
                    committedDate: new Date().toISOString(),
                    author: {
                      name: "Editor",
                      email: "editor@example.test",
                      user: { id: 42, login: "editor" },
                    },
                  },
                ],
              },
            },
          };
        } else if (field.name.value === "object") {
          const oid = field.arguments?.find(
            (argument) => argument.name.value === "oid",
          )?.value;
          if (oid?.kind !== Kind.STRING)
            return this.fail("Unexpected object query");
          const file = [...this.files.values()].find(
            (value) => value.sha === oid.value,
          );
          repository[name] = file
            ? { text: file.data.toString() }
            : {
                statusCheckRollup: { contexts: { nodes: [] } },
                deployments: { nodes: [] },
              };
        } else
          return this.fail(`Unknown repository field: ${field.name.value}`);
      }
      return Response.json({ data: { repository } });
    }
    return this.fail(
      `Unexpected upstream operation: ${request.method} ${url.pathname}`,
    );
  };

  private fail(message: string): Response {
    this.unexpected.push(message);
    return Response.json({ message }, { status: 500 });
  }
}
