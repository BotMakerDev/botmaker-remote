import { describe, expect, it } from "vitest";
import { httpBase, parseUrl, wsBase } from "./config";

describe("parseUrl", () => {
  it("reads the server's pair: line", () => {
    const ep = parseUrl("http://100.75.38.1:7788/?token=bFyNf4ds9tqiB5-j5KSDo8qV");
    expect(ep).toEqual({ host: "100.75.38.1", port: 7788, token: "bFyNf4ds9tqiB5-j5KSDo8qV", secure: false });
    expect(httpBase(ep!)).toBe("http://100.75.38.1:7788");
    expect(wsBase(ep!)).toBe("ws://100.75.38.1:7788");
  });

  it("refuses a URL with no token, and garbage", () => {
    expect(parseUrl("http://100.75.38.1:7788/")).toBeNull();
    expect(parseUrl("not a url")).toBeNull();
  });

  it("defaults the port from the scheme", () => {
    expect(parseUrl("https://box.example/?token=t")?.port).toBe(443);
  });
});
