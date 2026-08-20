#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/turndown-plugin-gfm/lib/turndown-plugin-gfm.cjs.js
var require_turndown_plugin_gfm_cjs = __commonJS({
  "node_modules/turndown-plugin-gfm/lib/turndown-plugin-gfm.cjs.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var highlightRegExp = /highlight-(?:text|source)-([a-z0-9]+)/;
    function highlightedCodeBlock(turndownService) {
      turndownService.addRule("highlightedCodeBlock", {
        filter: function(node) {
          var firstChild = node.firstChild;
          return node.nodeName === "DIV" && highlightRegExp.test(node.className) && firstChild && firstChild.nodeName === "PRE";
        },
        replacement: function(content, node, options) {
          var className = node.className || "";
          var language = (className.match(highlightRegExp) || [null, ""])[1];
          return "\n\n" + options.fence + language + "\n" + node.firstChild.textContent + "\n" + options.fence + "\n\n";
        }
      });
    }
    function strikethrough(turndownService) {
      turndownService.addRule("strikethrough", {
        filter: ["del", "s", "strike"],
        replacement: function(content) {
          return "~" + content + "~";
        }
      });
    }
    var indexOf = Array.prototype.indexOf;
    var every = Array.prototype.every;
    var rules = {};
    rules.tableCell = {
      filter: ["th", "td"],
      replacement: function(content, node) {
        return cell(content, node);
      }
    };
    rules.tableRow = {
      filter: "tr",
      replacement: function(content, node) {
        var borderCells = "";
        var alignMap = { left: ":--", right: "--:", center: ":-:" };
        if (isHeadingRow(node)) {
          for (var i = 0; i < node.childNodes.length; i++) {
            var border = "---";
            var align = (node.childNodes[i].getAttribute("align") || "").toLowerCase();
            if (align) border = alignMap[align] || border;
            borderCells += cell(border, node.childNodes[i]);
          }
        }
        return "\n" + content + (borderCells ? "\n" + borderCells : "");
      }
    };
    rules.table = {
      // Only convert tables with a heading row.
      // Tables with no heading row are kept using `keep` (see below).
      filter: function(node) {
        return node.nodeName === "TABLE" && isHeadingRow(node.rows[0]);
      },
      replacement: function(content) {
        content = content.replace("\n\n", "\n");
        return "\n\n" + content + "\n\n";
      }
    };
    rules.tableSection = {
      filter: ["thead", "tbody", "tfoot"],
      replacement: function(content) {
        return content;
      }
    };
    function isHeadingRow(tr) {
      var parentNode = tr.parentNode;
      return parentNode.nodeName === "THEAD" || parentNode.firstChild === tr && (parentNode.nodeName === "TABLE" || isFirstTbody(parentNode)) && every.call(tr.childNodes, function(n) {
        return n.nodeName === "TH";
      });
    }
    function isFirstTbody(element) {
      var previousSibling = element.previousSibling;
      return element.nodeName === "TBODY" && (!previousSibling || previousSibling.nodeName === "THEAD" && /^\s*$/i.test(previousSibling.textContent));
    }
    function cell(content, node) {
      var index = indexOf.call(node.parentNode.childNodes, node);
      var prefix = " ";
      if (index === 0) prefix = "| ";
      return prefix + content + " |";
    }
    function tables(turndownService) {
      turndownService.keep(function(node) {
        return node.nodeName === "TABLE" && !isHeadingRow(node.rows[0]);
      });
      for (var key in rules) turndownService.addRule(key, rules[key]);
    }
    function taskListItems(turndownService) {
      turndownService.addRule("taskListItems", {
        filter: function(node) {
          return node.type === "checkbox" && node.parentNode.nodeName === "LI";
        },
        replacement: function(content, node) {
          return (node.checked ? "[x]" : "[ ]") + " ";
        }
      });
    }
    function gfm2(turndownService) {
      turndownService.use([
        highlightedCodeBlock,
        strikethrough,
        tables,
        taskListItems
      ]);
    }
    exports.gfm = gfm2;
    exports.highlightedCodeBlock = highlightedCodeBlock;
    exports.strikethrough = strikethrough;
    exports.tables = tables;
    exports.taskListItems = taskListItems;
  }
});

