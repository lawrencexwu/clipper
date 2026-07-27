export type PromptKey =
  | "summarize"
  | "explain"
  | "steelman"
  | "extract"
  | "falsify";

// Shared closer appended to Summarize / Explain / Falsify. Steelman has its
// own variant (investment call is Part 3, ties to the steel-manned thesis).
const INVESTMENT_CLOSER = `Finally, identify any investment angle or opportunity that this article strongly signals — only if the article's argument or evidence directly implies one; don't force an angle that isn't there. If there is one:
- Name the specific instrument (ticker, sector, thematic basket, or trade structure).
- Direction (long / short).
- Classify the horizon: **short-term swing** (days to weeks, needs a specific catalyst or event) or **medium-to-long-term** (quarters to years, structural thesis that takes time to play out).
- Cite the single strongest piece of evidence from the article supporting the trade.

If no strong investment signal exists, say so explicitly rather than invent one.`;

export const summarize = `Give me a TL;DR (3-5 sentences), then the key claims as a bulleted list, then a one-paragraph "what's actually new or interesting here" if applicable. Then a single sentence stating who would benefit most from reading the full piece.

${INVESTMENT_CLOSER}`;

export const explain = `Identify the 3-5 most technical or jargon-heavy concepts in this piece and explain each in plain language with a concrete example. Then give me one sentence connecting how these concepts relate to each other or to the article's main argument.

${INVESTMENT_CLOSER}`;

export const steelman = `Three parts. (1) Steel-man: state the strongest version of the author's thesis and the best evidence supporting it. Don't be charitable — be accurate to the strongest form of their case. (2) Strongest counter-argument: what would a smart, well-informed skeptic say? Be specific about which claims are weakest and why. (3) Investment angle: if the steel-manned thesis or the counter-argument strongly implies a trade, name the specific instrument (ticker, sector, thematic basket, or trade structure), direction (long / short), and classify the horizon as **short-term swing** (days to weeks, needs a specific catalyst) or **medium-to-long-term** (quarters to years, structural thesis). Cite the single strongest piece of evidence, and note whether the trade is asymmetric — pays off much more if right than it costs if wrong. If no strong investment signal exists, say so explicitly.`;

export const extract = `Extract structured data as a markdown table. Columns: \`type\` (one of: ticker / person / company / date / number / claim), \`value\`, \`context\` (one phrase). Include every ticker symbol, named person with their role, named company, specific date, specific number with units, and any falsifiable claim. Aim for completeness over selection.`;

export const falsify = `List 5-8 specific, observable conditions that would falsify or seriously weaken this article's thesis. Each should be concrete enough that I could check it in 6-12 months without ambiguity (e.g. specific metrics, named events, threshold values).

Then, if the article strongly signals an investment angle: name the specific instrument (ticker, sector, thematic basket, or trade structure), direction (long / short), and classify the horizon as **short-term swing** (days to weeks, needs a specific catalyst) or **medium-to-long-term** (quarters to years, structural thesis). For that trade, indicate which of the falsification conditions above would be the earliest and clearest signal to exit. If no strong investment signal exists, say so explicitly.`;

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
