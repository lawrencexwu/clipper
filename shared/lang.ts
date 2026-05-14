export type Lang = "en" | "zh-Hant" | "zh-Hans" | "zh" | "ja" | "other";

// Chars that exist only in Traditional or only in Simplified Chinese.
// Both sets are pair-aligned so the heuristic compares like-for-like.
const TRAD_CHARS = new Set(
  "體國學寫對開為從過來個說發點時這還會樣關門題網際讓場頭實當頂飛數長愛畫東車聲廣業務覺氣紙幣顯經歷觀價買賣車輛麼當當動發處種讀數聞輕舊運動圖書聽見覺辦員實實際際歐豐豐"
);
const SIMP_CHARS = new Set(
  "体国学写对开为从过来个说发点时这还会样关门题网际让场头实当顶飞数长爱画东车声广业务觉气纸币显经历观价买卖车辆么当当动发处种读数闻轻旧运动图书听见觉办员实实际际欧丰丰"
);

function detectChineseVariant(text: string): "zh-Hant" | "zh-Hans" | "zh" {
  let trad = 0;
  let simp = 0;
  for (const ch of text) {
    if (TRAD_CHARS.has(ch)) trad++;
    else if (SIMP_CHARS.has(ch)) simp++;
  }
  if (trad === 0 && simp === 0) return "zh";
  return trad >= simp ? "zh-Hant" : "zh-Hans";
}

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

  if (kana >= 5 || (kana > 0 && kana * 4 >= han)) return "ja";
  if (han >= 20 && han > latin / 2) return detectChineseVariant(sample);
  if (latin >= 20) return "en";
  return "other";
}
