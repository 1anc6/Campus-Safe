import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessPath, homeForRole, postLoginDestination, sanitizeRedirect } from "./roles.ts";

describe("homeForRole", () => {
  it("sends each role to its own experience", () => {
    assert.equal(homeForRole("admin"), "/admin");
    assert.equal(homeForRole("student"), "/");
    assert.equal(homeForRole("responder"), "/staff");
  });
});

describe("canAccessPath", () => {
  it("keeps students out of every admin URL", () => {
    for (const path of ["/admin", "/admin/", "/admin/users", "/admin/incidents/abc"]) {
      assert.equal(canAccessPath("student", path), false, path);
    }
  });
  it("does not treat look-alike prefixes as the admin area", () => {
    assert.equal(canAccessPath("student", "/administrator-guide"), true);
  });
  it("lets admins into the console but routes them away from the student home", () => {
    assert.equal(canAccessPath("admin", "/admin/analytics"), true);
    assert.equal(canAccessPath("admin", "/"), false);
    assert.equal(canAccessPath("admin", "/report"), false);
  });
  it("allows public pages for every role", () => {
    for (const role of ["student", "responder", "admin"] as const) {
      assert.equal(canAccessPath(role, "/anonymous"), true);
      assert.equal(canAccessPath(role, "/track/CS-AAAA-BBBB"), true);
    }
  });
  it("limits the field app to responders and admins", () => {
    assert.equal(canAccessPath("responder", "/staff/1"), true);
    assert.equal(canAccessPath("student", "/staff"), false);
  });
});

describe("sanitizeRedirect", () => {
  it("accepts same-origin relative paths", () => {
    assert.equal(sanitizeRedirect("/reports?tab=sos"), "/reports?tab=sos");
  });
  it("rejects open redirects and junk", () => {
    for (const bad of ["//evil.com", "https://evil.com", "evil.com", "/\\evil.com", "", null, 42]) {
      assert.equal(sanitizeRedirect(bad), null, String(bad));
    }
  });
  it("never redirects back to the login page", () => {
    assert.equal(sanitizeRedirect("/login?redirect=/admin"), null);
  });
});

describe("postLoginDestination", () => {
  it("honours a permitted redirect", () => {
    assert.equal(postLoginDestination("admin", "/admin/users"), "/admin/users");
    assert.equal(postLoginDestination("student", "/reports"), "/reports");
  });
  it("falls back to the role home when the redirect is not allowed for the role", () => {
    assert.equal(postLoginDestination("student", "/admin/users"), "/");
    assert.equal(postLoginDestination("admin", "/report"), "/admin");
  });
  it("falls back to the role home without a redirect", () => {
    assert.equal(postLoginDestination("responder", undefined), "/staff");
  });
});
