import { useCallback, useEffect, useRef, useState } from "react";

interface ScrollIdleHandlers {
  onScrollBeginDrag: () => void;
  onMomentumScrollBegin: () => void;
  onMomentumScrollEnd: () => void;
  onScrollEndDrag: () => void;
}

/**
 * Tracks whether a scroll view is currently at rest. Marquee/auto-scroll rows
 * read `isIdle` so their text only animates once the list settles - scrolling
 * pauses it, and it plays through again each time the user stops. Starts idle
 * so long labels animate on first paint.
 */
export function useScrollIdle(): {
  isIdle: boolean;
  scrollIdleHandlers: ScrollIdleHandlers;
} {
  const [isIdle, setIsIdle] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  }, []);

  useEffect(() => clearIdleTimer, [clearIdleTimer]);

  const markScrolling = useCallback(() => {
    clearIdleTimer();
    setIsIdle(false);
  }, [clearIdleTimer]);

  const markIdle = useCallback(() => {
    clearIdleTimer();
    setIsIdle(true);
  }, [clearIdleTimer]);

  // A drag release either flings (momentum will follow) or stops here. Wait a
  // beat: if momentum starts it cancels this, otherwise the list has settled.
  const scheduleIdle = useCallback(() => {
    clearIdleTimer();
    idleTimer.current = setTimeout(() => setIsIdle(true), 100);
  }, [clearIdleTimer]);

  const scrollIdleHandlers: ScrollIdleHandlers = {
    onScrollBeginDrag: markScrolling,
    onMomentumScrollBegin: markScrolling,
    onMomentumScrollEnd: markIdle,
    onScrollEndDrag: scheduleIdle,
  };

  return { isIdle, scrollIdleHandlers };
}
