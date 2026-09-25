import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aliasPath,
  canonicalPath,
  cleanPath,
  isProdApexHost,
  isProdWwwHost,
  pathNeedsCleaning,
  pathNeedsRedirect,
} from "../../lib/canonical-path.ts";

describe("cleanPath", () => {
  it("leaves clean paths alone", () => {
    assert.equal(cleanPath("/"), "/");
    assert.equal(cleanPath("/build-with/claude"), "/build-with/claude");
    assert.equal(
      cleanPath("/articles/7-micro-saas-ideas-solo-2026"),
      "/articles/7-micro-saas-ideas-solo-2026",
    );
  });

  it("strips .html and .htm", () => {
    assert.equal(
      cleanPath("/articles/7-micro-saas-ideas-solo-2026.html"),
      "/articles/7-micro-saas-ideas-solo-2026",
    );
    assert.equal(cleanPath("/ideas/foo.HTML"), "/ideas/foo");
    assert.equal(cleanPath("/legacy.htm"), "/legacy");
  });

  it("strips trailing slash except root", () => {
    assert.equal(cleanPath("/build-with/claude/"), "/build-with/claude");
    assert.equal(cleanPath("/"), "/");
  });

  it("collapses .html + trailing slash in one pass", () => {
    assert.equal(
      cleanPath("/articles/7-micro-saas-ideas-solo-2026.html/"),
      "/articles/7-micro-saas-ideas-solo-2026",
    );
  });

  it("maps /index.html to /", () => {
    assert.equal(cleanPath("/index.html"), "/");
    assert.equal(cleanPath("/index"), "/");
  });
});

describe("pathNeedsCleaning", () => {
  it("detects dirty paths", () => {
    assert.equal(pathNeedsCleaning("/a.html"), true);
    assert.equal(pathNeedsCleaning("/a/"), true);
    assert.equal(pathNeedsCleaning("/a"), false);
    assert.equal(pathNeedsCleaning("/"), false);
  });
});

describe("aliasPath + canonicalPath", () => {
  it("aliases the bare ideas index to the live archive", () => {
    assert.equal(aliasPath("/ideas"), "/startup-ideas");
    assert.equal(aliasPath("/ideas/foo"), "/ideas/foo");
    assert.equal(aliasPath("/startup-ideas"), "/startup-ideas");
  });

  it("folds slash/.html cleaning into the ideas alias in one hop", () => {
    assert.equal(canonicalPath("/ideas"), "/startup-ideas");
    assert.equal(canonicalPath("/ideas/"), "/startup-ideas");
    assert.equal(canonicalPath("/ideas.html"), "/startup-ideas");
    assert.equal(canonicalPath("/ideas.html/"), "/startup-ideas");
    assert.equal(canonicalPath("/ideas/foo/"), "/ideas/foo");
  });

  it("flags alias-only paths as needing a redirect", () => {
    assert.equal(pathNeedsRedirect("/ideas"), true);
    assert.equal(pathNeedsRedirect("/startup-ideas"), false);
    assert.equal(pathNeedsRedirect("/ideas/foo"), false);
  });
});

describe("host helpers", () => {
  it("recognizes production hosts case-insensitively", () => {
    assert.equal(isProdApexHost("weekendmvp.app"), true);
    assert.equal(isProdApexHost("WeekendMVP.app"), true);
    assert.equal(isProdApexHost("www.weekendmvp.app"), false);
    assert.equal(isProdWwwHost("www.weekendmvp.app"), true);
    assert.equal(isProdWwwHost("weekendmvp.app"), false);
  });
});
