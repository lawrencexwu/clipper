export function slugify(input: string): string {
  if (!input) return "untitled";

  let s = input.normalize("NFKC").trim().toLowerCase();

  // Collapse whitespace into single hyphens
  s = s.replace(/[\s ]+/g, "-");

  // Strip ASCII punctuation; keep alphanumerics, hyphens, and CJK
  s = s.replace(/[!"#$%&'()*+,./:;<=>?@\[\\\]^`{|}~·。、，！？：；「」『』（）【】]/g, "");

  // Collapse repeated hyphens and trim
  s = s.replace(/-+/g, "-").replace(/^-+|-+$/g, "");

  if (!s) return "untitled";

  if (s.length > 80) {
    s = s.slice(0, 80);
    const lastHyphen = s.lastIndexOf("-");
    if (lastHyphen > 40) s = s.slice(0, lastHyphen);
  }

  return s || "untitled";
}
