import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { preprocessLazyImages } from "../images.js";

function docFrom(html: string, url = "https://example.com/post"): Document {
  return new JSDOM(html, { url }).window.document as unknown as Document;
}

describe("preprocessLazyImages", () => {
  it("promotes data-src to src when src is missing", () => {
    const doc = docFrom(
      '<img data-src="https://cdn.example.com/big.jpg" alt="A">'
    );
    preprocessLazyImages(doc);
    expect(doc.querySelector("img")!.getAttribute("src")).toBe(
      "https://cdn.example.com/big.jpg"
    );
  });

  it("promotes data-src when src is a base64 placeholder", () => {
    const doc = docFrom(
      '<img src="data:image/gif;base64,AAA=" data-src="https://cdn.example.com/real.jpg">'
    );
    preprocessLazyImages(doc);
    expect(doc.querySelector("img")!.getAttribute("src")).toBe(
      "https://cdn.example.com/real.jpg"
    );
  });

  it("promotes data-original / data-lazy-src / data-hi-res-src fallbacks", () => {
    for (const attr of ["data-original", "data-lazy-src", "data-hi-res-src"]) {
      const doc = docFrom(
        `<img src="data:image/gif;base64,AAA=" ${attr}="https://cdn.example.com/${attr}.jpg">`
      );
      preprocessLazyImages(doc);
      expect(doc.querySelector("img")!.getAttribute("src")).toBe(
        `https://cdn.example.com/${attr}.jpg`
      );
    }
  });

  it("picks the largest srcset entry by width descriptor", () => {
    const doc = docFrom(
      '<img src="data:image/gif;base64,AAA=" srcset="https://x/a.jpg 320w, https://x/b.jpg 1024w, https://x/c.jpg 640w">'
    );
    preprocessLazyImages(doc);
    expect(doc.querySelector("img")!.getAttribute("src")).toBe(
      "https://x/b.jpg"
    );
  });

  it("picks the largest srcset entry by DPR descriptor", () => {
    const doc = docFrom(
      '<img src="data:image/gif;base64,AAA=" srcset="https://x/1.jpg 1x, https://x/2.jpg 2x">'
    );
    preprocessLazyImages(doc);
    expect(doc.querySelector("img")!.getAttribute("src")).toBe(
      "https://x/2.jpg"
    );
  });

  it("reads data-srcset when srcset is absent", () => {
    const doc = docFrom(
      '<img src="data:image/gif;base64,AAA=" data-srcset="https://x/small.jpg 480w, https://x/big.jpg 1200w">'
    );
    preprocessLazyImages(doc);
    expect(doc.querySelector("img")!.getAttribute("src")).toBe(
      "https://x/big.jpg"
    );
  });

  it("resolves relative URLs to absolute using the document baseURI", () => {
    const doc = docFrom(
      '<img src="/media/foo.png">',
      "https://blog.example.com/2026/post"
    );
    preprocessLazyImages(doc);
    expect(doc.querySelector("img")!.getAttribute("src")).toBe(
      "https://blog.example.com/media/foo.png"
    );
  });

  it("skips placeholder patterns like /spacer.gif or /1x1", () => {
    const doc = docFrom(
      '<img src="https://cdn.example.com/spacer.gif" data-src="https://cdn.example.com/real.jpg">'
    );
    preprocessLazyImages(doc);
    expect(doc.querySelector("img")!.getAttribute("src")).toBe(
      "https://cdn.example.com/real.jpg"
    );
  });

  it("leaves a good absolute src alone", () => {
    const doc = docFrom(
      '<img src="https://cdn.example.com/good.jpg" data-src="https://cdn.example.com/other.jpg">'
    );
    preprocessLazyImages(doc);
    expect(doc.querySelector("img")!.getAttribute("src")).toBe(
      "https://cdn.example.com/good.jpg"
    );
  });
});
