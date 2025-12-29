import { useState, useEffect } from 'react';
import * as Network from 'expo-network';

export function useNetworkState() {
    const [isOnline, setIsOnline] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const updateNetworkState = (networkState: Network.NetworkState) => {
            setIsOnline(
                networkState.isConnected === true &&
                networkState.isInternetReachable === true
            );
            if (networkState.isInternetReachable !== null) {
                setIsLoading(false);
            }
        };

        const subscription = Network.addNetworkStateListener(updateNetworkState);

        Network.getNetworkStateAsync()
            .then(updateNetworkState)
            .catch(() => {
                setIsOnline(false);
                setIsLoading(false);
            });

        return () => subscription?.remove();
    }, []);

    return { isOnline, isLoading };
}
