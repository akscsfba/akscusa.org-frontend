import { SessionError, workspaceRequest, type WorkspaceState } from "./client";
import { mountEditorDisplay } from "./editor-display";
import { isLocalCheckoutHost } from "./local";

export function startWorkspace(): void {
  const root = document.querySelector<HTMLElement>("[data-workspace]");
  if (!root) return;
  const status = root.querySelector<HTMLElement>("[data-status]")!;
  const error = root.querySelector<HTMLElement>("[data-error]")!;
  const login = root.querySelector<HTMLButtonElement>("[data-login]")!;
  const open = root.querySelector<HTMLButtonElement>("[data-open]")!;
  const submit = root.querySelector<HTMLButtonElement>("[data-submit]")!;
  const submitLabel = submit.querySelector<HTMLElement>("[data-submit-label]")!;
  const progress = root.querySelector<HTMLElement>("[data-progress]")!;
  const controls = root.querySelector<HTMLElement>("[data-controls]")!;
  const refresh = root.querySelector<HTMLButtonElement>("[data-refresh]")!;
  const logout = root.querySelector<HTMLButtonElement>("[data-logout]")!;
  const review = root.querySelector<HTMLAnchorElement>("[data-review]")!;
  const editor = root.querySelector<HTMLIFrameElement>("[data-editor]")!;
  const help = root.querySelector<HTMLElement>("[data-editor-help]")!;
  const panel = root.querySelector<HTMLDialogElement>("[data-editor-panel]")!;
  const expand = root.querySelector<HTMLButtonElement>("[data-expand]")!;
  if (isLocalCheckoutHost(location.hostname)) {
    root.querySelector<HTMLElement>("[data-local]")!.hidden = false;
    return;
  }
  panel.show();
  const collapseEditor = mountEditorDisplay(panel, expand, editor);
  let state: WorkspaceState | undefined;
  let busy = false;

  function showError(reason: unknown) {
    error.textContent =
      reason instanceof Error
        ? reason.message
        : "The request failed. Your saved work is safe.";
    error.hidden = false;
    error.focus();
    if (reason instanceof SessionError) {
      login.hidden = false;
      open.hidden = submit.hidden = true;
    }
  }

  function render(next: WorkspaceState) {
    if (state?.workspace?.branch !== next.workspace?.branch) {
      if (
        editor.hasAttribute("src") &&
        !window.confirm(
          "The active batch changed. Copy any unsaved editor text before continuing. Close this editor and switch batches?",
        )
      ) {
        status.textContent =
          "The active batch changed. Copy unsaved edits from this old editor, then refresh status to switch. Old-batch saves are blocked.";
        submit.disabled = true;
        return;
      }
      collapseEditor();
      editor.removeAttribute("src");
      editor.hidden = help.hidden = expand.hidden = true;
      open.textContent = "Open editor";
    }
    state = next;
    const current = next.workspace;
    login.hidden = true;
    refresh.hidden = logout.hidden = false;
    open.hidden = submit.hidden = !current;
    submit.disabled = current?.status === "closed";
    status.textContent = current
      ? `@${next.user.login} · ${current.branch} · ${current.status === "closed" ? "PR closed without merging. Work is preserved; reopen the PR on GitHub, then refresh." : current.status === "review" ? "In review. Further saves update this same PR." : "Ready for saved changes."}`
      : "This batch has been merged. Close any old editor tabs, then refresh status to begin a fresh batch from main.";
    status.style.overflowWrap = "anywhere";
    review.hidden = !current?.pull;
    if (current?.pull) review.href = current.pull.html_url;
  }

  async function run(action: () => Promise<void>, submitting = false) {
    if (busy) return;
    busy = true;
    error.hidden = true;
    // Keep live feedback outside the busy scope; aria-disabled retains keyboard focus.
    controls.setAttribute("aria-busy", "true");
    for (const button of [login, open, submit, refresh, logout])
      button.setAttribute("aria-disabled", "true");
    if (submitting) {
      submitLabel.textContent = "Submitting…";
      progress.textContent = "Submitting saved changes…";
    }
    try {
      await action();
    } catch (reason) {
      showError(reason);
    } finally {
      busy = false;
      controls.removeAttribute("aria-busy");
      for (const button of [login, open, submit, refresh, logout])
        button.removeAttribute("aria-disabled");
      submitLabel.textContent = "Submit for review";
      progress.textContent = "";
    }
  }

  refresh.onclick = () =>
    void run(async () =>
      render(await workspaceRequest<WorkspaceState>("resume")),
    );
  open.onclick = () => {
    if (busy || !state?.workspace) return;
    if (
      editor.hasAttribute("src") &&
      !window.confirm(
        "Reload the editor from the latest saved workspace? Copy any unsaved edits first.",
      )
    )
      return;
    editor.src = "/admin/editor/";
    open.textContent = "Reload editor";
    editor.hidden = help.hidden = expand.hidden = false;
    editor.scrollIntoView({ block: "start" });
    editor.focus();
  };
  submit.onclick = () => {
    if (submit.disabled || submit.hidden) return;
    void run(async () => {
      if (!state?.workspace) return;
      const latest = await workspaceRequest<WorkspaceState>();
      if (
        !latest.workspace ||
        latest.workspace.branch !== state.workspace.branch
      ) {
        render(latest);
        throw new Error(
          "This batch has changed or merged. Close old editor tabs and refresh before submitting.",
        );
      }
      if (latest.workspace.status === "closed") {
        render(latest);
        throw new Error(
          "This pull request is closed. Reopen it on GitHub, then refresh before submitting.",
        );
      }
      await workspaceRequest("submit", latest.workspace);
      render(await workspaceRequest<WorkspaceState>());
    }, true);
  };
  logout.onclick = () =>
    void run(async () => {
      if (
        editor.hasAttribute("src") &&
        !window.confirm(
          "Sign out and close the editor? Save or copy any unsaved changes first.",
        )
      )
        return;
      const response = await fetch("/workspace/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign-out failed. Try again.");
      location.reload();
    });
  login.onclick = () => {
    if (busy) return;
    const popup = window.open(
      `/auth?provider=github&site_id=${encodeURIComponent(location.hostname)}&workspace=1`,
      "workspace-auth",
      "popup,width=700,height=750",
    );
    if (!popup)
      return showError(new Error("Allow the sign-in popup, then try again."));
    const timer = window.setTimeout(
      () =>
        finish(new Error("Sign-in timed out. Try again; saved work is safe.")),
      120_000,
    );
    function finish(reason?: Error) {
      clearTimeout(timer);
      window.removeEventListener("message", receive);
      popup?.close();
      if (reason) showError(reason);
      else
        void run(async () =>
          render(await workspaceRequest<WorkspaceState>("resume")),
        );
    }
    function receive(event: MessageEvent) {
      if (
        event.origin !== location.origin ||
        event.source !== popup ||
        typeof event.data !== "string"
      )
        return;
      if (event.data === "authorizing:github")
        popup?.postMessage("authorizing:github", location.origin);
      else if (event.data.startsWith("authorization:github:success:")) finish();
      else if (event.data.startsWith("authorization:github:error:"))
        finish(
          new Error(
            "GitHub sign-in failed. Check access and workspace setup, then try again.",
          ),
        );
    }
    window.addEventListener("message", receive);
  };
  void run(async () =>
    render(await workspaceRequest<WorkspaceState>("resume")),
  );
}
