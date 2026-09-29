import { describe, expect, it } from "vitest";
import { isUnreachable, networkOf, reachSteps } from "./reach";

describe("networkOf", () => {
  it("knows the tailnet by its range and its names", () => {
    expect(networkOf("100.68.8.73")).toBe("tailnet");
    expect(networkOf("100.127.0.1")).toBe("tailnet");
    expect(networkOf("box.tail1234.ts.net")).toBe("tailnet");
    expect(networkOf("100.128.0.1")).toBe("other");
  });

  it("knows the three private ranges as the local network", () => {
    expect(networkOf("192.168.0.107")).toBe("lan");
    expect(networkOf("10.0.0.2")).toBe("lan");
    expect(networkOf("172.20.1.1")).toBe("lan");
    expect(networkOf("172.32.1.1")).toBe("other");
    expect(networkOf("example.com")).toBe("other");
  });
});

describe("reachSteps", () => {
  it("sends a tailnet phone to Always-on VPN and the battery setting", () => {
    const steps = reachSteps("100.68.8.73").join(" ");
    expect(steps).toContain("Always-on VPN");
    expect(steps).toContain("Unrestricted");
    expect(steps).toContain("--doctor");
  });

  it("sends a local-network phone to the Wi-Fi", () => {
    expect(reachSteps("192.168.0.107")[0]).toContain("same Wi-Fi");
  });
});

describe("isUnreachable", () => {
  it("tells a connection that never happened from a server that answered", () => {
    expect(isUnreachable(new TypeError("Failed to fetch"))).toBe(true);
    expect(isUnreachable(new DOMException("timed out", "TimeoutError"))).toBe(true);
    expect(isUnreachable(new Error("unauthorized"))).toBe(false);
    expect(isUnreachable(new Error("Internal Server Error"))).toBe(false);
  });
});
