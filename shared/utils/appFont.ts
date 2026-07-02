import { loadAsync } from "expo-font";
import { log } from "./logger";

// The Light Phone III ships Akkurat as its system font (see the LightOS
// SDK's LightFont.kt, which loads it from the device's system fonts).
// Loading it from /system/fonts lets Echo render in the exact same face
// as the built-in tools without bundling a licensed font. Falls back to
// the bundled Public Sans anywhere else (emulators, other devices).
const AKKURAT_FAMILY = "Akkurat";
const FALLBACK_FAMILY = "PublicSans-Regular";

const SYSTEM_FONT_CANDIDATES = [
  "file:///system/fonts/AkkuratLL-Regular.ttf",
  "file:///system/fonts/AkkuratLLWeb-Regular.ttf",
  "file:///system/fonts/Akkurat-Regular.ttf",
  "file:///system/fonts/AkkuratStd-Regular.ttf",
  "file:///product/fonts/AkkuratLL-Regular.ttf",
];

let resolvedFamily = FALLBACK_FAMILY;

export const getAppFontFamily = (): string => resolvedFamily;

export const loadSystemFont = async (): Promise<void> => {
  for (const uri of SYSTEM_FONT_CANDIDATES) {
    try {
      await loadAsync({ [AKKURAT_FAMILY]: uri });
      resolvedFamily = AKKURAT_FAMILY;
      log("Font: using system Akkurat from", uri);
      return;
    } catch {
      // Not present at this path - try the next candidate.
    }
  }
  log("Font: system Akkurat not found, using bundled Public Sans");
};
