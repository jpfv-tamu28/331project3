import { useEffect, useRef } from 'react';
import { subscribeToOrders } from './orderEvents';

/** Fallback poll, for when the live order stream is unavailable (e.g. an old server deployment). */
export const AUTO_REFRESH_MS = 30_000;
// Orders placed together (or a drink and its add-ons) trigger one reload.
const ORDER_DEBOUNCE_MS = 300;
// Focus and visibilitychange often fire together; one reload covers both.
const MIN_GAP_MS = 2_000;

/**
 * While enabled, calls refresh() as soon as a new order is placed (live server events), every intervalMs
 * as a fallback, and right away when it becomes enabled again or the window regains focus.
 * Nothing runs while the browser tab is hidden; it catches up when the tab is shown.
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

    let debounce = null;
    const unsubscribe = subscribeToOrders(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        // A new order always reloads, even right after another refresh.
        lastRun.current = 0;
        tick();
      }, ORDER_DEBOUNCE_MS);
    });

    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      unsubscribe();
      clearTimeout(debounce);
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [enabled, intervalMs]);
}
