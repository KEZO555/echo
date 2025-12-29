// Native module (low-level)
export { default as SpotifySdkNative } from './src/SpotifySdkModule';

// Wrapper (recommended)
export { spotify } from './src/spotify';

// Hooks
export { useSpotifyConnection, usePlayerState } from './src/hooks';

// Types
export * from './src/SpotifySdk.types';

// Default export for backward compatibility
import SpotifySdkNative from './src/SpotifySdkModule';
export default SpotifySdkNative;
