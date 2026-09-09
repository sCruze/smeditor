import { describe, expect, it } from "vitest";
import {
  hardenLinkAttrs,
  sanitizeCSSFontFamily,
  sanitizeCSSFontSize,
  sanitizeCSSLineHeight,
  sanitizeCSSTextStrokeWidth,
  sanitizeLinkTarget,
  sanitizeURL,
} from "../src/index.js";

describe("security sanitizers", () => {
  it("allows safe http, mailto and relative URLs", () => {
    expect(sanitizeURL("https://example.com/a?q=1", { protocols: ["https"] })).toBe(
      "https://example.com/a?q=1",
    );
    expect(
      sanitizeURL("mailto:editor@example.com", { protocols: ["mailto"] }),
    ).toBe("mailto:editor@example.com");
    expect(sanitizeURL("/uploads/image.png")).toBe("/uploads/image.png");
    expect(sanitizeURL("docs/page#intro")).toBe("docs/page#intro");
  });

  it("rejects unsafe protocols and escaped-attribute URLs", () => {
    expect(sanitizeURL("javascript:alert(1)")).toBeNull();
    expect(sanitizeURL("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(sanitizeURL("https://example.com/\" onclick=\"alert(1)")).toBeNull();
    expect(sanitizeURL("//evil.example/image.png")).toBeNull();
  });

  it("keeps only safe raster data image URLs when explicitly allowed", () => {
    expect(
      sanitizeURL("data:image/png;base64,AAAA", {
        allowDataUrls: true,
        dataUrlPattern: /^data:image\/(?:png);base64,[a-z0-9+/=\s]+$/i,
      }),
    ).toBe("data:image/png;base64,AAAA");
    expect(
      sanitizeURL("data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+", {
        allowDataUrls: true,
        dataUrlPattern: /^data:image\/(?:png);base64,[a-z0-9+/=\s]+$/i,
      }),
    ).toBeNull();
  });

  it("validates link target and hardens blank targets", () => {
    expect(sanitizeLinkTarget("_blank")).toBe("_blank");
    expect(sanitizeLinkTarget("popup")).toBeNull();
    expect(hardenLinkAttrs({ href: "https://example.com", target: "_blank" })).toEqual({
      href: "https://example.com",
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("validates CSS style values allowed by paste cleanup", () => {
    expect(sanitizeCSSFontFamily("Inter, Arial")).toBe("Inter, Arial");
    expect(sanitizeCSSFontFamily("Inter; color: red")).toBeNull();
    expect(sanitizeCSSFontSize("18")).toBe("18px");
    expect(sanitizeCSSFontSize("calc(1px + 1em)")).toBeNull();
    expect(sanitizeCSSLineHeight("1.5")).toBe("1.5");
    expect(sanitizeCSSLineHeight("url(javascript:alert(1))")).toBeNull();
    expect(sanitizeCSSTextStrokeWidth("2px")).toBe("2px");
    expect(sanitizeCSSTextStrokeWidth("9px")).toBeNull();
  });
});
