// Raw color tokens for contexts that cannot take a Tailwind className
// (SVG fills, icon `color` props, status bar). Keep in sync with tailwind.config.js.
//
// Identity: 少甜少底 | Siu Tim Siu Dai. A modern HK cha chaan teng palette.
// - Primary  = Milk Tea Amber (絲襪奶茶色): a deep caramel that carries white text (~5:1).
// - Highlight = Egg-Tart Gold (蛋撻黃): warm golden for accents and "over" states.
// - Health   = Jade Green (翡翠綠): the calorie ring, "cook now", and the protein macro.
// Surfaces stay soft warm off-white (never clinical white); text is warm charcoal.

export const colors = {
  brand: "#A0602F", // Milk Tea Amber — primary actions, FAB, active pills
  brandDark: "#824B24",
  accent: "#EBA524", // Egg-Tart Gold — highlights, over-target ring
  accentDark: "#C9841A",
  jade: "#1FA06A", // Jade Green — health indicators (ring, cook-now, protein)
  ink: "#211E18",
  inkMuted: "#6F695C",
  inkFaint: "#9C9484",
  surface: "#FBF8F1",
  surfaceSubtle: "#F3EEE3",
  surfaceSunken: "#E8E1D2",
  ringTrack: "#E8E1D2",
  border: "#E4DCCB",
  success: "#1FA06A",
  white: "#FFFFFF",
  charcoal: "#15120D", // premium dark field for locked-ledger scrims; mirrors darkColors.surface
} as const;

export const macroColors = {
  protein: "#2AA06A", // jade family (health)
  carbs: "#E0A63A", // egg-tart gold family
  fat: "#D2683F", // warm clay
} as const;

// One colour per tracked micronutrient for the premium daily tracker bars. Warm-palette friendly
// but distinct enough to read five bars at a glance.
export const microColors = {
  iron: "#C2554B", // rust red
  calcium: "#4E93A6", // mineral teal
  potassium: "#7FA653", // leaf green
  vitaminC: "#EBA524", // egg-tart gold (citrus)
  vitaminD: "#E0803A", // sunlight orange
} as const;

// Deep-charcoal dark matrix. Defined now for a future dark-mode pass; not wired to any
// `dark:` variants or a toggle yet, so the app still ships light. Same token names as
// `colors` so a later pass can swap the source by theme without touching call sites.
export const darkColors = {
  brand: "#CE9159", // milk tea lifted so it reads on charcoal
  brandDark: "#A0602F",
  accent: "#F2B948",
  accentDark: "#D49428",
  jade: "#37C489",
  ink: "#F4EFE6",
  inkMuted: "#B3AB9B",
  inkFaint: "#847C6E",
  surface: "#15120D",
  surfaceSubtle: "#201C15",
  surfaceSunken: "#2C261D",
  ringTrack: "#2C261D",
  border: "#332C22",
  success: "#37C489",
  white: "#FFFFFF",
} as const;

export const darkMacroColors = {
  protein: "#3FC489",
  carbs: "#EFBB4E",
  fat: "#E27C54",
} as const;

// Minimum accessible touch target (pt). Pair with icon + label.
export const MIN_TOUCH_TARGET = 44;
