import { apiUrl } from '../api';

// One shared EventSource to GET /api/orders/events, opened while anything is subscribed.
// The server sends an "order" event the moment any cashier or kiosk order commits.

const RETRY_MS = 15_000; // after the stream is refused (e.g. signed out); network drops retry on their own
const subscribers = new Set();
let source = null;
let retryTimer = null;

function open() {
  if (source || typeof EventSource === 'undefined') return;
  source = new EventSource(apiUrl('/orders/events'), { withCredentials: true });
  source.addEventListener('order', (e) => {
    let order = {};
    try {
      order = JSON.parse(e.data);
    } catch {
      // Still an order; the payload is only informational.
    }
    subscribers.forEach((fn) => fn(order));
  });
  source.onerror = () => {
    // CONNECTING means the browser is already retrying; CLOSED means it gave up (e.g. a 401 response).
    if (source?.readyState !== EventSource.CLOSED) return;
    source.close();
    source = null;
    if (subscribers.size > 0 && !retryTimer) {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (subscribers.size > 0) open();
      }, RETRY_MS);
    }
  };
}

/** Calls fn({ id }) whenever a new order is placed; returns an unsubscribe function. */
export function subscribeToOrders(fn) {
  subscribers.add(fn);
  open();
  return () => {
    subscribers.delete(fn);
    if (subscribers.size > 0) return;
    source?.close();
    source = null;
    clearTimeout(retryTimer);
    retryTimer = null;
  };
}
