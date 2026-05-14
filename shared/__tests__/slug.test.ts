import { describe, it, expect } from "vitest";
import { slugify } from "../slug.js";

describe("slugify", () => {
  it("converts a plain English title", () => {
    expect(slugify("Why Widgets Matter")).toBe("why-widgets-matter");
  });

  it("strips punctuation", () => {
    expect(slugify("Hello, world! How are you?")).toBe("hello-world-how-are-you");
  });

  it("collapses whitespace", () => {
    expect(slugify("  too    many   spaces  ")).toBe("too-many-spaces");
  });

  it("preserves CJK characters without crashing", () => {
    const result = slugify("這是一篇繁體中文文章");
    expect(result).toBe("這是一篇繁體中文文章");
    expect(result.length).toBeGreaterThan(0);
  });

  it("preserves mixed Latin + CJK titles", () => {
    expect(slugify("AI 的未來 (2026)")).toBe("ai-的未來-2026");
  });

  it("handles Japanese kana", () => {
    const result = slugify("これは日本語のテスト");
    expect(result).toContain("これは日本語のテスト");
  });

  it("falls back to untitled on empty input", () => {
    expect(slugify("")).toBe("untitled");
    expect(slugify("   ")).toBe("untitled");
    expect(slugify("!!!")).toBe("untitled");
  });

  it("caps very long titles", () => {
    const long = "a".repeat(200);
    expect(slugify(long).length).toBeLessThanOrEqual(80);
  });
});
