export type PromptKey =
  | "summarize"
  | "explain"
  | "steelman"
  | "extract"
  | "falsify";

export const summarize = `Give me a TL;DR (3-5 sentences), then the key claims as a bulleted list, then a one-paragraph "what's actually new or interesting here" if applicable. End with a single sentence stating who would benefit most from reading the full piece.`;

export const explain = `Identify the 3-5 most technical or jargon-heavy concepts in this piece and explain each in plain language with a concrete example. Then give me one sentence connecting how these concepts relate to each other or to the article's main argument.`;

export const steelman = `Two parts. (1) Steel-man: state the strongest version of the author's thesis and the best evidence supporting it. Don't be charitable — be accurate to the strongest form of their case. (2) Strongest counter-argument: what would a smart, well-informed skeptic say? Be specific about which claims are weakest and why.`;

export const extract = `Extract structured data as a markdown table. Columns: \`type\` (one of: ticker / person / company / date / number / claim), \`value\`, \`context\` (one phrase). Include every ticker symbol, named person with their role, named company, specific date, specific number with units, and any falsifiable claim. Aim for completeness over selection.`;

export const falsify = `List 5-8 specific, observable conditions that would falsify or seriously weaken this article's thesis. Each should be concrete enough that I could check it in 6-12 months without ambiguity (e.g. specific metrics, named events, threshold values).`;

export const DEFAULTS: Record<PromptKey, string> = {
  summarize,
  explain,
  steelman,
  extract,
  falsify,
};

export const PROMPT_LABELS: Record<PromptKey, string> = {
  summarize: "Summarize",
  explain: "Explain",
  steelman: "Steel-man",
  extract: "Extract",
  falsify: "Falsify",
};