// claude-code-skill/clip.ts
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";

// shared/adapters/generic.ts
import { Readability } from "@mozilla/readability";
function genericAdapter(doc) {
  const cloned = doc.cloneNode(true);
  const parsed = new Readability(cloned).parse();
  if (!parsed) return null;
  return {
    title: (parsed.title ?? doc.title ?? "").trim(),
    contentHtml: parsed.content ?? "",
    author: (parsed.byline ?? extractAuthor(doc)).trim(),
    published: extractPublished(doc),
    adapter: "generic"
  };
}
function extractAuthor(doc) {
  const meta = doc.querySelector('meta[name="author"]')?.getAttribute("content") ?? doc.querySelector('meta[property="article:author"]')?.getAttribute("content");
  return meta ?? "";
}
function extractPublished(doc) {
  const raw = doc.querySelector('meta[property="article:published_time"]')?.getAttribute("content") ?? doc.querySelector('meta[name="date"]')?.getAttribute("content") ?? doc.querySelector("time[datetime]")?.getAttribute("datetime") ?? "";
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

// shared/adapters/x.ts
function matchX(url) {
  try {
    const u = new URL(url);
    return /^(www\.)?(x|twitter)\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}
function xAdapter(doc, url) {
  const handle = extractHandle(url);
  if (!handle) return null;
  const articles = Array.from(
    doc.querySelectorAll('article[data-testid="tweet"]')
  );
  if (articles.length === 0) return null;
  const parts = [];
  let index = 0;
  for (const article of articles) {
    const tweetHandle = articleAuthorHandle(article);
    if (tweetHandle !== handle) continue;
    const text = articleText(article);
    if (!text) continue;
    index++;
    const numbered = /^\d+\s*\/\s*/.test(text) ? text : `${index}/ ${text}`;
    let html = `<p>${escapeHtml(numbered)}</p>`;
    for (const img of articleImages(article)) {
      html += `<p><img src="${escapeAttr(img.src)}" alt="${escapeAttr(img.alt)}"></p>`;
    }
    for (const q of articleQuotes(article)) {
      html += `<blockquote><p>@${escapeHtml(q.author)}: ${escapeHtml(q.text)}</p></blockquote>`;
    }
    parts.push(html);
  }
  if (parts.length === 0) return null;
  const firstText = articleText(articles[0]) ?? "";
  const previewText = firstText.replace(/^\d+\s*\/\s*/, "").trim();
  const title = `@${handle}: ${previewText.slice(0, 80).replace(/\s+/g, " ")}` + (previewText.length > 80 ? "\u2026" : "");
  const timeEl = articles[0].querySelector("time[datetime]");
  const published = timeEl?.getAttribute("datetime")?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
  return {
    title,
    contentHtml: parts.join("\n"),
    author: `@${handle}`,
    published,
    adapter: "x"
  };
}
function extractHandle(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] ?? null;
  } catch {
    return null;
  }
}
function articleAuthorHandle(article) {
  const link = article.querySelector(
    '[data-testid="User-Name"] a[href^="/"]'
  );
  const href = link?.getAttribute("href") ?? "";
  const parts = href.split("/").filter(Boolean);
  return parts[0] ?? null;
}
function articleText(article) {
  const el = article.querySelector('[data-testid="tweetText"]');
  return el?.textContent?.trim() ?? "";
}
function articleImages(article) {
  const result = [];
  for (const img of Array.from(article.querySelectorAll("img[src]"))) {
    const src = img.getAttribute("src") ?? "";
    const alt = img.getAttribute("alt") ?? "";
    if (!src) continue;
    if (/\/(profile|avatar)/i.test(src)) continue;
    if (/(profile|avatar)/i.test(img.getAttribute("class") ?? "")) continue;
    result.push({ src, alt });
  }
  return result;
}
function articleQuotes(article) {
  const result = [];
  for (const nested of Array.from(article.querySelectorAll("article"))) {
    const author = articleAuthorHandle(nested);
    const text = articleText(nested);
    if (author && text) result.push({ author, text });
  }
  return result;
}
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// shared/adapters/substack.ts
function matchSubstack(url, doc) {
  try {
    const u = new URL(url);
    if (/\.substack\.com$/.test(u.hostname)) return true;
    if (u.hostname === "substack.com" && /^\/(inbox\/post|p|inbox\/p)\//.test(u.pathname)) {
      return true;
    }
  } catch {
  }
  const gen = doc.querySelector('meta[name="generator"]')?.getAttribute("content");
  return gen === "Substack";
}
function substackAdapter(doc) {
  const bodyEl = doc.querySelector(
    ".body.markup, div.body, .available-content"
  );
  if (!bodyEl) return null;
  const titleEl = doc.querySelector(".post-title") ?? doc.querySelector("h1.post-title") ?? doc.querySelector("h1");
  const subtitleEl = doc.querySelector(".subtitle, h3.subtitle");
  const title = (titleEl?.textContent ?? doc.title ?? "").trim().replace(/\s+-\s+[^-]+(Substack)?$/i, "").trim();
  const subtitle = subtitleEl?.textContent?.trim() ?? "";
  let html = "";
  if (subtitle) html += `<h2>${escapeHtml2(subtitle)}</h2>
`;
  html += rewriteFootnotes(bodyEl);
  const author = doc.querySelector(".author-name, a.author-name, [rel='author']")?.textContent?.trim() ?? doc.querySelector('meta[name="author"]')?.getAttribute("content")?.trim() ?? "";
  const published = matchDate(
    doc.querySelector('meta[property="article:published_time"]')?.getAttribute("content")
  ) ?? matchDate(doc.querySelector("time[datetime]")?.getAttribute("datetime")) ?? "";
  return {
    title,
    contentHtml: html,
    author,
    published,
    adapter: "substack"
  };
}
function rewriteFootnotes(bodyEl) {
  const clone = bodyEl.cloneNode(true);
  const anchors = Array.from(
    clone.querySelectorAll("a.footnote-anchor, a[id^='footnote-anchor']")
  );
  if (anchors.length === 0) return clone.innerHTML;
  for (let i = 0; i < anchors.length; i++) {
    const ref = clone.ownerDocument.createTextNode(`[^${i + 1}]`);
    anchors[i].replaceWith(ref);
  }
  const defs = Array.from(
    clone.querySelectorAll(".footnote, .footnote-body, [id^='footnote-']")
  ).filter((el) => !el.matches("a"));
  let trailer = "";
  if (defs.length > 0) {
    trailer += "<hr><p><strong>Footnotes</strong></p>";
    defs.forEach((def, i) => {
      const text = def.textContent?.trim() ?? "";
      if (text) trailer += `<p>[^${i + 1}]: ${escapeHtml2(text)}</p>`;
      def.remove();
    });
  }
  return clone.innerHTML + trailer;
}
function matchDate(raw) {
  if (!raw) return void 0;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : void 0;
}
function escapeHtml2(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// shared/adapters/nyt.ts
function matchNyt(url) {
  try {
    const u = new URL(url);
    return /(^|\.)nytimes\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}
function nytAdapter(doc) {
  const cloned = doc.cloneNode(true);
  stripPaywall(cloned);
  const bodyEl = cloned.querySelector('section[name="articleBody"]') ?? cloned.querySelector("article section");
  if (!bodyEl) return null;
  const titleEl = cloned.querySelector('h1[data-testid="headline"]') ?? cloned.querySelector("article h1") ?? cloned.querySelector("h1");
  const title = titleEl?.textContent?.trim() ?? cloned.title.replace(/\s*-\s*The New York Times.*$/i, "").trim();
  const byl = cloned.querySelector('meta[name="byl"]')?.getAttribute("content")?.trim();
  const bylineText = cloned.querySelector('[data-testid="byline"]')?.textContent?.trim();
  const author = (byl ?? bylineText ?? "").replace(/^By\s+/i, "").trim();
  const published = matchDate2(
    cloned.querySelector('meta[property="article:published_time"]')?.getAttribute("content")
  ) ?? matchDate2(cloned.querySelector("time[datetime]")?.getAttribute("datetime")) ?? "";
  return {
    title,
    contentHtml: bodyEl.innerHTML,
    author,
    published,
    adapter: "nyt"
  };
}
function stripPaywall(doc) {
  const selectors = [
    '[data-testid="paywall-overlay"]',
    '[data-testid*="paywall" i]',
    '[id*="gateway" i]',
    '[class*="paywall" i]',
    '[class*="gateway" i]'
  ];
  for (const sel of selectors) {
    for (const el of Array.from(doc.querySelectorAll(sel))) {
      el.remove();
    }
  }
}
function matchDate2(raw) {
  if (!raw) return void 0;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : void 0;
}

// shared/adapters/vocus.ts
function matchVocus(url) {
  try {
    const u = new URL(url);
    return /(^|\.)vocus\.cc$/.test(u.hostname);
  } catch {
    return false;
  }
}
function vocusAdapter(doc) {
  const jsonLd = readArticleJsonLd(doc);
  const contentHtml = findBodyHtml(doc) ?? (jsonLd?.articleBody ? `<p>${escapeHtml3(jsonLd.articleBody)}</p>` : null);
  if (!contentHtml) return null;
  const title = jsonLd?.headline ?? metaContent(doc, 'meta[property="og:title"]') ?? doc.querySelector("h1")?.textContent?.trim() ?? doc.title.replace(/\s*\|\s*方格子[\s\S]*$/, "").trim();
  const author = jsonLd?.author ?? metaContent(doc, 'meta[name="author"]') ?? metaContent(doc, 'meta[property="article:author"]') ?? doc.querySelector('[data-testid="author-name"], .author-name, a[href*="/user/"]')?.textContent?.trim() ?? "";
  const published = matchDate3(
    metaContent(doc, 'meta[property="article:published_time"]') ?? metaContent(doc, 'meta[name="date"]') ?? jsonLd?.datePublished
  ) ?? matchDate3(doc.querySelector("time[datetime]")?.getAttribute("datetime")) ?? "";
  return {
    title,
    contentHtml,
    author,
    published,
    adapter: "vocus"
  };
}
function findBodyHtml(doc) {
  const selectors = [
    '[itemprop="articleBody"]',
    "article .article-content",
    "article [class*='ArticleContent' i]",
    "article [class*='PostContent' i]",
    "article [class*='content' i]",
    "main article",
    "article",
    ".article-content",
    ".post-content",
    "#article-content",
    "main [role='article']"
  ];
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el && (el.textContent ?? "").trim().length > 200) {
      return stripUiChrome(el).innerHTML;
    }
  }
  return null;
}
function stripUiChrome(el) {
  const clone = el.cloneNode(true);
  const junkSelectors = [
    "[class*='share' i]",
    "[class*='comment' i]",
    "[class*='related' i]",
    "[class*='recommend' i]",
    "[class*='subscribe' i]",
    "[class*='paywall' i]",
    "[class*='sidebar' i]",
    "button",
    "script",
    "style"
  ];
  for (const sel of junkSelectors) {
    for (const j of Array.from(clone.querySelectorAll(sel))) j.remove();
  }
  return clone;
}
function readArticleJsonLd(doc) {
  const scripts = Array.from(
    doc.querySelectorAll('script[type="application/ld+json"]')
  );
  for (const s of scripts) {
    const raw = s.textContent?.trim();
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      const article = pickArticle(data);
      if (article) return article;
    } catch {
    }
  }
  return null;
}
function pickArticle(data) {
  if (!data || typeof data !== "object") return null;
  const nodes = Array.isArray(data) ? data : data["@graph"] ?? [data];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const t = node["@type"];
    const isArticle = Array.isArray(t) ? t.some((x) => typeof x === "string" && /Article|BlogPosting|NewsArticle/i.test(x)) : typeof t === "string" && /Article|BlogPosting|NewsArticle/i.test(t);
    if (!isArticle) continue;
    const n = node;
    const author = extractAuthorName(n.author);
    return {
      headline: typeof n.headline === "string" ? n.headline : void 0,
      articleBody: typeof n.articleBody === "string" ? n.articleBody : void 0,
      author,
      datePublished: typeof n.datePublished === "string" ? n.datePublished : void 0
    };
  }
  return null;
}
function extractAuthorName(a) {
  if (!a) return void 0;
  if (typeof a === "string") return a;
  if (Array.isArray(a)) {
    for (const item of a) {
      const name = extractAuthorName(item);
      if (name) return name;
    }
    return void 0;
  }
  if (typeof a === "object") {
    const name = a.name;
    if (typeof name === "string") return name;
  }
  return void 0;
}
function metaContent(doc, selector) {
  const v = doc.querySelector(selector)?.getAttribute("content")?.trim();
  return v || void 0;
}
function matchDate3(raw) {
  if (!raw) return void 0;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : void 0;
}
function escapeHtml3(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// shared/adapters/index.ts
var adapters = [
  { name: "x", match: (url) => matchX(url), run: xAdapter },
  { name: "substack", match: matchSubstack, run: substackAdapter },
  { name: "nyt", match: (url) => matchNyt(url), run: nytAdapter },
  { name: "vocus", match: (url) => matchVocus(url), run: vocusAdapter }
];
function dispatch(doc, url) {
  for (const a of adapters) {
    if (!a.match(url, doc)) continue;
    const result = a.run(doc, url);
    if (result) return result;
  }
  return genericAdapter(doc);
}

// shared/markdown.ts
var import_turndown_plugin_gfm = __toESM(require_turndown_plugin_gfm_cjs(), 1);
import TurndownService from "turndown";
function createTurndown() {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    fence: "```",
    bulletListMarker: "-",
    emDelimiter: "_",
    linkStyle: "inlined",
    hr: "---"
  });
  td.use(import_turndown_plugin_gfm.gfm);
  td.addRule("strip-empty-paragraph", {
    filter: (node) => node.nodeName === "P" && (node.textContent ?? "").trim() === "" && node.childElementCount === 0,
    replacement: () => ""
  });
  td.addRule("image-with-alt", {
    filter: "img",
    replacement: (_content, node) => {
      const el = node;
      const src = el.getAttribute("src") ?? "";
      const alt = el.getAttribute("alt") ?? "";
      if (!src) return alt ? `[${alt}]` : "";
      return `![${alt}](${src})`;
    }
  });
  return td;
}
function htmlToMarkdown(html) {
  if (!html) return "";
  const td = createTurndown();
  return td.turndown(html).replace(/\n{3,}/g, "\n\n").trim();
}

