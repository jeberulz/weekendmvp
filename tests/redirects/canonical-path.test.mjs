import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanPath,
  isProdApexHost,
  isProdWwwHost,
  pathNeedsCleaning,
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

describe("host helpers", () => {
  it("recognizes production hosts case-insensitively", () => {
    assert.equal(isProdApexHost("weekendmvp.app"), true);
    assert.equal(isProdApexHost("WeekendMVP.app"), true);
    assert.equal(isProdApexHost("www.weekendmvp.app"), false);
    assert.equal(isProdWwwHost("www.weekendmvp.app"), true);
    assert.equal(isProdWwwHost("weekendmvp.app"), false);
  });
});
