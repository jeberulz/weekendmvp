import { createHash } from "node:crypto";

// Serve a read-only GitHub repository at the browser boundary. Real OAuth and
// GitHub App permissions must be verified separately by the app owner.
export function readOnlyGitHubFixture(path, contents) {
  const parts = path.split("/");
  const gitHash = (type, bytes) => createHash("sha1")
    .update(type + " " + bytes.length + "\0").update(bytes).digest("hex");
  let sha = gitHash("blob", contents);
  const tree = [{ path, mode: "100644", type: "blob", sha }];
  for (let index = parts.length - 1; index >= 0; index--) {
    const mode = index === parts.length - 1 ? "100644" : "40000";
    const entry = Buffer.concat([Buffer.from(mode + " " + parts[index] + "\0"), Buffer.from(sha, "hex")]);
    sha = gitHash("tree", entry);
    if (index > 0) tree.unshift({ path: parts.slice(0, index).join("/"), mode: "040000", type: "tree", sha });
  }
  const commit = { __typename: "Commit", id: "commit", oid: "a".repeat(40), tree: { __typename: "Tree", id: "tree", oid: sha } };
  const refs = ["main", "content/smoke"].map((name) => ({ __typename: "Ref", id: name, name, target: commit }));
  const repo = {
    __typename: "Repository", id: "repo", name: "weekendmvp", isPrivate: false,
    owner: { __typename: "User", id: "owner", login: "jeberulz" },
    viewerPermission: "ADMIN", defaultBranchRef: refs[0], forks: { __typename: "RepositoryConnection", nodes: [] },
    refs: { __typename: "RefConnection", nodes: refs, pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null } },
  };
  const headers = {
    "access-control-allow-origin": "http://127.0.0.1:44074",
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "authorization,content-type,accept",
  };
  return async function respond(request) {
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return request.respond({ status: 204, headers });
    let data;
    if (url.origin === "https://api.github.com" && url.pathname === "/graphql") {
      const query = url.searchParams.get("query") || JSON.parse(request.postData() || "{}").query || "";
      if (/\bquery GitHubAppShell\b/.test(query)) {
        data = { data: { repository: repo, viewer: { ...repo.owner, name: "Test operator", avatarUrl: "", databaseId: 1 } } };
      } else if (/\bquery PullRequestForBranch\b/.test(query)) {
        data = { data: { node: { __typename: "Ref", id: refs[1].id, associatedPullRequests: { __typename: "PullRequestConnection", nodes: [] } } } };
      }
    } else if (request.method() === "GET" && url.origin === "https://api.github.com" &&
        url.pathname === "/repos/jeberulz/weekendmvp/git/trees/" + sha) {
      data = { tree, truncated: false };
    } else if (request.method() === "GET" && url.origin === "https://raw.githubusercontent.com" &&
        url.pathname === "/jeberulz/weekendmvp/" + commit.oid + "/" + path) {
      return request.respond({ status: 200, headers, contentType: "application/json", body: contents });
    }
    return data ? request.respond({ status: 200, headers, contentType: "application/json", body: JSON.stringify(data) }) : request.abort();
  };
}
