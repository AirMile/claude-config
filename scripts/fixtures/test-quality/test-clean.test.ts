import { describe, it, expect } from "vitest";
import { add, multiply } from "./calc";

describe("calc", () => {
  it("adds two numbers", () => {
    expect(add(2, 3)).toBe(5);
  });

  it("multiplies two numbers", () => {
    expect(multiply(4, 5)).toBe(20);
  });

  it("returns array of operations", () => {
    const result = [add(1, 1), multiply(2, 2)];
    expect(result).toEqual([2, 4]);
  });

  it("handles boundary case", () => {
    expect(add(Number.MAX_SAFE_INTEGER, 0)).toBe(Number.MAX_SAFE_INTEGER);
  });
});