// shared/frontmatter.ts
function yamlString(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
function buildFrontmatter(fm) {
  const tagsLine = fm.tags.length === 0 ? "tags: []" : `tags: [${fm.tags.map(yamlString).join(", ")}]`;
  const lines = [
    "---",
    `title: ${yamlString(fm.title)}`,
    `url: ${fm.url}`,
    `source: ${fm.source}`,
    `author: ${yamlString(fm.author)}`,
    `published: ${fm.published ? fm.published : '""'}`,
    `clipped: ${fm.clipped}`,
    `lang: ${fm.lang}`,
    `adapter: ${fm.adapter}`,
    `word_count: ${fm.word_count}`,
    tagsLine,
    "---",
    ""
  ];
  return lines.join("\n");
}
function bareDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
function nowIso(date = /* @__PURE__ */ new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const tz = -date.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const hh = pad(Math.floor(Math.abs(tz) / 60));
  const mm = pad(Math.abs(tz) % 60);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hh}:${mm}`;
}

// shared/lang.ts
var TRAD_CHARS = new Set(
  "\u9AD4\u570B\u5B78\u5BEB\u5C0D\u958B\u70BA\u5F9E\u904E\u4F86\u500B\u8AAA\u767C\u9EDE\u6642\u9019\u9084\u6703\u6A23\u95DC\u9580\u984C\u7DB2\u969B\u8B93\u5834\u982D\u5BE6\u7576\u9802\u98DB\u6578\u9577\u611B\u756B\u6771\u8ECA\u8072\u5EE3\u696D\u52D9\u89BA\u6C23\u7D19\u5E63\u986F\u7D93\u6B77\u89C0\u50F9\u8CB7\u8CE3\u8ECA\u8F1B\u9EBC\u7576\u7576\u52D5\u767C\u8655\u7A2E\u8B80\u6578\u805E\u8F15\u820A\u904B\u52D5\u5716\u66F8\u807D\u898B\u89BA\u8FA6\u54E1\u5BE6\u5BE6\u969B\u969B\u6B50\u8C50\u8C50"
);
var SIMP_CHARS = new Set(
  "\u4F53\u56FD\u5B66\u5199\u5BF9\u5F00\u4E3A\u4ECE\u8FC7\u6765\u4E2A\u8BF4\u53D1\u70B9\u65F6\u8FD9\u8FD8\u4F1A\u6837\u5173\u95E8\u9898\u7F51\u9645\u8BA9\u573A\u5934\u5B9E\u5F53\u9876\u98DE\u6570\u957F\u7231\u753B\u4E1C\u8F66\u58F0\u5E7F\u4E1A\u52A1\u89C9\u6C14\u7EB8\u5E01\u663E\u7ECF\u5386\u89C2\u4EF7\u4E70\u5356\u8F66\u8F86\u4E48\u5F53\u5F53\u52A8\u53D1\u5904\u79CD\u8BFB\u6570\u95FB\u8F7B\u65E7\u8FD0\u52A8\u56FE\u4E66\u542C\u89C1\u89C9\u529E\u5458\u5B9E\u5B9E\u9645\u9645\u6B27\u4E30\u4E30"
);
function detectChineseVariant(text) {
  let trad = 0;
  let simp = 0;
  for (const ch of text) {
    if (TRAD_CHARS.has(ch)) trad++;
    else if (SIMP_CHARS.has(ch)) simp++;
  }
  if (trad === 0 && simp === 0) return "zh";
  return trad >= simp ? "zh-Hant" : "zh-Hans";
}
function detectLang(text) {
  if (!text) return "other";
  const sample = text.slice(0, 4e3);
  let han = 0;
  let kana = 0;
  let latin = 0;
  for (const ch of sample) {
    const cp = ch.codePointAt(0);
    if (cp >= 12352 && cp <= 12447 || cp >= 12448 && cp <= 12543) {
      kana++;
    } else if (cp >= 19968 && cp <= 40959 || cp >= 13312 && cp <= 19903 || cp >= 63744 && cp <= 64255) {
      han++;
    } else if (cp >= 65 && cp <= 90 || cp >= 97 && cp <= 122) {
      latin++;
    }
  }
  if (kana >= 5 || kana > 0 && kana * 4 >= han) return "ja";
  if (han >= 20 && han > latin / 2) return detectChineseVariant(sample);
  if (latin >= 20) return "en";
  return "other";
}

// shared/images.ts
var LAZY_SRC_ATTRS = [
  "data-src",
  "data-original",
  "data-lazy-src",
  "data-lazy",
  "data-hi-res-src",
  "data-full-src",
  "data-image-src"
];
function preprocessLazyImages(doc) {
  for (const img of Array.from(doc.querySelectorAll("img"))) {
    const raw = img.getAttribute("src");
    if (!raw || isPlaceholder(raw)) {
      const promoted = LAZY_SRC_ATTRS.map((a) => img.getAttribute(a)).find(
        (v) => !!v && !isPlaceholder(v)
      );
      if (promoted) {
        img.setAttribute("src", promoted);
      } else {
        const srcset = img.getAttribute("srcset") ?? img.getAttribute("data-srcset");
        if (srcset) {
          const best = pickLargestFromSrcset(srcset);
          if (best) img.setAttribute("src", best);
        }
      }
    }
    const current = img.getAttribute("src");
    if (current && !isDataUrl(current) && !/^https?:\/\//i.test(current)) {
      try {
        img.setAttribute("src", new URL(current, doc.baseURI).toString());
      } catch {
      }
    }
  }
}
function isPlaceholder(s) {
  if (!s) return true;
  if (isDataUrl(s)) return true;
  if (/\/(spacer|placeholder|blank|transparent|1x1|1px)\b/i.test(s)) return true;
  return false;
}
function isDataUrl(s) {
  return /^data:/i.test(s);
}
function pickLargestFromSrcset(srcset) {
  let bestUrl = "";
  let bestWidth = -1;
  for (const raw of srcset.split(",")) {
    const entry = raw.trim();
    if (!entry) continue;
    const parts = entry.split(/\s+/);
    const url = parts[0];
    if (!url) continue;
    const descriptor = parts[1] ?? "";
    const width = parseWidth(descriptor);
    if (width >= bestWidth) {
      bestUrl = url;
      bestWidth = width;
    }
  }
  return bestUrl || null;
}
function parseWidth(descriptor) {
  if (descriptor.endsWith("w")) return parseInt(descriptor, 10) || 0;
  if (descriptor.endsWith("x")) return Math.round((parseFloat(descriptor) || 0) * 1e3);
  return 0;
}

// shared/canonical.ts
function resolveCanonicalUrl(doc, fallback) {
  const link = doc.querySelector('link[rel="canonical"]')?.getAttribute("href");
  const linkResolved = safeResolve(link, fallback);
  if (linkResolved) return linkResolved;
  const og = doc.querySelector('meta[property="og:url"]')?.getAttribute("content");
  const ogResolved = safeResolve(og, fallback);
  if (ogResolved) return ogResolved;
  return fallback;
}
function safeResolve(href, base) {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}

// shared/extractor.ts
function extract(doc, url) {
  preprocessLazyImages(doc);
  const canonicalUrl = resolveCanonicalUrl(doc, url);
  const a = dispatch(doc, canonicalUrl);
  if (!a) return null;
  const body = htmlToMarkdown(a.contentHtml);
  const fm = {
    title: a.title,
    url: canonicalUrl,
    source: bareDomain(canonicalUrl),
    author: a.author,
    published: a.published,
    clipped: nowIso(),
    lang: detectLang(body || a.title),
    adapter: a.adapter,
    word_count: countWords(body),
    tags: []
  };
  const markdown = buildFrontmatter(fm) + body + "\n";
  return { frontmatter: fm, body, markdown };
}
function countWords(text) {
  const cjk = (text.match(/[㐀-鿿぀-ヿ]/g) ?? []).length;
  const stripped = text.replace(/[㐀-鿿぀-ヿ]/g, " ");
  const words = stripped.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
  return cjk + words;
}

// shared/slug.ts
function slugify(input) {
  if (!input) return "untitled";
  let s = input.normalize("NFKC").trim().toLowerCase();
  s = s.replace(/[\s ]+/g, "-");
  s = s.replace(/[!"#$%&'()*+,./:;<=>?@\[\\\]^`{|}~·。、，！？：；「」『』（）【】]/g, "");
  s = s.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (!s) return "untitled";
  if (s.length > 80) {
    s = s.slice(0, 80);
    const lastHyphen = s.lastIndexOf("-");
    if (lastHyphen > 40) s = s.slice(0, lastHyphen);
  }
  return s || "untitled";
}

