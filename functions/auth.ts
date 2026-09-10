import { handleGitHubAuth, type GitHubOAuthEnv } from "./_lib/github-oauth";

export const onRequestGet: PagesFunction<GitHubOAuthEnv> = ({ request, env }) =>
  handleGitHubAuth(request, env);
