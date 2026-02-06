// Native module (low-level)

// Hooks
export { usePlayerState, useSpotifyConnection } from "./src/hooks";
// Types
export * from "./src/SpotifySdk.types";
export { default as SpotifySdkNative } from "./src/SpotifySdkModule";
// Wrapper (recommended)
export { spotify } from "./src/spotify";

// Default export for backward compatibility
export { default } from "./src/SpotifySdkModule";
