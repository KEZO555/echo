// Design tokens extracted from the official LightOS SDK
// (light-sdk/sdk/ui/.../LightTheme.kt), which mirrors the LP3 table in
// LightOS/src/style/index.ts. Values are used through n() so they track
// the same density normalisation as the rest of the app.

// LightOS uses exactly three colours per surface: background, content,
// and one secondary grey.
export const LIGHT_CONTENT_SECONDARY_DARK = "#BBBBBB";
export const LIGHT_CONTENT_SECONDARY_LIGHT = "#666666";

export const getSecondaryContentColor = (invertColors: boolean): string =>
  invertColors ? LIGHT_CONTENT_SECONDARY_LIGHT : LIGHT_CONTENT_SECONDARY_DARK;

// The LightOS type scale (font size / line-height multiplier / letter
// spacing as a fraction of size). Only the roles Echo uses are listed;
// the full table also has title(115), subtitle(52), heading(38),
// subheading(30), copy(30), button(30), paragraph(24.5), superfine(16)
// and micro(8).
export const LIGHT_TYPE = {
  // Top bar titles and buttons ("Fine" in the SDK's LightTopBar).
  fine: { fontSize: 25, lineHeightRatio: 1.15, letterSpacingRatio: 0.03 },
  // Primary list text ("ParagraphWide").
  paragraphWide: {
    fontSize: 25,
    lineHeightRatio: 1.3,
    letterSpacingRatio: 0.02,
  },
  // Secondary list text ("Detail").
  detail: { fontSize: 20, lineHeightRatio: 1.45, letterSpacingRatio: 0 },
} as const;
