import { describe, expect, it } from "vitest";
import { tildePath } from "./DirPicker";

describe("tildePath", () => {
  it("shows home as ~ and paths under it relative to ~", () => {
    expect(tildePath("/home/me", "/home/me")).toBe("~");
    expect(tildePath("/home/me/IdeaProjects/botmaker", "/home/me")).toBe("~/IdeaProjects/botmaker");
  });

  it("leaves a sibling that only shares the prefix alone", () => {
    expect(tildePath("/home/meadow", "/home/me")).toBe("/home/meadow");
  });

  it("shows the whole path while home is not known yet", () => {
    expect(tildePath("/home/me/x", "")).toBe("/home/me/x");
  });
});
