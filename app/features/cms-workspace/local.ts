import { initializeEditor } from "./editor";

export function isLocalCheckoutHost(hostname: string): boolean {
  // Match the pinned CMS's supported local-host detection, not arbitrary LAN hosts.
  return hostname === "127.0.0.1" || /^(.+\.)?localhost$/.test(hostname);
}

export function localEditorConfig(origin: string): Record<string, unknown> {
  if (!isLocalCheckoutHost(new URL(origin).hostname)) {
    throw new Error(
      "Local checkout editing is available only on localhost. Run npm run dev in your checkout.",
    );
  }
  const disabled = `${origin}/admin/local/remote-disabled`;
  return {
    backend: {
      name: "github",
      repo: "OWNER/REPOSITORY",
      branch: "local-checkout-only",
      // The pinned local backend requires a Git backend and at least one auth
      // method. Its remaining OAuth button and cached tokens both lead only to
      // nonexistent local endpoints, never to the workspace gateway or GitHub.
      auth_methods: ["oauth"],
      base_url: disabled,
      auth_endpoint: "auth",
      api_root: `${disabled}/api/v3`,
      graphql_api_root: `${disabled}/api/graphql`,
      include_credentials: false,
    },
    app_title: "AKSC · local checkout only",
    publish_mode: "simple",
  };
}

export function startLocalEditor(): Promise<void> {
  return initializeEditor(async () => localEditorConfig(location.origin));
}
