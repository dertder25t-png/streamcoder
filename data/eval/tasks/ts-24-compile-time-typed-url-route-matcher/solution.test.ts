import { expect, it } from "vitest";
import { createRouteMatcher } from "./solution";

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const repoMatch = createRouteMatcher("/orgs/:orgId/repos/:repoId");
const staticMatch = createRouteMatcher("/health/check");
const oneMatch = createRouteMatcher("/users/:id");

type RepoParams = NonNullable<ReturnType<typeof repoMatch>>;
type StaticParams = NonNullable<ReturnType<typeof staticMatch>>;
type OneParams = NonNullable<ReturnType<typeof oneMatch>>;

it("infers exact param keys with string values (compile-time)", () => {
  const keysOk: Eq<keyof RepoParams, "orgId" | "repoId"> = true;
  const shapeOk: Eq<RepoParams, { orgId: string; repoId: string }> = true;
  const oneKeys: Eq<keyof OneParams, "id"> = true;
  const oneShape: Eq<OneParams, { id: string }> = true;
  const noKeys: Eq<keyof StaticParams, never> = true;
  const nullable: Eq<ReturnType<typeof oneMatch>, OneParams | null> = true;
  expect([keysOk, shapeOk, oneKeys, oneShape, noKeys, nullable]).toEqual([true, true, true, true, true, true]);

  const r = repoMatch("/orgs/a/repos/b");
  if (r) {
    const org: string = r.orgId;
    const repo: string = r.repoId;
    expect([org, repo]).toEqual(["a", "b"]);
    // @ts-expect-error unknown param
    void r.nope;
  }
});

it("extracts params from matching paths", () => {
  expect(repoMatch("/orgs/acme/repos/web")).toEqual({ orgId: "acme", repoId: "web" });
  expect(oneMatch("/users/42")).toEqual({ id: "42" });
  expect(repoMatch("/orgs/a-b_c.d/repos/9")).toEqual({ orgId: "a-b_c.d", repoId: "9" });
});

it("matches static patterns and returns an empty object", () => {
  const r = staticMatch("/health/check");
  expect(r).not.toBeNull();
  expect(Object.keys(r as object)).toEqual([]);
  expect(staticMatch("/health/other")).toBeNull();
  expect(staticMatch("/health")).toBeNull();
});

it("returns null for wrong segment counts", () => {
  expect(repoMatch("/orgs/acme/repos")).toBeNull();
  expect(repoMatch("/orgs/acme")).toBeNull();
  expect(repoMatch("/orgs/acme/repos/web/extra")).toBeNull();
  expect(oneMatch("/users")).toBeNull();
  expect(oneMatch("/users/1/2")).toBeNull();
});

it("returns null for wrong static literals", () => {
  expect(repoMatch("/org/acme/repos/web")).toBeNull();
  expect(repoMatch("/orgs/acme/repo/web")).toBeNull();
  expect(oneMatch("/people/42")).toBeNull();
  expect(oneMatch("/Users/42")).toBeNull();
});

it("returns null for empty parameter segments", () => {
  expect(repoMatch("/orgs//repos/web")).toBeNull();
  expect(repoMatch("/orgs/acme/repos/")).toBeNull();
  expect(oneMatch("/users/")).toBeNull();
});

it("decodes percent-encoded segments", () => {
  expect(oneMatch("/users/hello%20world")).toEqual({ id: "hello world" });
  expect(repoMatch("/orgs/caf%C3%A9/repos/a%2Fb")).toEqual({ orgId: "café", repoId: "a/b" });
  expect(oneMatch("/users/100%25")).toEqual({ id: "100%" });
});

it("returns null instead of throwing for malformed percent encodings", () => {
  for (const bad of ["/users/%", "/users/%E0%A4%A", "/users/abc%zz", "/users/%C3"]) {
    expect(() => oneMatch(bad), bad).not.toThrow();
    expect(oneMatch(bad), bad).toBeNull();
  }
  expect(repoMatch("/orgs/ok/repos/%")).toBeNull();
});
