import { useState, useEffect } from 'react';
import * as Network from 'expo-network';

export function useNetworkState() {
    const [isOnline, setIsOnline] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const updateNetworkState = (networkState: Network.NetworkState) => {
            setIsOnline(networkState.isConnected === true && networkState.isInternetReachable !== false);
            setIsLoading(false);
        };

        const checkNetworkState = async () => {
            try {
                const networkState = await Network.getNetworkStateAsync();
                updateNetworkState(networkState);
            } catch (error) {
                setIsOnline(false);
                setIsLoading(false);
            }
        };

        checkNetworkState();

        const subscription = Network.addNetworkStateListener(updateNetworkState);

        return () => subscription?.remove();
    }, []);

    return { isOnline, isLoading };
}
