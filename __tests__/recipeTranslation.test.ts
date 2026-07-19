// The mock cross-language engine is what fills a scraped recipe's Chinese fields when the app
// flips to Traditional Chinese, so its substitution rules are pinned here. translateText is pure
// and synchronous, so no timers are needed; the one async batch test drives the real 400ms delay.
// Importing the service module is side-effect safe (jest.setup.js mocks AsyncStorage globally).
import { localizeHkTerm, translateText, translationService } from "@/services/translationService";

describe("translateText — target guard", () => {
  it("returns English input unchanged for the en target", () => {
    expect(translateText("Soy sauce", "en")).toBe("Soy sauce");
  });

  it("returns an empty string untouched", () => {
    expect(translateText("", "zh-Hant")).toBe("");
  });
});

describe("translateText — known ingredient substitution (zh-Hant)", () => {
  it("renders a single dictionary term into Traditional Chinese", () => {
    expect(translateText("Soy sauce", "zh-Hant")).toBe("豉油");
  });

  it("uses the canonical key too, not just the display name", () => {
    expect(translateText("garlic", "zh-Hant")).toBe("蒜頭");
  });

  it("is case-insensitive", () => {
    expect(translateText("SOY SAUCE", "zh-Hant")).toBe("豉油");
  });

  it("substitutes multiple terms inside a sentence and preserves unknown words", () => {
    expect(translateText("Add soy sauce and garlic", "zh-Hant")).toBe("Add 豉油 and 蒜頭");
  });
});

describe("translateText — longest match wins", () => {
  it("maps 'dark soy sauce' to 老抽, never 'soy sauce' -> 豉油", () => {
    expect(translateText("Dark soy sauce", "zh-Hant")).toBe("老抽");
  });

  it("holds even mid-sentence", () => {
    expect(translateText("Add dark soy sauce now", "zh-Hant")).toBe("Add 老抽 now");
  });
});

describe("translateText — passthrough", () => {
  it("leaves a sentence with no known ingredients untouched", () => {
    expect(translateText("Preheat the oven", "zh-Hant")).toBe("Preheat the oven");
  });
});

describe("translationService.translateBatch", () => {
  it("is order-preserving and same-length, translating each item independently", async () => {
    const out = await translationService.translateBatch(["Soy sauce", "garlic", "hello"], "zh-Hant");
    expect(out).toEqual(["豉油", "蒜頭", "hello"]);
  });

  it("passes English through for the en target", async () => {
    const out = await translationService.translateBatch(["Soy sauce"], "en");
    expect(out).toEqual(["Soy sauce"]);
  });

  it("short-circuits an empty batch", async () => {
    expect(await translationService.translateBatch([], "zh-Hant")).toEqual([]);
  });
});

describe("localizeHkTerm — live-path vernacular normaliser", () => {
  it("swaps a standard term for the Hong Kong preferred one", () => {
    expect(localizeHkTerm("醬油")).toBe("豉油");
    expect(localizeHkTerm("大蒜")).toBe("蒜頭");
    expect(localizeHkTerm("馬鈴薯")).toBe("薯仔");
  });

  it("trims surrounding whitespace before matching", () => {
    expect(localizeHkTerm("  醬油 ")).toBe("豉油");
  });

  it("leaves an already-Hong Kong term untouched", () => {
    expect(localizeHkTerm("豉油")).toBe("豉油");
    expect(localizeHkTerm("洋蔥")).toBe("洋蔥");
  });

  it("never rewrites inside a full sentence (whole-string match only)", () => {
    expect(localizeHkTerm("蒸10分鐘至熟透")).toBe("蒸10分鐘至熟透");
    expect(localizeHkTerm("加入醬油拌勻")).toBe("加入醬油拌勻");
  });

  it("preserves preparation-specific terms it must not flatten", () => {
    expect(localizeHkTerm("蒜蓉")).toBe("蒜蓉");
    expect(localizeHkTerm("五花腩")).toBe("五花腩");
    expect(localizeHkTerm("低筋麵粉")).toBe("低筋麵粉");
  });

  it("passes English and empty input straight through", () => {
    expect(localizeHkTerm("Soy sauce")).toBe("Soy sauce");
    expect(localizeHkTerm("")).toBe("");
  });
});
