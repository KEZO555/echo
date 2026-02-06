import { useEffect, useState } from "react";
import type { SpotifyPlayerState } from "../SpotifySdk.types";
import { spotify } from "../spotify";

export function usePlayerState() {
  const [playerState, setPlayerState] = useState<SpotifyPlayerState | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    spotify
      .getPlayerState()
      .then(setPlayerState)
      .catch(() => setPlayerState(null))
      .finally(() => setIsLoading(false));

    // Subscribe to changes
    return spotify.onPlayerStateChanged(setPlayerState);
  }, []);

  return { playerState, isLoading };
}
