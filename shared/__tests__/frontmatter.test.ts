import { describe, it, expect } from "vitest";
import {
  buildFrontmatter,
  bareDomain,
  nowIso,
  parseFrontmatter,
  type Frontmatter,
} from "../frontmatter.js";

const base: Frontmatter = {
  title: "Hello",
  url: "https://example.com/foo",
  source: "example.com",
  author: "Jane",
  published: "2026-04-21",
  clipped: "2026-05-14T08:30:00+08:00",
  lang: "en",
  adapter: "generic",
  word_count: 100,
  tags: [],
};

describe("buildFrontmatter", () => {
  it("emits well-formed YAML for the base case", () => {
    const out = buildFrontmatter(base);
    expect(out.startsWith("---\n")).toBe(true);
    expect(out).toContain('title: "Hello"');
    expect(out).toContain("url: https://example.com/foo");
    expect(out).toContain("source: example.com");
    expect(out).toContain('author: "Jane"');
    expect(out).toContain("published: 2026-04-21");
    expect(out).toContain("lang: en");
    expect(out).toContain("adapter: generic");
    expect(out).toContain("word_count: 100");
    expect(out).toContain("tags: []");
    expect(out).toMatch(/---\n$/);
  });

  it("quotes empty published", () => {
    const out = buildFrontmatter({ ...base, published: "" });
    expect(out).toContain('published: ""');
  });

  it("escapes quotes inside title", () => {
    const out = buildFrontmatter({ ...base, title: 'He said "hi"' });
    expect(out).toContain('title: "He said \\"hi\\""');
  });

  it("emits tag array", () => {
    const out = buildFrontmatter({ ...base, tags: ["foo", "bar"] });
    expect(out).toContain('tags: ["foo", "bar"]');
  });
});

describe("bareDomain", () => {
  it("strips www", () => {
    expect(bareDomain("https://www.example.com/path")).toBe("example.com");
  });

  it("keeps subdomains", () => {
    expect(bareDomain("https://blog.example.com/x")).toBe("blog.example.com");
  });

  it("returns empty string for malformed input", () => {
    expect(bareDomain("not a url")).toBe("");
  });
});

describe("nowIso", () => {
  it("matches ISO8601 with offset", () => {
    expect(nowIso()).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/
    );
  });
});

describe("parseFrontmatter", () => {
  it("round-trips a canonical build", () => {
    const fm: Frontmatter = {
      ...base,
      tags: ["finance", "macro"],
    };
    const md = buildFrontmatter(fm) + "Body content here\n";
    const parsed = parseFrontmatter(md);
    expect(parsed.frontmatter).toEqual(fm);
    expect(parsed.body).toBe("Body content here\n");
  });

  it("returns null frontmatter when delimiters are missing", () => {
    expect(parseFrontmatter("Just body").frontmatter).toBeNull();
  });

  it("handles empty tags array", () => {
    const fm: Frontmatter = { ...base, tags: [] };
    const md = buildFrontmatter(fm) + "Body\n";
    const parsed = parseFrontmatter(md);
    expect(parsed.frontmatter?.tags).toEqual([]);
  });

  it("unescapes quoted values", () => {
    const fm: Frontmatter = { ...base, title: 'She said "hi"' };
    const md = buildFrontmatter(fm) + "Body\n";
    const parsed = parseFrontmatter(md);
    expect(parsed.frontmatter?.title).toBe('She said "hi"');
  });

  it("handles empty published", () => {
    const fm: Frontmatter = { ...base, published: "" };
    const md = buildFrontmatter(fm) + "Body\n";
    const parsed = parseFrontmatter(md);
    expect(parsed.frontmatter?.published).toBe("");
  });
});
