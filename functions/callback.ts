import { handleGitHubCallback, type GitHubOAuthEnv } from "./_lib/github-oauth";

export const onRequestGet: PagesFunction<GitHubOAuthEnv> = ({ request, env }) =>
  handleGitHubCallback(request, env);
