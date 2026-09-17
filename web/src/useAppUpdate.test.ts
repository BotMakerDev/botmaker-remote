import { describe, expect, test } from "vitest";
import { APP_VERSION, isNewer, parseVersion } from "./useAppUpdate";

/**
 * `isNewer` decides whether every installed user sees an update banner, from two strings that come from
 * two different places — a GitHub tag and a build-time constant baked out of `web/package.json`. It is
 * the function B14 is about: nothing keeps those two sources in step, so the comparison is all that
 * stands between a released APK and a silent no-op.
 */

describe("parseVersion", () => {
  test("a tag and a bare version parse the same", () => {
    expect(parseVersion("v1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("1.2.3")).toEqual([1, 2, 3]);
  });

  test("any leading non-digits are stripped, whatever the tag prefix is", () => {
    expect(parseVersion("botpilot-2.0.1")).toEqual([2, 0, 1]);
  });

  test("a pre-release or build suffix becomes a trailing zero", () => {
    expect(parseVersion("1.2.3-rc1")).toEqual([1, 2, 3, 0]);
    expect(parseVersion("1.2.3+build9")).toEqual([1, 2, 3, 0]);
  });

  test("junk parses to zeros rather than NaN, so a comparison never goes undefined", () => {
    expect(parseVersion("")).toEqual([0]);
    expect(parseVersion("nightly")).toEqual([0]);
  });
});

describe("isNewer", () => {
  test("a higher component at any position is newer", () => {
    expect(isNewer("1.2.4", "1.2.3")).toBe(true);
    expect(isNewer("1.3.0", "1.2.9")).toBe(true);
    expect(isNewer("2.0.0", "1.9.9")).toBe(true);
  });

  test("a lower component at any position is not", () => {
    expect(isNewer("1.2.3", "1.2.4")).toBe(false);
    expect(isNewer("1.2.9", "1.3.0")).toBe(false);
  });

  test("the same version is not newer than itself", () => {
    expect(isNewer("1.2.3", "1.2.3")).toBe(false);
  });

  test("the tag's v prefix does not make it newer than the bare package version", () => {
    // The two sides genuinely differ in shape: GitHub tags are "v0.1.0", package.json is "0.1.0".
    expect(isNewer("v0.1.0", "0.1.0")).toBe(false);
    expect(isNewer("v0.1.1", "0.1.0")).toBe(true);
  });

  test("a longer tuple is newer only if the extra part is non-zero", () => {
    expect(isNewer("1.2.3.1", "1.2.3")).toBe(true);
    expect(isNewer("1.2.3.0", "1.2.3")).toBe(false);
    expect(isNewer("1.2", "1.2.0")).toBe(false);
    expect(isNewer("1.2.1", "1.2")).toBe(true);
  });

  test("a release does not update someone running its own release candidate", () => {
    // Characterisation of a real gap: "-rc1" parses to a trailing 0, so 1.2.3-rc1 and 1.2.3 compare
    // equal in both directions. An RC tester is never offered the release they were testing for.
    expect(isNewer("1.2.3", "1.2.3-rc1")).toBe(false);
    expect(isNewer("1.2.3-rc1", "1.2.3")).toBe(false);
    expect(isNewer("1.2.3-rc2", "1.2.3-rc1")).toBe(false);
  });

  test("a downgrade is never offered, which is what makes a mis-cut tag survivable", () => {
    expect(isNewer("0.0.9", APP_VERSION)).toBe(false);
  });
});

describe("APP_VERSION", () => {
  test("the build-time constant is a version, not the un-substituted placeholder", () => {
    // If Vite's `define` ever stops firing, this reads as the literal identifier and every user is
    // told they are out of date forever.
    expect(APP_VERSION).toMatch(/^\d+\.\d+/);
  });
});
