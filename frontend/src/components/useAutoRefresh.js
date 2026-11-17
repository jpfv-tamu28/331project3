import { useEffect, useRef } from 'react';

export const AUTO_REFRESH_MS = 30_000;
// Focus and visibilitychange often fire together; one reload covers both.
const MIN_GAP_MS = 2_000;

/**
 * Calls refresh() every intervalMs while enabled and the browser tab is visible, and right away when
 * it becomes enabled again or the window regains focus, so live reports pick up new orders on their own.
 */
export function useAutoRefresh(refresh, enabled, intervalMs = AUTO_REFRESH_MS) {
  const refreshRef = useRef(refresh);
  const lastRun = useRef(0);
  const firstEnable = useRef(true);

  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastRun.current < MIN_GAP_MS) return;
      lastRun.current = Date.now();
      refreshRef.current();
    };
    // The first time, the caller is already loading its data; afterwards (e.g. switching back to the tab) catch up.
    if (!firstEnable.current) tick();
    firstEnable.current = false;

    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [enabled, intervalMs]);
}
