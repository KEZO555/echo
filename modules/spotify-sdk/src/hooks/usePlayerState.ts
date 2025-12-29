import { useState, useEffect } from 'react';
import { spotify } from '../spotify';
import type { SpotifyPlayerState } from '../SpotifySdk.types';

export function usePlayerState() {
    const [playerState, setPlayerState] = useState<SpotifyPlayerState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        // Initial fetch
        spotify.getPlayerState()
            .then(setPlayerState)
            .catch(() => setPlayerState(null))
            .finally(() => setIsLoading(false));
        
        // Subscribe to changes
        return spotify.onPlayerStateChanged(setPlayerState);
    }, []);
    
    return { playerState, isLoading };
}
