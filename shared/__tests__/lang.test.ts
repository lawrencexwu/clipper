import { describe, it, expect } from "vitest";
import { detectLang } from "../lang.js";

describe("detectLang", () => {
  it("detects English prose", () => {
    expect(
      detectLang(
        "This is a longish English sentence that should clearly be identified as English by any reasonable heuristic."
      )
    ).toBe("en");
  });

  it("detects Traditional Chinese", () => {
    expect(
      detectLang(
        "這是一段相當長的繁體中文文字，用來測試語言偵測的功能。文字內容包含足夠多的漢字，應該被正確識別為繁體中文。國家、學習、開放、發現都用繁體寫法。"
      )
    ).toBe("zh-Hant");
  });

  it("detects Simplified Chinese", () => {
    expect(
      detectLang(
        "这是一段相当长的简体中文文字，用来测试语言侦测的功能。文字内容包含足够多的汉字，应该被正确识别为简体中文。国家、学习、开放、发现都用简体写法。"
      )
    ).toBe("zh-Hans");
  });

  it("detects Japanese via kana", () => {
    expect(
      detectLang(
        "これは日本語のテストです。ひらがなとカタカナが混ざっているので、日本語として認識されるはずです。"
      )
    ).toBe("ja");
  });

  it("returns other for empty text", () => {
    expect(detectLang("")).toBe("other");
  });
});
