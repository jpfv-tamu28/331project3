import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './db.js';
import menuRoutes from './routes/menu.js';
import inventoryRoutes from './routes/inventory.js';
import employeeRoutes from './routes/employees.js';
import orderRoutes from './routes/orders.js';
import reportRoutes from './routes/reports.js';
import weatherRoutes from './routes/weather.js';
import pokemonRoutes from './routes/pokemon.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);

// Comma-separated list of allowed browser origins. Only needed when the frontend
// is hosted on a different domain; same-origin requests don't need CORS.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, database: 'unreachable', error: err.message });
  }
});

app.use('/api/menu', menuRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/pokemon', pokemonRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// In production one service can host both halves: serve the built React app
// and send unknown paths to index.html so client-side routes like /manager work.
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// Postgres error codes that mean the request was bad, not the server.
const PG_CLIENT_ERRORS = { 23503: 'That record refers to something that does not exist.', 23505: 'That value is already in use.' };

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.status) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Request body must be valid JSON.' });
    return;
  }
  if (PG_CLIENT_ERRORS[err.code]) {
    res.status(400).json({ error: PG_CLIENT_ERRORS[err.code] });
    return;
  }
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`[INFO] Boba Bops API listening on http://localhost:${PORT}`);
  if (!process.env.DB_PASSWORD) {
    console.warn('[WARN] DB_PASSWORD is not set; database requests will fail. Copy .env.example to .env.');
  }
});
