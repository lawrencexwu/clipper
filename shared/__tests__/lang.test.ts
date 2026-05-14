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
        "這是一段相當長的繁體中文文字，用來測試語言偵測的功能。文字內容包含足夠多的漢字，應該被正確識別為中文而不是日文。"
      )
    ).toBe("zh");
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
