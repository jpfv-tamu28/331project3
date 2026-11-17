import { EventEmitter } from 'node:events';
import pg from 'pg';
import { connectionConfig } from './db.js';

// New orders are announced with Postgres NOTIFY, so every API process connected to the database
// (Render, a teammate's laptop, ...) hears about orders placed through any of them, and manager
// screens can refresh the moment an order commits instead of waiting for their next poll.

export const ORDER_CHANNEL = 'boba_bops_orders';
const RECONNECT_MS = 5_000;

/**
 * Queues the "order placed" notification on the order's transaction client. Postgres only delivers
 * it if that transaction commits, so a rolled-back order is never announced.
 */
export async function notifyOrderPlaced(client, orderId) {
  await client.query('SELECT pg_notify($1, $2)', [ORDER_CHANNEL, JSON.stringify({ id: orderId })]);
}

const emitter = new EventEmitter();
emitter.setMaxListeners(0); // one listener per open manager screen

let listener = null; // the dedicated LISTEN connection, while connected
let connecting = false;
let retryTimer = null;

function scheduleReconnect() {
  if (retryTimer || emitter.listenerCount('order') === 0) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    ensureListening();
  }, RECONNECT_MS);
  retryTimer.unref?.();
}

async function ensureListening() {
  if (listener || connecting) return;
  connecting = true;
  const client = new pg.Client(connectionConfig);
  const drop = (err) => {
    if (err) console.warn('[WARN] Order notification listener disconnected:', err.message);
    if (listener === client) listener = null;
    client.removeAllListeners();
    client.on('error', () => {}); // ignore late errors from the discarded connection
    client.end().catch(() => {});
    scheduleReconnect();
  };
  try {
    await client.connect();
    client.on('notification', (msg) => {
      if (msg.channel !== ORDER_CHANNEL) return;
      let payload = {};
      try {
        payload = JSON.parse(msg.payload || '{}');
      } catch {
        // A malformed payload still means "an order happened".
      }
      emitter.emit('order', payload);
    });
    client.on('error', drop);
    client.on('end', () => drop());
    await client.query(`LISTEN ${ORDER_CHANNEL}`);
    listener = client;
  } catch (err) {
    drop(err);
  } finally {
    connecting = false;
  }
}

/** Calls onOrder({ id }) for every order placed from now on; returns an unsubscribe function. */
export function subscribeToOrders(onOrder) {
  emitter.on('order', onOrder);
  ensureListening();
  return () => emitter.off('order', onOrder);
}

const HEARTBEAT_MS = 25_000; // keeps proxies (Render, Vite) from closing an idle stream

/**
 * GET handler streaming Server-Sent Events: an "order" event per new order, plus comment heartbeats.
 * The browser's EventSource reconnects on its own if the stream drops.
 */
export function orderEventStream(subscribe = subscribeToOrders) {
  return (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write('retry: 5000\n\n');
    const unsubscribe = subscribe((order) => {
      res.write(`event: order\ndata: ${JSON.stringify(order)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  };
}
