// Whether the built-in (librespot) playback engine handles playback instead
// of the Spotify app. Held as plain module state so the service functions in
// spotifyPlayback.ts can fork without a React dependency; the value is kept
// in sync with the "Built-in Player (Beta)" setting by PlaybackProvider.
let engineModeEnabled = false;

export const setEngineModeEnabled = (value: boolean): void => {
  engineModeEnabled = value;
};

export const isEngineModeEnabled = (): boolean => engineModeEnabled;
