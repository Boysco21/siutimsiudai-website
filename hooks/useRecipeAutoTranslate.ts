import { useEffect } from "react";
import { useAppStore } from "@/stores/appStore";
import { useRecipeStore } from "@/stores/recipeStore";

// Watches the global locale. Whenever the app is in Traditional Chinese, any URL-imported recipe
// that has not yet been translated has its English title/ingredients/steps lazily rendered into
// Chinese by translationService and cached on the recipe. This covers both directions: toggling
// EN -> zh with recipes already in the box, and importing a new recipe while already in zh.
//
// pendingIds is a joined string, not an array, so the effect only re-fires when the SET of
// untranslated recipes actually changes, not on every unrelated store write.
export function useRecipeAutoTranslate(): void {
  const locale = useAppStore((s) => s.locale);
  const pendingIds = useRecipeStore((s) =>
    s.recipes
      .filter((r) => r.sourceType === "url" && !r.zhTranslated)
      .map((r) => r.id)
      .join(","),
  );
  const translate = useRecipeStore((s) => s.translateRecipeToZh);

  useEffect(() => {
    if (locale !== "zh-Hant" || !pendingIds) return;
    for (const id of pendingIds.split(",")) void translate(id);
  }, [locale, pendingIds, translate]);
}
