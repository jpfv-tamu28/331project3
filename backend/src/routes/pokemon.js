import { Router } from 'express';
import { HttpError, asyncRoute, requireId } from '../http.js';

export const DEX_SIZE = 1025;

/**
 * Maps a positive order number to a Pokedex number (1..DEX_SIZE) matching its trailing digits:
 * - If the last 4 digits are 1..1025 (e.g. #25 -> #025, #1025 -> #1025, #21015 -> #1015), use them.
 * - Otherwise use the last 3 digits (001..999 -> #001..#999, and 000 -> #1000).
 */
export const dexNumber = (n) => {
  const last4 = n % 10000;
  if (last4 >= 1 && last4 <= DEX_SIZE) return last4;
  return n % 1000 || 1000;
};

/** Keeps only the fields the kiosk shows from a PokeAPI /pokemon response. */
export function toPokemon(data) {
  return {
    dex: data.id,
    name: data.name,
    types: data.types.map((t) => t.type.name),
    sprite: data.sprites.other?.['official-artwork']?.front_default ?? data.sprites.front_default,
  };
}

// Pokemon data never changes, so each one is fetched from PokeAPI at most once per server run.
const cache = new Map();

const router = Router();

// GET /api/pokemon/:id -> { dex, name, types, sprite }; id is any positive integer (e.g. an order number).
router.get('/:id', asyncRoute(async (req, res) => {
  const dex = dexNumber(requireId(req.params.id));
  if (!cache.has(dex)) {
    let response;
    try {
      response = await fetch(`https://pokeapi.co/api/v2/pokemon/${dex}`, { signal: AbortSignal.timeout(8000) });
    } catch (err) {
      console.error('[WARN] PokeAPI request failed:', err.cause?.code ?? err.message);
    }
    if (!response?.ok) throw new HttpError(502, 'The Pokemon service is unavailable right now.');
    cache.set(dex, toPokemon(await response.json()));
  }
  res.json(cache.get(dex));
}));

export default router;
