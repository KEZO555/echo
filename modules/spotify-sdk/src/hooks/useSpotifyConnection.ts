import { useState, useEffect, useCallback } from 'react';
import { spotify } from '../spotify';

export function useSpotifyConnection() {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    useEffect(() => {
        // Initial connection check
        spotify.isConnected().then(setIsConnected);
        
        // Subscribe to connection changes
        const unsubscribeConnection = spotify.onConnectionChanged(setIsConnected);
        const unsubscribeError = spotify.onError(setError);
        
        return () => {
            unsubscribeConnection();
            unsubscribeError();
        };
    }, []);
    
    const connect = useCallback(async () => {
        setIsConnecting(true);
        setError(null);
        try {
            const result = await spotify.connect();
            setIsConnected(result);
            return result;
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Connection failed');
            return false;
        } finally {
            setIsConnecting(false);
        }
    }, []);
    
    const disconnect = useCallback(async () => {
        await spotify.disconnect();
        setIsConnected(false);
    }, []);
    
    return { isConnected, isConnecting, error, connect, disconnect };
}
