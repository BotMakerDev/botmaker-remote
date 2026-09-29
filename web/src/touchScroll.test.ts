import { describe, expect, it } from "vitest";
import { LINES_PER_REPORT, notches, wheelReport } from "./touchScroll";

describe("wheelReport", () => {
  it("writes the SGR report tmux reads, 1-based and never below 1", () => {
    expect(wheelReport(true, 10, 5)).toBe("\x1b[<64;10;5M");
    expect(wheelReport(false, 10, 5)).toBe("\x1b[<65;10;5M");
    expect(wheelReport(true, 0, -3)).toBe("\x1b[<64;1;1M");
  });
});

describe("notches", () => {
  const line = 16;
  const step = line * LINES_PER_REPORT;

  it("pulling the finger down is wheel up: older output", () => {
    expect(notches(step * 2 + 5, line)).toEqual({ count: 2, up: true, rest: 5 });
  });

  it("pushing it up is wheel down, and keeps the remainder's sign", () => {
    expect(notches(-(step + 7), line)).toEqual({ count: 1, up: false, rest: -7 });
  });

  it("less than a step is carried to the next move", () => {
    expect(notches(step - 1, line).count).toBe(0);
    expect(notches(step - 1, line).rest).toBe(step - 1);
  });
});
