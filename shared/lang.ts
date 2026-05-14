export type Lang = "en" | "zh" | "ja" | "other";

export function detectLang(text: string): Lang {
  if (!text) return "other";
  const sample = text.slice(0, 4000);
  let han = 0;
  let kana = 0;
  let latin = 0;

  for (const ch of sample) {
    const cp = ch.codePointAt(0)!;
    // Hiragana + Katakana
    if ((cp >= 0x3040 && cp <= 0x309f) || (cp >= 0x30a0 && cp <= 0x30ff)) {
      kana++;
    } else if (
      (cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0xf900 && cp <= 0xfaff)
    ) {
      han++;
    } else if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) {
      latin++;
    }
  }

  // Kana is unique to Japanese; even a small amount mixed with han means ja.
  if (kana >= 5 || (kana > 0 && kana * 4 >= han)) return "ja";
  if (han >= 20 && han > latin / 2) return "zh";
  if (latin >= 20) return "en";
  return "other";
}
