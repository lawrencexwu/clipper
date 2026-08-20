import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { extract } from "../extractor.js";
import { matchX, xAdapter } from "../adapters/x.js";
import { matchSubstack, substackAdapter } from "../adapters/substack.js";
import { matchNyt, nytAdapter } from "../adapters/nyt.js";
import { matchVocus, vocusAdapter } from "../adapters/vocus.js";
import { archivePhUrl, shouldOfferArchive } from "../archive.js";

function loadFixture(name: string, url: string): Document {
  const html = readFileSync(
    resolve(__dirname, "../../fixtures", name),
    "utf-8"
  );
  return new JSDOM(html, { url }).window.document as unknown as Document;
}

describe("matchers", () => {
  it("matchX recognises x.com and twitter.com", () => {
    expect(matchX("https://x.com/jane/status/1")).toBe(true);
    expect(matchX("https://www.x.com/jane/status/1")).toBe(true);
    expect(matchX("https://twitter.com/jane/status/1")).toBe(true);
    expect(matchX("https://example.com/x.com/jane")).toBe(false);
  });

  it("matchSubstack recognises subdomain + meta generator", () => {
    const sub = loadFixture("substack-free.html", "https://bob.substack.com/p/x");
    expect(matchSubstack("https://bob.substack.com/p/x", sub)).toBe(true);

    // Custom-domain Substack site detected via meta generator
    const custom = new JSDOM(
      '<!doctype html><html><head><meta name="generator" content="Substack"></head><body></body></html>',
      { url: "https://writer.example.com/post" }
    ).window.document as unknown as Document;
    expect(matchSubstack("https://writer.example.com/post", custom)).toBe(true);

    const generic = loadFixture(
      "generic-blog.html",
      "https://doohickey.example/x"
    );
    expect(matchSubstack("https://doohickey.example/x", generic)).toBe(false);
  });

  it("matchNyt recognises nytimes.com hosts", () => {
    expect(matchNyt("https://www.nytimes.com/2026/03/15/munis.html")).toBe(true);
    expect(matchNyt("https://nytimes.com/2026/03/15/munis.html")).toBe(true);
    expect(matchNyt("https://cooking.nytimes.com/recipes/1")).toBe(true);
    expect(matchNyt("https://nytimes.example.com/spoof")).toBe(false);
  });

  it("matchSubstack recognises the substack.com Reader inbox view", () => {
    const doc = new JSDOM(
      '<!doctype html><html><head></head><body></body></html>',
      { url: "https://substack.com/inbox/post/197316245" }
    ).window.document as unknown as Document;
    expect(
      matchSubstack("https://substack.com/inbox/post/197316245", doc)
    ).toBe(true);
    expect(matchSubstack("https://substack.com/p/some-slug", doc)).toBe(true);
    expect(matchSubstack("https://substack.com/", doc)).toBe(false);
  });

  it("matchVocus recognises vocus.cc hosts", () => {
    expect(matchVocus("https://vocus.cc/article/abc123")).toBe(true);
    expect(matchVocus("https://www.vocus.cc/user/1/article-slug")).toBe(true);
    expect(matchVocus("https://vocus.cc.example.com/spoof")).toBe(false);
    expect(matchVocus("https://example.com/vocus.cc/x")).toBe(false);
  });
});

