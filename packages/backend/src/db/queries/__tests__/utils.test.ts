import { describe, it, expect } from "vitest";
import { riskLevel, recommendedLoad, WEEKDAYS } from "../utils.js";

describe("riskLevel", () => {
  it("returns 'high' for scores >= 0.7", () => {
    expect(riskLevel(0.7)).toBe("high");
    expect(riskLevel(0.85)).toBe("high");
    expect(riskLevel(1.0)).toBe("high");
  });

  it("returns 'medium' for scores >= 0.4 and < 0.7", () => {
    expect(riskLevel(0.4)).toBe("medium");
    expect(riskLevel(0.55)).toBe("medium");
    expect(riskLevel(0.69)).toBe("medium");
  });

  it("returns 'low' for scores < 0.4", () => {
    expect(riskLevel(0.39)).toBe("low");
    expect(riskLevel(0.1)).toBe("low");
    expect(riskLevel(0)).toBe("low");
  });
});

describe("recommendedLoad", () => {
  it("returns 'avoid' for high risk", () => {
    expect(recommendedLoad("high")).toBe("avoid");
  });

  it("returns 'light' for medium risk", () => {
    expect(recommendedLoad("medium")).toBe("light");
  });

  it("returns 'heavy' for low risk", () => {
    expect(recommendedLoad("low")).toBe("heavy");
  });
});

describe("WEEKDAYS", () => {
  it("has 7 days starting with Monday", () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS[0]).toBe("Monday");
    expect(WEEKDAYS[6]).toBe("Sunday");
  });
});
