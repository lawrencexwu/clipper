import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { extract } from "../extractor.js";

function loadFixture(name: string, url: string) {
  const html = readFileSync(
    resolve(__dirname, "../../fixtures", name),
    "utf-8"
  );
  const dom = new JSDOM(html, { url });
  return dom.window.document as unknown as Document;
}

describe("extract: generic blog fixture", () => {
  it("produces clean markdown with valid frontmatter", () => {
    const doc = loadFixture("generic-blog.html", "https://doohickey.example/widgets");
    const result = extract(doc, "https://doohickey.example/widgets");

    expect(result).not.toBeNull();
    const r = result!;

    expect(r.frontmatter.title).toMatch(/Why Widgets Matter/);
    expect(r.frontmatter.source).toBe("doohickey.example");
    expect(r.frontmatter.url).toBe("https://doohickey.example/widgets");
    expect(r.frontmatter.author).toBe("Jane Author");
    expect(r.frontmatter.published).toBe("2026-04-21");
    expect(r.frontmatter.lang).toBe("en");
    expect(r.frontmatter.adapter).toBe("generic");
    expect(r.frontmatter.word_count).toBeGreaterThan(100);

    expect(r.body).toContain("widgets");
    expect(r.body).toMatch(/^#{1,3} /m); // contains an ATX heading
    expect(r.markdown.startsWith("---\n")).toBe(true);
    expect(r.markdown).toContain("\n---\n");
  });
});

describe("extract: substack-free fixture", () => {
  it("extracts the article body via generic Readability", () => {
    const doc = loadFixture(
      "substack-free.html",
      "https://bob.substack.com/p/future"
    );
    const result = extract(doc, "https://bob.substack.com/p/future");

    expect(result).not.toBeNull();
    const r = result!;

    expect(r.frontmatter.title).toMatch(/Future of Computing/);
    expect(r.frontmatter.source).toBe("bob.substack.com");
    expect(r.frontmatter.published).toBe("2026-05-01");
    expect(r.body).toContain("trajectory of computing");
    expect(r.frontmatter.word_count).toBeGreaterThan(200);
  });
});

describe("extract: nyt-article fixture", () => {
  it("extracts the article body even with paywall overlay present", () => {
    const doc = loadFixture(
      "nyt-article.html",
      "https://www.nytimes.com/2026/03/15/munis.html"
    );
    const result = extract(
      doc,
      "https://www.nytimes.com/2026/03/15/munis.html"
    );

    expect(result).not.toBeNull();
    const r = result!;
    expect(r.frontmatter.source).toBe("nytimes.com");
    expect(r.body.toLowerCase()).toContain("municipal bonds");
    expect(r.body).not.toContain("Subscribe to read");
  });
});

describe("extract: x-thread fixture", () => {
  it("returns a result (generic adapter likely produces partial output for X)", () => {
    // X/Twitter is not well-served by generic Readability; per-site adapter
    // lands in Phase 5. For now we just verify the pipeline doesn't crash.
    const doc = loadFixture("x-thread.html", "https://x.com/jane/status/1");
    const result = extract(doc, "https://x.com/jane/status/1");
    if (result) {
      expect(result.frontmatter.source).toBe("x.com");
    }
  });
});