describe("xAdapter", () => {
  it("extracts the original author's tweets as numbered paragraphs", () => {
    const url = "https://x.com/jane/status/1";
    const doc = loadFixture("x-thread.html", url);
    const result = xAdapter(doc, url);

    expect(result).not.toBeNull();
    const r = result!;
    expect(r.adapter).toBe("x");
    expect(r.author).toBe("@jane");
    expect(r.published).toBe("2026-05-10");
    expect(r.title).toMatch(/^@jane:/);

    // Five tweet paragraphs in the fixture; each preserves the user's own "N/" numbering
    expect(r.contentHtml).toMatch(/<p>1\/ Quick thread/);
    expect(r.contentHtml).toMatch(/<p>5\/ The lesson/);
    expect(r.contentHtml.match(/<p>\d+\//g)?.length).toBe(5);
  });

  it("end-to-end via extract() lands on the x adapter", () => {
    const url = "https://x.com/jane/status/1";
    const doc = loadFixture("x-thread.html", url);
    const result = extract(doc, url);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.adapter).toBe("x");
    expect(result!.frontmatter.source).toBe("x.com");
    expect(result!.body).toMatch(/Quick thread on widget economics/);
  });
});

describe("substackAdapter", () => {
  it("extracts the body via .body.markup and includes the subtitle", () => {
    const url = "https://bob.substack.com/p/future";
    const doc = loadFixture("substack-free.html", url);
    const result = substackAdapter(doc);

    expect(result).not.toBeNull();
    const r = result!;
    expect(r.adapter).toBe("substack");
    expect(r.title).toMatch(/Future of Computing/);
    expect(r.author).toBe("Bob Writer");
    expect(r.published).toBe("2026-05-01");
    expect(r.contentHtml).toMatch(
      /<h2>Why the next decade will look nothing like the last<\/h2>/
    );
    expect(r.contentHtml).toMatch(/trajectory of computing/);
  });

  it("end-to-end via extract() lands on the substack adapter", () => {
    const url = "https://bob.substack.com/p/future";
    const doc = loadFixture("substack-free.html", url);
    const result = extract(doc, url);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.adapter).toBe("substack");
    expect(result!.body).toContain("## Why the next decade will look nothing like the last");
  });
});

describe("nytAdapter", () => {
  it("strips paywall overlay and extracts byline from meta[name=byl]", () => {
    const url = "https://www.nytimes.com/2026/03/15/munis.html";
    const doc = loadFixture("nyt-article.html", url);
    const result = nytAdapter(doc);

    expect(result).not.toBeNull();
    const r = result!;
    expect(r.adapter).toBe("nyt");
    expect(r.title).toMatch(/Quiet Revolution in Municipal Bonds/);
    expect(r.author).toBe("Sarah Reporter");
    expect(r.published).toBe("2026-03-15");
    expect(r.contentHtml).toMatch(/Municipal bonds are the financial plumbing/);
    expect(r.contentHtml).not.toMatch(/Subscribe to read/);
  });

  it("end-to-end via extract() lands on the nyt adapter", () => {
    const url = "https://www.nytimes.com/2026/03/15/munis.html";
    const doc = loadFixture("nyt-article.html", url);
    const result = extract(doc, url);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.adapter).toBe("nyt");
    expect(result!.frontmatter.author).toBe("Sarah Reporter");
  });
});

describe("vocusAdapter", () => {
  it("extracts the article body and identifies Traditional Chinese", () => {
    const url = "https://vocus.cc/article/6a5e1c87fd897800010ccf61";
    const doc = loadFixture("vocus-article.html", url);
    const result = vocusAdapter(doc);

    expect(result).not.toBeNull();
    const r = result!;
    expect(r.adapter).toBe("vocus");
    expect(r.title).toBe("台灣半導體產業的下一個十年");
    expect(r.author).toBe("王大明");
    expect(r.published).toBe("2026-05-14");
    expect(r.contentHtml).toMatch(/技術演進/);
    expect(r.contentHtml).toMatch(/地緣政治/);
    expect(r.contentHtml).not.toMatch(/相關文章/);
    expect(r.contentHtml).not.toMatch(/留言區/);
  });

  it("end-to-end via extract() lands on the vocus adapter and detects zh-Hant", () => {
    const url = "https://vocus.cc/article/6a5e1c87fd897800010ccf61";
    const doc = loadFixture("vocus-article.html", url);
    const result = extract(doc, url);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.adapter).toBe("vocus");
    expect(result!.frontmatter.source).toBe("vocus.cc");
    expect(result!.frontmatter.lang).toBe("zh-Hant");
    expect(result!.frontmatter.author).toBe("王大明");
    expect(result!.body).toMatch(/## 技術演進/);
  });
});

describe("archive helpers", () => {
  it("rewrites a URL to archive.ph/newest/", () => {
    expect(archivePhUrl("https://nytimes.com/x")).toBe(
      "https://archive.ph/newest/https://nytimes.com/x"
    );
  });

  it("only offers the fallback below 200 words", () => {
    expect(shouldOfferArchive(50)).toBe(true);
    expect(shouldOfferArchive(199)).toBe(true);
    expect(shouldOfferArchive(200)).toBe(false);
    expect(shouldOfferArchive(1000)).toBe(false);
  });
});