// claude-code-skill/clip.ts
var DEFAULT_DIR = join(
  homedir(),
  "Library/Mobile Documents/com~apple~CloudDocs/Clipper"
);
var USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
async function main() {
  const url = process.argv[2];
  if (!url || !/^https?:\/\//.test(url)) {
    process.stderr.write(
      "Usage: clip <url>   (URL must be http:// or https://)\n"
    );
    process.exit(2);
  }
  const dir = process.env.CLIPPER_DIR || DEFAULT_DIR;
  const resp = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT, accept: "text/html,*/*;q=0.8" }
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);
  const html = await resp.text();
  const dom = new JSDOM(html, { url });
  const result = extract(
    dom.window.document,
    url
  );
  if (!result) throw new Error("Extraction returned nothing");
  const fm = result.frontmatter;
  const date = fm.clipped.slice(0, 10);
  const base = `${date}-${slugify(fm.title)}-${fm.source}.md`;
  const filename = await firstAvailable(dir, base);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const fullPath = join(dir, filename);
  await writeFile(fullPath, result.markdown, "utf-8");
  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        path: fullPath,
        filename,
        title: fm.title,
        source: fm.source,
        author: fm.author,
        word_count: fm.word_count,
        lang: fm.lang,
        adapter: fm.adapter
      },
      null,
      2
    ) + "\n"
  );
}
async function firstAvailable(dir, base) {
  if (!existsSync(join(dir, base))) return base;
  const stem = base.replace(/\.md$/, "");
  for (let i = 2; i < 1e3; i++) {
    const candidate = `${stem}-${i}.md`;
    if (!existsSync(join(dir, candidate))) return candidate;
  }
  throw new Error("Too many naming conflicts");
}
main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(
    JSON.stringify({ ok: false, error: msg }, null, 2) + "\n"
  );
  process.exit(1);
});
