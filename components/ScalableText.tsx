import { Text, TextProps } from "react-native";

/**
 * Every label in the app goes through this. It keeps OS font-scaling ON (accessibility
 * for a multi-generational household) but caps the multiplier so dense rows and the
 * calorie ring don't clip at the largest system text sizes.
 */
export function ScalableText({ maxFontSizeMultiplier = 1.6, ...props }: TextProps) {
  return <Text maxFontSizeMultiplier={maxFontSizeMultiplier} {...props} />;
}
