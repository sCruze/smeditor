import { describe, it, expect } from "vitest";
import { sanitizeCSSColor } from "../src/index.js";

describe("sanitizeCSSColor", () => {
  it("accepts self-contained color tokens used by color marks", () => {
    expect(sanitizeCSSColor("#f00")).toBe("#f00");
    expect(sanitizeCSSColor("#ff000080")).toBe("#ff000080");
    expect(sanitizeCSSColor("rgb(255, 0, 0)")).toBe("rgb(255, 0, 0)");
    expect(sanitizeCSSColor("rgba(255 0 0 / 50%)")).toBe("rgba(255 0 0 / 50%)");
    expect(sanitizeCSSColor("hsl(120, 100%, 50%)")).toBe("hsl(120, 100%, 50%)");
    expect(sanitizeCSSColor("hsla(120 100% 50% / 0.5)")).toBe("hsla(120 100% 50% / 0.5)");
    expect(sanitizeCSSColor("rebeccapurple")).toBe("rebeccapurple");
  });

  it("rejects values that can escape a single CSS color declaration", () => {
    expect(sanitizeCSSColor("rgb(255; background: red)")).toBeNull();
    expect(sanitizeCSSColor("url(javascript:alert(1))")).toBeNull();
    expect(sanitizeCSSColor("var(--brand-color)")).toBeNull();
    expect(sanitizeCSSColor("red; color: blue")).toBeNull();
    expect(sanitizeCSSColor('red" onclick="alert(1)')).toBeNull();
  });
});
