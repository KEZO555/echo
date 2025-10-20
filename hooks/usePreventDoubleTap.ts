import { useRef, useCallback } from "react";

const DEFAULT_DELAY_MS = 600;

/**
 * Returns a wrapped handler that ignores presses fired again within the delay window.
 */
export function usePreventDoubleTap<T extends (...args: any[]) => any>(
    handler: T,
    delay: number = DEFAULT_DELAY_MS
): (...args: Parameters<T>) => void {
    const lastInvokedRef = useRef<number>(0);

    return useCallback(
        (...args: Parameters<T>) => {
            const now = Date.now();
            if (now - lastInvokedRef.current < delay) {
                return;
            }
            lastInvokedRef.current = now;
            handler?.(...args);
        },
        [handler, delay]
    );
}
