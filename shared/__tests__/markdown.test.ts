import { describe, it, expect } from "vitest";
import { htmlToMarkdown } from "../markdown.js";

describe("htmlToMarkdown", () => {
  it("converts headings to ATX style", () => {
    expect(htmlToMarkdown("<h1>Title</h1><h2>Section</h2>")).toContain("# Title");
    expect(htmlToMarkdown("<h2>Section</h2>")).toContain("## Section");
  });

  it("keeps image alt text", () => {
    const md = htmlToMarkdown('<p><img src="https://x/a.png" alt="A diagram"></p>');
    expect(md).toContain("![A diagram](https://x/a.png)");
  });

  it("uses inline links, not reference style", () => {
    const md = htmlToMarkdown('<p>See <a href="https://x">here</a>.</p>');
    expect(md).toContain("[here](https://x)");
    expect(md).not.toMatch(/\[here\]\[\d+\]/);
  });

  it("uses fenced code blocks", () => {
    const md = htmlToMarkdown("<pre><code>const x = 1;</code></pre>");
    expect(md).toMatch(/```[\s\S]*const x = 1;[\s\S]*```/);
  });

  it("strips empty paragraphs", () => {
    const md = htmlToMarkdown("<p>real</p><p></p><p>   </p><p>more</p>");
    expect(md).not.toMatch(/\n\n\n/);
    expect(md).toContain("real");
    expect(md).toContain("more");
  });

  it("returns empty string for empty input", () => {
    expect(htmlToMarkdown("")).toBe("");
  });
});
