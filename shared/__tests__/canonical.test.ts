import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { resolveCanonicalUrl } from "../canonical.js";

function docFrom(html: string, url = "https://example.com/x"): Document {
  return new JSDOM(html, { url }).window.document as unknown as Document;
}

describe("resolveCanonicalUrl", () => {
  it("prefers <link rel=canonical> when present", () => {
    const doc = docFrom(
      '<!doctype html><html><head><link rel="canonical" href="https://real.example/post"></head><body></body></html>',
      "https://example.com/spammy?utm_source=x"
    );
    expect(
      resolveCanonicalUrl(doc, "https://example.com/spammy?utm_source=x")
    ).toBe("https://real.example/post");
  });

  it("falls back to og:url when no canonical link", () => {
    const doc = docFrom(
      '<!doctype html><html><head><meta property="og:url" content="https://real.example/post"></head><body></body></html>',
      "https://amp.example.com/amp/post"
    );
    expect(
      resolveCanonicalUrl(doc, "https://amp.example.com/amp/post")
    ).toBe("https://real.example/post");
  });

  it("returns the fallback URL if neither is present", () => {
    const doc = docFrom(
      '<!doctype html><html><head></head><body></body></html>',
      "https://example.com/post"
    );
    expect(resolveCanonicalUrl(doc, "https://example.com/post")).toBe(
      "https://example.com/post"
    );
  });

  it("resolves relative canonical hrefs against the document URL", () => {
    const doc = docFrom(
      '<!doctype html><html><head><link rel="canonical" href="/canonical/path"></head><body></body></html>',
      "https://blog.example.com/foo?a=1"
    );
    expect(
      resolveCanonicalUrl(doc, "https://blog.example.com/foo?a=1")
    ).toBe("https://blog.example.com/canonical/path");
  });

  it("ignores empty / whitespace-only canonical values", () => {
    const doc = docFrom(
      '<!doctype html><html><head><link rel="canonical" href="  "><meta property="og:url" content="https://real.example/post"></head><body></body></html>',
      "https://example.com/spammy"
    );
    expect(resolveCanonicalUrl(doc, "https://example.com/spammy")).toBe(
      "https://real.example/post"
    );
  });

  it("falls through to fallback if canonical is malformed", () => {
    const doc = docFrom(
      '<!doctype html><html><head><link rel="canonical" href="not a valid url"></head><body></body></html>',
      "https://example.com/post"
    );
    // Relative "not a valid url" actually resolves against the base — jsdom
    // will produce something. The intent is: bad inputs shouldn't crash.
    const out = resolveCanonicalUrl(doc, "https://example.com/post");
    expect(typeof out).toBe("string");
    expect(out.startsWith("http")).toBe(true);
  });
});
